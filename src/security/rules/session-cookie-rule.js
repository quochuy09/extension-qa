import { createFinding } from '../core/finding.js';

const sessionCookiePattern = /session|sid|auth|token|jwt/i;

export const sessionCookieRule = {
  id: 'session-cookie-security',
  check: 'cookies',
  category: 'session',
  appliesTo: ['response'],
  run({ responses = [] }) {
    return responses.flatMap(auditResponseCookies);
  }
};

export function auditResponseCookies(response) {
  const setCookieHeaders = setCookieValues(response.headers);
  const findings = [];

  for (const cookie of setCookieHeaders) {
    const cookieName = cookie.split('=')[0] || 'cookie';
    if (!sessionCookiePattern.test(cookieName)) {
      continue;
    }

    const lowerCookie = cookie.toLowerCase();
    if (!lowerCookie.includes('httponly')) {
      findings.push(cookieFinding({
        id: 'cookie-missing-httponly',
        title: 'Session cookie missing HttpOnly',
        response,
        cookieName,
        evidence: cookie,
        reason: 'Session-like cookie khong co HttpOnly.',
        risk: 'JavaScript co the doc cookie neu co XSS.',
        fix: 'Them HttpOnly vao session cookie.'
      }));
    }

    if (!lowerCookie.includes('samesite=')) {
      findings.push(cookieFinding({
        id: 'cookie-missing-samesite',
        title: 'Session cookie missing SameSite',
        response,
        cookieName,
        evidence: cookie,
        reason: 'Session-like cookie khong co SameSite.',
        risk: 'Tang rui ro CSRF trong mot so flow state-changing.',
        fix: 'Them SameSite=Lax hoac SameSite=Strict tuy theo business flow.'
      }));
    }

    if (String(response.url || '').startsWith('https://') && !lowerCookie.includes('secure')) {
      findings.push(cookieFinding({
        id: 'cookie-missing-secure',
        title: 'Session cookie missing Secure',
        response,
        cookieName,
        evidence: cookie,
        reason: 'Session-like cookie tren HTTPS khong co Secure.',
        risk: 'Cookie co the bi gui qua ket noi khong an toan neu downgrade/misconfig.',
        fix: 'Them Secure vao session cookie tren HTTPS.'
      }));
    }
  }

  return findings;
}

function cookieFinding({ id, title, response, cookieName, evidence, reason, risk, fix }) {
  return createFinding({
    id,
    title,
    category: 'session',
    severity: 'medium',
    owasp: 'OWASP ASVS 3.4.2',
    cwe: 'CWE-614',
    url: response.url,
    status: response.status,
    evidence: redactCookieValue(evidence),
    reason,
    risk,
    fix,
    payload: cookieName
  });
}

function setCookieValues(headers = {}) {
  const value = headers['set-cookie'] || headers['Set-Cookie'];
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [String(value)];
}

function redactCookieValue(cookie) {
  return String(cookie).replace(/=([^;]+)/, '=[redacted]');
}
