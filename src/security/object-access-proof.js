import { createFinding } from './core/finding.js';

export function extractLatestOrderProofTarget(responses = []) {
  const orderResponses = [...responses]
    .reverse()
    .filter((entry) => entry.method === 'POST' && pathFromUrl(entry.url) === '/api/orders');

  for (const entry of orderResponses) {
    const parsed = parseJson(entry.body);
    if (parsed?.ok === true && parsed.orderId) {
      return {
        ok: true,
        target: {
          orderId: parsed.orderId,
          victimUserId: 'alice',
          method: 'GET',
          path: `/api/orders/${encodeURIComponent(parsed.orderId)}`,
          sourceUrl: entry.url
        }
      };
    }
  }

  return {
    ok: false,
    setupIssue: 'missing-order-id'
  };
}

export async function runObjectAccessProofAudit({ apiRequest, baseURL, responses }) {
  const targetResult = extractLatestOrderProofTarget(responses);
  if (!targetResult.ok) {
    const attempt = setupAttempt({
      target: null,
      requestedAs: 'setup',
      setupIssue: targetResult.setupIssue,
      responsePreview: 'Could not extract orderId from POST /api/orders response.'
    });
    return {
      target: null,
      attempt,
      attempts: [attempt],
      findings: [evaluateObjectAccessProof(attempt)]
    };
  }

  const target = targetResult.target;
  const attempts = [];
  const findings = [];
  try {
    attempts.push(await runAuthenticatedAttempt({ apiRequest, baseURL, target, userId: 'bob' }));
    attempts.push(await runAnonymousAttempt({ apiRequest, baseURL, target }));
  } catch (error) {
    attempts.push(setupAttempt({
      target,
      requestedAs: 'setup',
      setupIssue: 'network-error',
      networkError: error?.message || 'request failed'
    }));
  }

  for (const attempt of attempts) {
    const finding = evaluateObjectAccessProof(attempt);
    if (finding) {
      findings.push(finding);
    }
  }

  return {
    target,
    attempt: attempts[0] || null,
    attempts,
    findings
  };
}

export function evaluateObjectAccessProof(attempt) {
  if (!attempt?.orderId || attempt.setupIssue || attempt.networkError || attempt.status === 404) {
    return createFinding({
      id: 'object-access-proof-setup-failed',
      title: 'Object access proof setup failed',
      category: 'object-access',
      severity: 'medium',
      owasp: 'OWASP ASVS 4.1 Access Control',
      url: attempt?.path || null,
      status: attempt?.status ?? null,
      evidence: [
        `OrderId: ${attempt?.orderId || '-'}`,
        `Setup issue: ${attempt?.setupIssue || attempt?.networkError || 'missing-order-id'}`,
        `Status: ${attempt?.status ?? '-'}`,
        `Response: ${attempt?.responsePreview || '-'}`
      ].join('\n'),
      reason: 'Security proof khong lay duoc order hop le hoac endpoint tra ve setup status khong chung minh access control.',
      risk: 'Ket qua object-access khong dang tin cay cho den khi setup duoc sua.',
      fix: 'Kiem tra replay checkout, response orderId, demo login va endpoint GET /api/orders/:orderId.'
    });
  }

  if (attempt.requestedAs === 'anonymous' && [401, 403].includes(attempt.status)) {
    return null;
  }

  if (attempt.requestedAs !== 'anonymous' && attempt.status === 403) {
    return null;
  }

  if (attempt.status === 200) {
    const anonymous = attempt.requestedAs === 'anonymous';
    return createFinding({
      id: anonymous ? 'object-access-anonymous-accepted' : 'object-access-cross-user-accepted',
      title: anonymous ? 'Anonymous object access was accepted' : 'Cross-user object access was accepted',
      category: 'object-access',
      severity: 'high',
      owasp: 'OWASP Top 10 A01:2021 Broken Access Control',
      cwe: 'CWE-639 Authorization Bypass Through User-Controlled Key',
      url: attempt.path,
      status: attempt.status,
      evidence: [
        `Victim user: ${attempt.victimUserId}`,
        `Requested as: ${attempt.requestedAs || attempt.attackerUserId}`,
        `Attacker user: ${attempt.attackerUserId || '-'}`,
        `OrderId: ${attempt.orderId}`,
        `Expected status: ${attempt.expectedStatus}`,
        `Actual status: ${attempt.status}`,
        `Response: ${attempt.responsePreview || '-'}`
      ].join('\n'),
      reason: anonymous
        ? 'Request khong co session hop le van doc duoc object duoc bao ve.'
        : 'User khac co the doc object khong thuoc ve minh bang cach dung orderId cua user khac.',
      risk: 'Day la bang chung Broken Access Control/IDOR tren endpoint doc order.',
      fix: 'Kiem tra owner object tren server bang session hien tai truoc khi tra ve du lieu.'
    });
  }

  return createFinding({
    id: 'object-access-proof-unexpected-status',
    title: 'Object access proof returned unexpected status',
    category: 'object-access',
    severity: 'medium',
    owasp: 'OWASP ASVS 4.1 Access Control',
    url: attempt.path,
    status: attempt.status,
    evidence: [
      `OrderId: ${attempt.orderId}`,
      `Requested as: ${attempt.requestedAs || attempt.attackerUserId || '-'}`,
      `Expected status: ${attempt.expectedStatus}`,
      `Actual status: ${attempt.status}`,
      `Response: ${attempt.responsePreview || '-'}`
    ].join('\n'),
    reason: 'Endpoint khong tra ve status mong doi cho cross-user object access proof.',
    risk: 'Can review thu cong de xac dinh day la setup issue hay access-control issue.',
    fix: 'Dam bao endpoint tra 403 cho user khac, 404 cho object khong ton tai, va 200 chi cho owner.'
  });
}

async function runAuthenticatedAttempt({ apiRequest, baseURL, target, userId }) {
  let context = null;
  try {
    context = await apiRequest.newContext({ baseURL });
    const loginResponse = await context.post('/api/demo/login', {
      data: { userId },
      failOnStatusCode: false
    });

    if (!loginResponse.ok()) {
      return setupAttempt({
        target,
        requestedAs: userId,
        setupIssue: 'attacker-login-failed',
        status: loginResponse.status(),
        responsePreview: await loginResponse.text().catch(() => '')
      });
    }

    return await requestOrderRead(context, target, {
      requestedAs: userId,
      attackerUserId: userId,
      expectedStatus: 403
    });
  } finally {
    await context?.dispose().catch(() => {});
  }
}

async function runAnonymousAttempt({ apiRequest, baseURL, target }) {
  let context = null;
  try {
    context = await apiRequest.newContext({ baseURL });
    return await requestOrderRead(context, target, {
      requestedAs: 'anonymous',
      attackerUserId: null,
      expectedStatus: 401
    });
  } finally {
    await context?.dispose().catch(() => {});
  }
}

async function requestOrderRead(context, target, identity) {
  const proofResponse = await context.get(target.path, { failOnStatusCode: false });
  const status = proofResponse.status();
  return {
    victimUserId: target.victimUserId,
    attackerUserId: identity.attackerUserId,
    requestedAs: identity.requestedAs,
    orderId: target.orderId,
    method: target.method,
    path: target.path,
    status,
    expectedStatus: identity.expectedStatus,
    responsePreview: await proofResponse.text().catch(() => ''),
    networkError: null,
    setupIssue: status === 404 ? 'order-not-found' : null,
    classification: [401, 403].includes(status) ? 'blocked' : status === 200 ? 'accepted' : 'unexpected-status'
  };
}

function setupAttempt({ target, requestedAs, setupIssue, status = null, responsePreview = '', networkError = null }) {
  return {
    victimUserId: target?.victimUserId || 'alice',
    attackerUserId: requestedAs === 'anonymous' ? null : 'bob',
    requestedAs,
    orderId: target?.orderId || null,
    method: target?.method || 'GET',
    path: target?.path || null,
    status,
    expectedStatus: requestedAs === 'anonymous' ? 401 : 403,
    responsePreview,
    networkError,
    setupIssue,
    classification: 'setup-failed'
  };
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function pathFromUrl(value) {
  try {
    return new URL(value).pathname || '/';
  } catch {
    return '';
  }
}
