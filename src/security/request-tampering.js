import { createFinding } from './core/finding.js';

const sensitiveKeyPattern = /password|token|secret|credential|authorization|cookie/i;
const denylistedPathPattern = /login|logout|auth|session|token|password|upload|delete|admin/i;
const unsafeMethods = new Set(['POST', 'PUT', 'PATCH']);
const skipReasons = {
  externalOrigin: 'external-origin',
  unsupportedMethod: 'unsupported-method',
  denylistedPath: 'denylisted-path',
  emptyBody: 'empty-body',
  unparseableBody: 'unparseable-body',
  sensitiveBody: 'sensitive-body',
  unsupportedProfile: 'unsupported-profile',
  replayDisabledProfile: 'replay-disabled-profile',
  targetLimit: 'target-limit',
  noMutableFields: 'no-mutable-fields'
};
const defaultOptions = {
  maxTargets: 3,
  maxAttemptsPerTarget: 12,
  includeGenericSafe: false
};

export function parseRequestBody(request) {
  const body = request?.requestBody ?? request?.body ?? null;
  const contentType = headerValue(request?.requestHeaders, 'content-type');

  if (body == null || body === '') {
    return {
      type: 'empty',
      value: null,
      parseable: false,
      sensitive: false
    };
  }

  if (typeof body === 'object') {
    return {
      type: 'json',
      value: redactObject(body),
      parseable: true,
      sensitive: containsSensitiveValue(body)
    };
  }

  const raw = String(body);
  const rawSensitive = sensitiveKeyPattern.test(raw);
  if (/application\/json/i.test(contentType) || looksLikeJson(raw)) {
    try {
      const parsed = JSON.parse(raw);
      return {
        type: 'json',
        value: redactObject(parsed),
        parseable: true,
        sensitive: rawSensitive || containsSensitiveValue(parsed)
      };
    } catch {
      return {
        type: 'raw',
        value: raw,
        parseable: false,
        sensitive: rawSensitive
      };
    }
  }

  if (/application\/x-www-form-urlencoded/i.test(contentType)) {
    const parsed = Object.fromEntries(new URLSearchParams(raw));
    return {
      type: 'form',
      value: redactObject(parsed),
      parseable: true,
      sensitive: rawSensitive || containsSensitiveValue(parsed)
    };
  }

  return {
    type: 'raw',
    value: raw,
    parseable: false,
    sensitive: rawSensitive
  };
}

export function findTamperableRequests(responses, options = {}) {
  return classifyTamperableRequests(responses, options).targets;
}

export function classifyTamperableRequests(responses, options = {}) {
  const config = { ...defaultOptions, ...options };
  const targets = [];
  const skippedRequests = [];
  const seen = new Set();

  for (const entry of responses || []) {
    const normalized = normalizeRequestEntry(entry, config.baseURL);
    const skipReason = skipReasonForEntry(normalized, config);
    if (skipReason) {
      skippedRequests.push(skippedRequest(normalized, skipReason));
      continue;
    }

    const parsedBody = parseRequestBody(normalized);
    const profile = detectProfile(parsedBody.value, normalized);
    if (!profile) {
      skippedRequests.push(skippedRequest(normalized, skipReasons.unsupportedProfile));
      continue;
    }

    if (!profile.replayEnabled) {
      skippedRequests.push(skippedRequest(normalized, skipReasons.replayDisabledProfile, profile.id));
      continue;
    }

    const key = `${normalized.method} ${normalized.url} ${profile.id} ${JSON.stringify(parsedBody.value)}`;
    if (seen.has(key)) {
      continue;
    }

    if (targets.length >= config.maxTargets) {
      skippedRequests.push(skippedRequest(normalized, skipReasons.targetLimit, profile.id));
      continue;
    }

    seen.add(key);
    targets.push({
      ...normalized,
      parsedBody,
      profile: profile.id,
      mutationKinds: profile.mutationKinds
    });
  }

  return {
    targets,
    skippedRequests
  };
}

export function buildTamperCases(requestEntry, options = {}) {
  const config = { ...defaultOptions, ...options };
  const body = requestEntry?.parsedBody?.value || parseRequestBody(requestEntry).value;
  if (!isObject(body)) {
    return [];
  }

  const profile = requestEntry.profile || detectProfile(body, requestEntry)?.id || 'generic-safe';
  const cases = [];
  for (const [field, value] of Object.entries(body)) {
    for (const mutation of mutationsForField(field, value, profile)) {
      cases.push({
        id: `${field}-${mutation.id}`,
        field,
        mutationCategory: mutation.category,
        originalValue: summarizeValue(value),
        tamperedValue: mutation.value,
        payload: mutation.label,
        body: {
          ...body,
          [field]: mutation.value
        }
      });
    }
  }

  return cases.slice(0, config.maxAttemptsPerTarget);
}

export function mapBodyFieldsToActions(body, actions = []) {
  const mappings = {};
  if (!isObject(body)) {
    return mappings;
  }

  for (const [field, value] of Object.entries(body)) {
    mappings[field] = mapSingleFieldToAction(field, value, actions);
  }

  return mappings;
}

export function safeReplayHeaders(headers = {}) {
  const allowed = {};
  for (const [name, value] of Object.entries(headers || {})) {
    const lower = name.toLowerCase();
    if (['content-type', 'accept'].includes(lower)) {
      allowed[lower] = String(value);
    }
  }

  return {
    accept: allowed.accept || 'application/json',
    'content-type': 'application/json'
  };
}

export async function runRequestTamperingAudit({ page, responses, baseURL, actions = [], options = {} }) {
  const config = { ...defaultOptions, ...options, baseURL };
  const findings = [];
  const { targets: targetRequests, skippedRequests } = classifyTamperableRequests(responses, config);
  const attempts = [];
  const targets = [];

  for (const requestEntry of targetRequests) {
    const fieldMappings = mapBodyFieldsToActions(requestEntry.parsedBody.value, actions);
    const tamperCases = buildTamperCases(requestEntry, config);
    if (tamperCases.length === 0) {
      skippedRequests.push(skippedRequest(requestEntry, skipReasons.noMutableFields, requestEntry.profile));
      continue;
    }

    let attemptCount = 0;
    for (const tamperCase of tamperCases) {
      const mapping = fieldMappings[tamperCase.field] || unknownMapping();
      const attempt = await replayTamperedRequest(page, requestEntry, tamperCase, mapping);
      attempts.push(attempt);
      attemptCount += 1;

      const finding = evaluateTamperResponse(attempt);
      if (finding) {
        findings.push(finding);
      }
    }

    targets.push({
      method: requestEntry.method,
      url: requestEntry.url,
      path: requestEntry.path,
      profile: requestEntry.profile,
      fieldsTested: unique(tamperCases.map((testCase) => testCase.field)),
      attemptCount,
      requestBodyRedacted: Boolean(requestEntry.requestBodyRedacted),
      requestBodySensitive: Boolean(requestEntry.requestBodySensitive || requestEntry.parsedBody.sensitive)
    });
  }

  const allNetworkFailures = attempts.length > 0 && attempts.every((attempt) => attempt.networkError);
  if (allNetworkFailures) {
    findings.push(createFinding({
      id: 'request-tampering-setup-network-error',
      title: 'Request tampering setup failed',
      category: 'request-tampering',
      severity: 'medium',
      owasp: 'OWASP ASVS 5.1.4',
      evidence: attempts.map((attempt) => `${attempt.field}: ${attempt.networkError}`).join('\n'),
      reason: 'Tat ca request tampering deu loi network nen chua the ket luan server co validate hay khong.',
      risk: 'Security test khong co ket qua dang tin cay.',
      fix: 'Kiem tra demo server, baseURL, session/cookie va endpoint API truoc khi chay lai.'
    }));
  }

  return {
    findings,
    attempts,
    targets,
    skippedRequests,
    targetCount: targets.length,
    attemptCount: attempts.length
  };
}

export function evaluateTamperResponse(attempt) {
  if (attempt.networkError) {
    return null;
  }

  if (isRejectedResponse(attempt)) {
    return null;
  }

  const heuristic = ['authorization', 'object-access', 'generic'].includes(attempt.mutationCategory);
  return createFinding({
    id: heuristic ? 'request-tampering-heuristic-accepted' : 'request-tampering-accepted',
    title: heuristic ? 'Server accepted security-sensitive parameter change' : 'Server accepted tampered request parameter',
    category: 'request-tampering',
    severity: heuristic ? 'medium' : 'high',
    owasp: heuristic ? 'OWASP Top 10 A01:2021 Broken Access Control (possible risk)' : 'OWASP Top 10 A03:2021 Injection / Input Validation',
    cwe: heuristic ? 'CWE-639 Authorization Bypass Through User-Controlled Key' : 'CWE-20 Improper Input Validation',
    url: attempt.url,
    status: attempt.status,
    actionId: authoritativeActionId(attempt),
    step: authoritativeActionId(attempt) ? attempt.step : null,
    payload: attempt.payload,
    evidence: [
      `Profile: ${attempt.profile}`,
      `Category: ${attempt.mutationCategory}`,
      `Field: ${attempt.field}`,
      `Original: ${attempt.originalValue}`,
      `Tampered: ${summarizeValue(attempt.tamperedValue)}`,
      `Mapping: ${attempt.mappingConfidence}${attempt.mappingEvidence ? ` (${attempt.mappingEvidence})` : ''}`,
      `Status: ${attempt.status}`,
      `Accepted: ${attempt.accepted}`,
      `Response: ${attempt.responsePreview || '-'}`
    ].join('\n'),
    reason: heuristic
      ? 'Server chap nhan thay doi parameter co tinh authorization/object-access. Day la tin hieu heuristic can verify thu cong, chua phai bang chung IDOR.'
      : 'Server chap nhan request da bi sua parameter thay vi reject bang validation.',
    risk: heuristic
      ? 'Neu field nay anh huong quyen truy cap hoac object ownership, co the dan den Broken Access Control.'
      : 'Nguoi dung co the bo qua UI va gui truc tiep gia tri khong hop le len API.',
    fix: heuristic
      ? 'Kiem tra authorization server-side theo user/session hien tai va khong tin vao ownerId/role/isAdmin/productId tu client.'
      : 'Validate whitelist va type tren server cho moi field, khong chi dua vao select/radio/checkbox tren UI.'
  });
}

export function redactObject(value) {
  if (!value || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(redactObject);
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      sensitiveKeyPattern.test(key) ? '[redacted]' : redactObject(child)
    ])
  );
}

async function replayTamperedRequest(page, requestEntry, tamperCase, mapping) {
  const url = requestEntry.url;
  const headers = safeReplayHeaders(requestEntry.requestHeaders);
  const actionId = ['exact', 'alias'].includes(mapping.confidence) ? mapping.actionId : null;
  try {
    const response = await page.request.fetch(url, {
      method: requestEntry.method,
      headers,
      data: tamperCase.body,
      failOnStatusCode: false,
      maxRedirects: 0
    });
    const responseText = await response.text().catch(() => '');
    const baseAttempt = {
      actionId,
      step: actionId ? mapping.description : null,
      method: requestEntry.method,
      url,
      path: requestEntry.path,
      profile: requestEntry.profile,
      mutationCategory: tamperCase.mutationCategory,
      field: tamperCase.field,
      originalValue: tamperCase.originalValue,
      tamperedValue: tamperCase.tamperedValue,
      payload: tamperCase.payload,
      status: response.status(),
      responsePreview: responseText.slice(0, 500),
      networkError: null,
      mappingConfidence: mapping.confidence,
      mappingEvidence: mapping.evidence || null
    };
    return {
      ...baseAttempt,
      accepted: !isRejectedResponse(baseAttempt)
    };
  } catch (error) {
    return {
      actionId,
      step: actionId ? mapping.description : null,
      method: requestEntry.method,
      url,
      path: requestEntry.path,
      profile: requestEntry.profile,
      mutationCategory: tamperCase.mutationCategory,
      field: tamperCase.field,
      originalValue: tamperCase.originalValue,
      tamperedValue: tamperCase.tamperedValue,
      payload: tamperCase.payload,
      status: null,
      responsePreview: '',
      networkError: error?.message || 'request failed',
      accepted: false,
      mappingConfidence: mapping.confidence,
      mappingEvidence: mapping.evidence || null
    };
  }
}

function normalizeRequestEntry(entry, baseURL) {
  const url = absoluteUrl(entry?.url, baseURL);
  return {
    ...entry,
    method: String(entry?.method || 'GET').toUpperCase(),
    url,
    path: pathFromUrl(url),
    requestHeaders: entry?.requestHeaders || {},
    requestBody: entry?.requestBody ?? entry?.body ?? null,
    requestBodyRedacted: Boolean(entry?.requestBodyRedacted),
    requestBodySensitive: Boolean(entry?.requestBodySensitive)
  };
}

function skipReasonForEntry(entry, config) {
  if (!unsafeMethods.has(entry.method)) {
    return skipReasons.unsupportedMethod;
  }

  if (!sameOriginOrLocal(entry.url, config.baseURL)) {
    return skipReasons.externalOrigin;
  }

  if (denylistedPathPattern.test(entry.path)) {
    return skipReasons.denylistedPath;
  }

  const parsedBody = parseRequestBody(entry);
  if (parsedBody.type === 'empty') {
    return skipReasons.emptyBody;
  }

  if (!parsedBody.parseable || parsedBody.type !== 'json' || !isObject(parsedBody.value)) {
    return skipReasons.unparseableBody;
  }

  if (entry.requestBodySensitive || parsedBody.sensitive || containsRedactedValue(parsedBody.value)) {
    return skipReasons.sensitiveBody;
  }

  return null;
}

function detectProfile(body) {
  if (!isObject(body)) {
    return null;
  }

  const fields = new Set(Object.keys(body));
  if (hasAny(fields, ['cart', 'shippingMethod', 'paymentMethod', 'postalCode', 'productId', 'quantity', 'price'])) {
    return {
      id: 'order-like',
      replayEnabled: true,
      mutationKinds: ['validation', 'authorization', 'object-access']
    };
  }

  if (hasAny(fields, ['metadata', 'actions', 'session', 'testCase'])) {
    return {
      id: 'recording-like',
      replayEnabled: false,
      mutationKinds: []
    };
  }

  return {
    id: 'generic-safe',
    replayEnabled: false,
    mutationKinds: ['generic']
  };
}

function mutationsForField(field, value, profile) {
  if (profile === 'generic-safe') {
    return genericMutationsForField(field, value);
  }

  if (field === 'shippingMethod') {
    return [{ id: 'invalid-enum', category: 'validation', label: 'invalid shipping enum', value: '__tampered_shipping__' }];
  }

  if (field === 'paymentMethod') {
    return [{ id: 'invalid-enum', category: 'validation', label: 'invalid payment enum', value: '__tampered_payment__' }];
  }

  if (field === 'superiorEmployee') {
    return [{ id: 'invalid-enum', category: 'validation', label: 'invalid select2 employee id', value: 'employee-999' }];
  }

  if (field === 'facePhoto') {
    return [
      { id: 'invalid-array-value', category: 'validation', label: 'unexpected multiselect option', value: ['999'] },
      { id: 'oversized-array', category: 'validation', label: 'oversized multiselect array', value: ['1', '0', '999'] }
    ];
  }

  if (field === 'giftWrap') {
    return [{ id: 'invalid-boolean', category: 'validation', label: 'checkbox boolean tampered to string', value: 'yes' }];
  }

  if (field === 'cart') {
    return [{ id: 'invalid-item', category: 'object-access', label: 'unexpected cart item id', value: ['admin-only-product'] }];
  }

  if (['productId', 'orderId'].includes(field)) {
    return [{ id: 'object-id-swap', category: 'object-access', label: 'object id changed to another object', value: field === 'orderId' ? 'ORD-000000' : 'admin-only-product' }];
  }

  if (['userId', 'ownerId', 'accountId', 'employeeId', 'tenantId'].includes(field)) {
    return [{ id: 'owner-swap', category: 'authorization', label: 'owner identifier changed', value: 'user-999' }];
  }

  if (field === 'role') {
    return [{ id: 'role-escalation', category: 'authorization', label: 'role changed to admin', value: 'admin' }];
  }

  if (field === 'isAdmin') {
    return [{ id: 'admin-toggle', category: 'authorization', label: 'isAdmin changed to true', value: true }];
  }

  if (field === 'price') {
    return [{ id: 'price-zero', category: 'object-access', label: 'price changed to zero', value: 0 }];
  }

  if (field === 'quantity') {
    return [{ id: 'quantity-negative', category: 'validation', label: 'quantity changed to negative number', value: -1 }];
  }

  if (typeof value === 'string') {
    return [{ id: 'oversized-string', category: 'validation', label: 'oversized string', value: 'A'.repeat(300) }];
  }

  return [];
}

function genericMutationsForField(field, value) {
  if (typeof value === 'string') {
    return [{ id: 'generic-string', category: 'generic', label: 'generic string marker', value: '__tampered_generic__' }];
  }

  if (typeof value === 'number') {
    return [{ id: 'generic-number', category: 'generic', label: 'generic number boundary', value: -1 }];
  }

  if (typeof value === 'boolean') {
    return [{ id: 'generic-boolean', category: 'generic', label: 'generic boolean flip', value: !value }];
  }

  if (Array.isArray(value)) {
    return [{ id: 'generic-array', category: 'generic', label: 'generic array unexpected value', value: [...value, '__tampered_generic__'] }];
  }

  return [];
}

function mapSingleFieldToAction(field, value, actions) {
  const normalizedField = normalizeToken(field);
  const aliasTokens = aliasesForField(field).map(normalizeToken);

  for (const action of actions) {
    const haystack = actionHaystack(action);
    if (haystack.includes(normalizedField)) {
      return mapping(action, 'exact', `field name "${field}" matched action selector/text`);
    }
  }

  for (const action of actions) {
    const haystack = actionHaystack(action);
    if (aliasTokens.some((alias) => alias && haystack.includes(alias))) {
      return mapping(action, 'alias', `field alias for "${field}" matched action selector/text`);
    }
  }

  for (const action of actions) {
    if (value != null && String(action.value ?? '') === String(value)) {
      return mapping(action, 'value', `recorded value matched body field "${field}"`);
    }
  }

  return unknownMapping();
}

function mapping(action, confidence, evidence) {
  return {
    actionId: action.id,
    description: action.description,
    confidence,
    evidence
  };
}

function unknownMapping() {
  return {
    actionId: null,
    description: null,
    confidence: 'unknown',
    evidence: null
  };
}

function actionHaystack(action) {
  return normalizeToken([
    action.id,
    action.description,
    action.targetText,
    action.controlType,
    action.selectors?.testId,
    action.selectors?.id,
    action.primarySelector?.value || action.primarySelector
  ].filter(Boolean).join(' '));
}

function aliasesForField(field) {
  const aliases = {
    fullName: ['full name', 'name'],
    postalCode: ['postal code', 'zip'],
    cart: ['cart', 'add to cart', 'product'],
    shippingMethod: ['shipping method', 'shipping'],
    paymentMethod: ['payment method', 'payment'],
    superiorEmployee: ['superior employee', 'employee'],
    facePhoto: ['face photo'],
    giftWrap: ['gift wrap'],
    deliveryNote: ['delivery note', 'note']
  };

  return aliases[field] || [];
}

function isRejectedResponse(attempt) {
  if (typeof attempt.status === 'number' && attempt.status >= 400) {
    return true;
  }

  const parsed = parseJson(attempt.responsePreview);
  if (!parsed) {
    return false;
  }

  return parsed.ok === false || typeof parsed.error === 'string';
}

function authoritativeActionId(attempt) {
  return ['exact', 'alias'].includes(attempt.mappingConfidence) ? attempt.actionId : null;
}

function skippedRequest(entry, reason, profile = null) {
  return {
    method: entry.method || 'GET',
    url: entry.url || '',
    path: entry.path || pathFromUrl(entry.url),
    profile,
    reason
  };
}

function sameOriginOrLocal(value, baseURL) {
  try {
    const url = new URL(value, baseURL || undefined);
    if (['localhost', '127.0.0.1'].includes(url.hostname)) {
      return true;
    }

    return baseURL ? url.origin === new URL(baseURL).origin : false;
  } catch {
    return false;
  }
}

function absoluteUrl(value, baseURL) {
  try {
    return new URL(String(value), baseURL || undefined).href;
  } catch {
    return String(value || '');
  }
}

function pathFromUrl(value) {
  try {
    return new URL(value).pathname || '/';
  } catch {
    return '/';
  }
}

function containsSensitiveValue(value) {
  if (!value || typeof value !== 'object') {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some(containsSensitiveValue);
  }

  return Object.entries(value).some(([key, child]) => sensitiveKeyPattern.test(key) || containsSensitiveValue(child));
}

function containsRedactedValue(value) {
  if (!value || typeof value !== 'object') {
    return value === '[redacted]';
  }

  if (Array.isArray(value)) {
    return value.some(containsRedactedValue);
  }

  return Object.values(value).some(containsRedactedValue);
}

function hasAny(fields, expectedFields) {
  return expectedFields.some((field) => fields.has(field));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function looksLikeJson(value) {
  return /^\s*[\[{]/.test(value);
}

function headerValue(headers = {}, expectedName) {
  const found = Object.entries(headers || {}).find(([name]) => name.toLowerCase() === expectedName.toLowerCase());
  return found ? String(found[1]) : '';
}

function summarizeValue(value) {
  const raw = typeof value === 'string' ? value : JSON.stringify(value);
  return raw.length > 120 ? `${raw.slice(0, 120)}...[truncated]` : raw;
}

function normalizeToken(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
