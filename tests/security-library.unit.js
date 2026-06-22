import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { runSecurityRules, rulesForChecks } from '../src/security/core/rule-registry.js';
import { responseSecurityRules } from '../src/security/rules/index.js';
import { auditDataExposure } from '../src/security/rules/data-exposure-rule.js';
import { auditResponseCookies } from '../src/security/rules/session-cookie-rule.js';
import { auditSecurityHeaders } from '../src/security/rules/security-headers-rule.js';
import { formatSecurityFindings } from '../src/security/playwright-security-runner.js';
import {
  createSecurityReport,
  addSecurityReportResult,
  writeSecurityReport
} from '../src/security/security-report.js';
import {
  buildTamperCases,
  classifyTamperableRequests,
  evaluateTamperResponse,
  findTamperableRequests,
  mapBodyFieldsToActions,
  parseRequestBody,
  runRequestTamperingAudit,
  safeReplayHeaders
} from '../src/security/request-tampering.js';
import {
  evaluateObjectAccessProof,
  extractLatestOrderProofTarget
} from '../src/security/object-access-proof.js';

const missingHeaderFindings = auditSecurityHeaders({
  url: 'http://localhost:4173/login',
  status: 200,
  headers: {
    'content-type': 'text/html'
  }
});

assert.ok(missingHeaderFindings.some((finding) => finding.id === 'content-security-policy'));
assert.ok(missingHeaderFindings.some((finding) => finding.id === 'x-content-type-options'));

const safeHeaderFindings = auditSecurityHeaders({
  url: 'http://localhost:4173/login',
  status: 200,
  headers: {
    'content-security-policy': "default-src 'self'; frame-ancestors 'none'",
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'cross-origin-opener-policy': 'same-origin',
    'cross-origin-resource-policy': 'same-origin'
  }
});

assert.equal(safeHeaderFindings.length, 0);
assert.match(formatSecurityFindings(missingHeaderFindings), /Phat hien/);

const cookieFindings = auditResponseCookies({
  url: 'https://example.test/login',
  status: 200,
  headers: {
    'set-cookie': 'sessionId=abc123; Path=/'
  }
});
assert.ok(cookieFindings.some((finding) => finding.id === 'cookie-missing-httponly'));
assert.ok(cookieFindings.some((finding) => finding.id === 'cookie-missing-samesite'));
assert.ok(cookieFindings.some((finding) => finding.id === 'cookie-missing-secure'));

const exposureFindings = auditDataExposure({
  url: 'http://localhost:4173/api?token=abc',
  status: 200,
  headers: {
    'x-powered-by': 'Express'
  },
  body: 'Error: stack trace at app.js:1'
});
assert.ok(exposureFindings.some((finding) => finding.id === 'sensitive-data-in-url'));
assert.ok(exposureFindings.some((finding) => finding.id === 'server-technology-disclosure'));
assert.ok(exposureFindings.some((finding) => finding.id === 'response-leaks-stack-trace'));

const selectedRules = rulesForChecks(responseSecurityRules, ['headers', 'cookies']);
assert.deepEqual(selectedRules.map((rule) => rule.id), ['security-headers', 'session-cookie-security']);

const registryFindings = await runSecurityRules({
  rules: selectedRules,
  context: {
    scopes: ['response'],
    responses: [
      {
        url: 'http://localhost:4173/',
        status: 200,
        headers: {}
      }
    ]
  }
});
assert.ok(registryFindings.some((finding) => finding.category === 'headers'));

const parsedJsonBody = parseRequestBody({
  requestHeaders: {
    'content-type': 'application/json'
  },
  requestBody: '{"fullName":"Luong Huy","token":"secret-value"}'
});
assert.equal(parsedJsonBody.parseable, true);
assert.equal(parsedJsonBody.value.token, '[redacted]');

const parsedFormBody = parseRequestBody({
  requestHeaders: {
    'content-type': 'application/x-www-form-urlencoded'
  },
  requestBody: 'fullName=Luong+Huy&postalCode=5005112'
});
assert.equal(parsedFormBody.type, 'form');
assert.equal(parsedFormBody.value.fullName, 'Luong Huy');

const orderRequest = {
  method: 'POST',
  url: 'http://localhost:4173/api/orders',
  requestHeaders: {
    'content-type': 'application/json',
    cookie: 'session=abc',
    authorization: 'Bearer abc'
  },
  requestBody: JSON.stringify({
    fullName: 'Luong Huy',
    postalCode: '5005112',
    shippingMethod: 'pickup',
    superiorEmployee: 'employee-20',
    facePhoto: ['1'],
    paymentMethod: 'bank',
    giftWrap: true,
    deliveryNote: '20/06/2026',
    cart: ['bento-laptop-stand']
  })
};

const tamperTargets = findTamperableRequests([orderRequest], { baseURL: 'http://localhost:4173' });
assert.equal(tamperTargets.length, 1);
assert.equal(tamperTargets[0].profile, 'order-like');

const tamperCases = buildTamperCases(tamperTargets[0]);
assert.ok(tamperCases.some((testCase) => testCase.field === 'shippingMethod' && testCase.tamperedValue === '__tampered_shipping__'));
assert.ok(tamperCases.some((testCase) => testCase.field === 'giftWrap' && testCase.tamperedValue === 'yes'));
assert.ok(tamperCases.some((testCase) => testCase.field === 'facePhoto' && Array.isArray(testCase.tamperedValue)));
assert.ok(tamperCases.every((testCase) => ['validation', 'authorization', 'object-access'].includes(testCase.mutationCategory)));

const replayHeaders = safeReplayHeaders(orderRequest.requestHeaders);
assert.deepEqual(replayHeaders, {
  accept: 'application/json',
  'content-type': 'application/json'
});

assert.equal(evaluateTamperResponse({
  status: 400,
  responsePreview: '{"ok":false,"error":"Invalid shipping method."}'
}), null);

const acceptedFinding = evaluateTamperResponse({
  url: 'http://localhost:4173/api/orders',
  field: 'shippingMethod',
  originalValue: 'pickup',
  tamperedValue: '__tampered_shipping__',
  payload: 'invalid shipping enum',
  status: 200,
  responsePreview: '{"ok":true}'
});
assert.equal(acceptedFinding.id, 'request-tampering-accepted');
assert.equal(acceptedFinding.severity, 'high');

const heuristicFinding = evaluateTamperResponse({
  url: 'http://localhost:4173/api/orders',
  profile: 'order-like',
  mutationCategory: 'object-access',
  field: 'cart',
  originalValue: '["bento-laptop-stand"]',
  tamperedValue: ['admin-only-product'],
  payload: 'unexpected cart item id',
  mappingConfidence: 'unknown',
  status: 200,
  accepted: true,
  responsePreview: '{"ok":true}'
});
assert.equal(heuristicFinding.id, 'request-tampering-heuristic-accepted');
assert.equal(heuristicFinding.severity, 'medium');
assert.equal(heuristicFinding.actionId, null);

const classified = classifyTamperableRequests([
  orderRequest,
  {
    method: 'POST',
    url: 'https://example.com/api/orders',
    requestHeaders: {
      'content-type': 'application/json'
    },
    requestBody: '{"shippingMethod":"pickup"}'
  },
  {
    method: 'GET',
    url: 'http://localhost:4173/api/orders',
    requestHeaders: {},
    requestBody: null
  },
  {
    method: 'POST',
    url: 'http://localhost:4173/api/login',
    requestHeaders: {
      'content-type': 'application/json'
    },
    requestBody: '{"username":"standard_user"}'
  },
  {
    method: 'POST',
    url: 'http://localhost:4173/api/orders',
    requestHeaders: {
      'content-type': 'application/json'
    },
    requestBody: '{"token":"[redacted]","shippingMethod":"pickup"}',
    requestBodyRedacted: true,
    requestBodySensitive: true
  },
  {
    method: 'POST',
    url: 'http://localhost:4173/api/recordings',
    requestHeaders: {
      'content-type': 'application/json'
    },
    requestBody: '{"metadata":{"schemaVersion":1},"actions":[],"session":{}}'
  },
  {
    method: 'POST',
    url: 'http://localhost:4173/api/profile',
    requestHeaders: {
      'content-type': 'application/json'
    },
    requestBody: '{"displayName":"Huy"}'
  }
], { baseURL: 'http://localhost:4173' });
assert.equal(classified.targets.length, 1);
assert.ok(classified.skippedRequests.some((request) => request.reason === 'external-origin'));
assert.ok(classified.skippedRequests.some((request) => request.reason === 'unsupported-method'));
assert.ok(classified.skippedRequests.some((request) => request.reason === 'denylisted-path'));
assert.ok(classified.skippedRequests.some((request) => request.reason === 'sensitive-body'));
assert.ok(classified.skippedRequests.some((request) => request.reason === 'replay-disabled-profile' && request.profile === 'recording-like'));
assert.ok(classified.skippedRequests.some((request) => request.reason === 'replay-disabled-profile' && request.profile === 'generic-safe'));

const limited = classifyTamperableRequests([orderRequest, {
  ...orderRequest,
  url: 'http://localhost:4173/api/orders/2',
  requestBody: orderRequest.requestBody.replace('pickup', 'express')
}], { baseURL: 'http://localhost:4173', maxTargets: 1 });
assert.equal(limited.targets.length, 1);
assert.ok(limited.skippedRequests.some((request) => request.reason === 'target-limit'));

const mappings = mapBodyFieldsToActions({
  fullName: 'Luong Huy',
  postalCode: '5005112',
  unknownField: '5005112'
}, [
  {
    id: 'act-name',
    description: 'Input "Luong Huy" into Full name field',
    selectors: {
      testId: '[data-testid="full-name-input"]'
    },
    value: 'Luong Huy'
  },
  {
    id: 'act-postal',
    description: 'Input "5005112" into Postal code field',
    selectors: {
      testId: '[data-testid="postal-code-input"]'
    },
    value: '5005112'
  }
]);
assert.equal(mappings.fullName.confidence, 'exact');
assert.equal(mappings.postalCode.confidence, 'exact');
assert.equal(mappings.unknownField.confidence, 'value');

const auditResult = await runRequestTamperingAudit({
  page: {
    request: {
      fetch: async () => ({
        status: () => 400,
        text: async () => '{"ok":false,"error":"Invalid"}'
      })
    }
  },
  responses: [orderRequest],
  baseURL: 'http://localhost:4173',
  actions: []
});
assert.equal(auditResult.targetCount, 1);
assert.ok(auditResult.attemptCount > 0);
assert.ok(Array.isArray(auditResult.targets));
assert.ok(Array.isArray(auditResult.attempts));
assert.ok(Array.isArray(auditResult.skippedRequests));
assert.equal(auditResult.findings.length, 0);

const proofTarget = extractLatestOrderProofTarget([
  {
    method: 'POST',
    url: 'http://localhost:4173/api/orders',
    body: '{"ok":true,"orderId":"ORD-123"}'
  }
]);
assert.equal(proofTarget.ok, true);
assert.equal(proofTarget.target.orderId, 'ORD-123');

const missingProofTarget = extractLatestOrderProofTarget([]);
assert.equal(missingProofTarget.ok, false);
assert.equal(missingProofTarget.setupIssue, 'missing-order-id');

assert.equal(evaluateObjectAccessProof({
  victimUserId: 'alice',
  attackerUserId: 'bob',
  orderId: 'ORD-123',
  path: '/api/orders/ORD-123',
  status: 403,
  expectedStatus: 403,
  responsePreview: '{"ok":false}'
}), null);

const objectAccessFinding = evaluateObjectAccessProof({
  victimUserId: 'alice',
  attackerUserId: 'bob',
  requestedAs: 'bob',
  orderId: 'ORD-123',
  path: '/api/orders/ORD-123',
  status: 200,
  expectedStatus: 403,
  responsePreview: '{"ok":true}'
});
assert.equal(objectAccessFinding.id, 'object-access-cross-user-accepted');
assert.equal(objectAccessFinding.severity, 'high');

assert.equal(evaluateObjectAccessProof({
  victimUserId: 'alice',
  requestedAs: 'anonymous',
  orderId: 'ORD-123',
  path: '/api/orders/ORD-123',
  status: 401,
  expectedStatus: 401,
  responsePreview: '{"ok":false}'
}), null);

assert.equal(evaluateObjectAccessProof({
  victimUserId: 'alice',
  requestedAs: 'anonymous',
  orderId: 'ORD-123',
  path: '/api/orders/ORD-123',
  status: 403,
  expectedStatus: 401,
  responsePreview: '{"ok":false}'
}), null);

const anonymousFinding = evaluateObjectAccessProof({
  victimUserId: 'alice',
  requestedAs: 'anonymous',
  orderId: 'ORD-123',
  path: '/api/orders/ORD-123',
  status: 200,
  expectedStatus: 401,
  responsePreview: '{"ok":true}'
});
assert.equal(anonymousFinding.id, 'object-access-anonymous-accepted');

const missingOrderFinding = evaluateObjectAccessProof({
  victimUserId: 'alice',
  attackerUserId: 'bob',
  orderId: 'ORD-missing',
  path: '/api/orders/ORD-missing',
  status: 404,
  expectedStatus: 403,
  responsePreview: '{"ok":false}'
});
assert.equal(missingOrderFinding.id, 'object-access-proof-setup-failed');

const missingIdFinding = evaluateObjectAccessProof({
  setupIssue: 'missing-order-id'
});
assert.equal(missingIdFinding.id, 'object-access-proof-setup-failed');

const htmlReport = createSecurityReport({
  source: 'unit-test',
  checks: ['request-tampering', 'object-access'],
  testCaseName: 'Report Renderer Unit'
});
addSecurityReportResult(htmlReport, {
  type: 'request-tampering',
  name: 'POST /api/orders',
  targets: [{
    method: 'POST',
    path: '/api/orders',
    profile: 'order-like',
    fieldsTested: ['shippingMethod'],
    attemptCount: 1,
    requestBodySensitive: false
  }],
  attempts: [{
    field: 'shippingMethod',
    mutationCategory: 'validation',
    payload: 'invalid enum',
    status: 400,
    accepted: false,
    mappingConfidence: 'exact',
    actionId: 'act-010',
    responsePreview: '<script>alert(1)</script>'
  }],
  skippedRequests: [{
    method: 'POST',
    path: '/api/demo/login',
    reason: 'denylisted-path'
  }],
  findings: [{
    id: 'unit-finding',
    severity: 'high',
    category: 'unit',
    owasp: 'OWASP TEST',
    evidence: '<img src=x onerror=alert(1)>',
    reason: 'Renderer escaping test.',
    fix: 'Escape HTML.'
  }]
});
addSecurityReportResult(htmlReport, {
  type: 'object-access-proof',
  name: 'GET /api/orders/ORD-123',
  target: {
    orderId: 'ORD-123',
    victimUserId: 'alice',
    path: '/api/orders/ORD-123'
  },
  attempt: {
    victimUserId: 'alice',
    attackerUserId: 'bob',
    requestedAs: 'bob',
    orderId: 'ORD-123',
    expectedStatus: 403,
    status: 403,
    classification: 'blocked',
    responsePreview: '{"ok":false}'
  },
  attempts: [
    {
      victimUserId: 'alice',
      attackerUserId: 'bob',
      requestedAs: 'bob',
      orderId: 'ORD-123',
      expectedStatus: 403,
      status: 403,
      classification: 'blocked',
      responsePreview: '{"ok":false}'
    },
    {
      victimUserId: 'alice',
      requestedAs: 'anonymous',
      orderId: 'ORD-123',
      expectedStatus: 401,
      status: 401,
      classification: 'blocked',
      responsePreview: '{"ok":false}'
    }
  ],
  findings: []
});
const reportDir = 'artifacts/test-security-report';
const reportPaths = await writeSecurityReport(htmlReport, reportDir);
const reportHtml = await fs.readFile(reportPaths.htmlPath, 'utf8');
assert.match(reportHtml, /Tampering Targets/);
assert.match(reportHtml, /Tampering Attempts/);
assert.match(reportHtml, /Skipped Requests/);
assert.match(reportHtml, /Object Access Proof/);
assert.match(reportHtml, /anonymous/);
assert.match(reportHtml, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
assert.match(reportHtml, /&lt;img src=x onerror=alert\(1\)&gt;/);

console.log('Security library tests passed.');
