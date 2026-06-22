import { createFinding } from '../core/finding.js';

export const defaultSecurityHeaderPolicies = [
  {
    id: 'content-security-policy',
    header: 'content-security-policy',
    severity: 'high',
    owasp: 'OWASP ASVS 14.4.3',
    risk: 'Browser khong co CSP de giam nguy co XSS va content injection.',
    fix: "Them Content-Security-Policy, vi du: default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'."
  },
  {
    id: 'x-content-type-options',
    header: 'x-content-type-options',
    expected: 'nosniff',
    severity: 'medium',
    owasp: 'OWASP ASVS 14.4.4',
    risk: 'Browser co the MIME sniff va xu ly response sai content type.',
    fix: 'Them X-Content-Type-Options: nosniff.'
  },
  {
    id: 'anti-clickjacking',
    header: 'x-frame-options',
    severity: 'medium',
    owasp: 'OWASP ASVS 14.4.7',
    risk: 'Trang co the bi nhung vao iframe va bi clickjacking.',
    fix: "Dung CSP frame-ancestors 'none'/'self' hoac X-Frame-Options: DENY/SAMEORIGIN."
  },
  {
    id: 'referrer-policy',
    header: 'referrer-policy',
    expectedOneOf: ['no-referrer', 'same-origin', 'strict-origin', 'strict-origin-when-cross-origin'],
    severity: 'low',
    owasp: 'OWASP ASVS 14.4.5',
    risk: 'URL hoac query nhay cam co the bi ro ri qua Referer.',
    fix: 'Them Referrer-Policy: strict-origin-when-cross-origin hoac chinh sach chat hon.'
  },
  {
    id: 'permissions-policy',
    header: 'permissions-policy',
    severity: 'low',
    owasp: 'OWASP ASVS 14.4.6',
    risk: 'Browser features nhu camera, microphone, geolocation khong duoc gioi han ro rang.',
    fix: 'Them Permissions-Policy va tat capability khong dung, vi du: camera=(), microphone=(), geolocation=().'
  },
  {
    id: 'cross-origin-opener-policy',
    header: 'cross-origin-opener-policy',
    expectedOneOf: ['same-origin', 'same-origin-allow-popups'],
    severity: 'low',
    owasp: 'OWASP ASVS 14.4.6',
    risk: 'Trang khong tach browsing context ro rang, lam tang rui ro cross-origin interaction.',
    fix: 'Them Cross-Origin-Opener-Policy: same-origin neu ung dung khong can popup cross-origin.'
  },
  {
    id: 'cross-origin-resource-policy',
    header: 'cross-origin-resource-policy',
    expectedOneOf: ['same-origin', 'same-site'],
    severity: 'low',
    owasp: 'OWASP ASVS 14.4.6',
    risk: 'Tai nguyen co the bi doc/nhung boi origin khac tuy theo browser policy.',
    fix: 'Them Cross-Origin-Resource-Policy: same-origin hoac same-site cho tai nguyen nhay cam.'
  },
  {
    id: 'strict-transport-security',
    header: 'strict-transport-security',
    httpsOnly: true,
    severity: 'high',
    owasp: 'OWASP ASVS 14.4.2',
    risk: 'Ket noi HTTPS khong duoc ep su dung HSTS, de tang rui ro downgrade/SSL stripping.',
    fix: 'Tren HTTPS, them Strict-Transport-Security: max-age=31536000; includeSubDomains.'
  }
];

export function auditSecurityHeaders({ url, status, headers, policies = defaultSecurityHeaderPolicies }) {
  const normalizedHeaders = normalizeHeaders(headers);

  return policies
    .filter((policy) => !policy.httpsOnly || String(url || '').startsWith('https://'))
    .map((policy) => auditPolicy({ policy, normalizedHeaders, url, status }))
    .filter(Boolean);
}

export const securityHeadersRule = {
  id: 'security-headers',
  check: 'headers',
  category: 'headers',
  appliesTo: ['response'],
  run({ responses = [] }) {
    return responses.flatMap((response) => auditSecurityHeaders(response));
  }
};

function auditPolicy({ policy, normalizedHeaders, url, status }) {
  if (policy.id === 'anti-clickjacking') {
    return auditClickjacking({ policy, normalizedHeaders, url, status });
  }

  const actual = normalizedHeaders[policy.header];
  if (!actual) {
    return finding(policy, url, status, actual, `Response khong tra ve ${policy.header}.`);
  }

  if (policy.expected && actual.toLowerCase() !== policy.expected.toLowerCase()) {
    return finding(policy, url, status, actual, `${policy.header} phai bang "${policy.expected}".`);
  }

  if (policy.expectedOneOf && !policy.expectedOneOf.includes(actual.toLowerCase())) {
    return finding(policy, url, status, actual, `${policy.header} khong nam trong danh sach gia tri an toan.`);
  }

  return null;
}

function auditClickjacking({ policy, normalizedHeaders, url, status }) {
  const xFrameOptions = String(normalizedHeaders['x-frame-options'] || '').toLowerCase();
  const csp = String(normalizedHeaders['content-security-policy'] || '').toLowerCase();
  const hasSafeXFrameOptions = ['deny', 'sameorigin'].includes(xFrameOptions);
  const hasFrameAncestors = /frame-ancestors\s+('none'|'self'|https?:\/\/[^\s;]+)/.test(csp);

  if (!hasSafeXFrameOptions && !hasFrameAncestors) {
    return finding(policy, url, status, xFrameOptions || csp, 'Khong co X-Frame-Options an toan hoac CSP frame-ancestors.');
  }

  return null;
}

function finding(policy, url, status, actual, reason) {
  return createFinding({
    id: policy.id,
    title: `Missing or weak ${policy.header}`,
    category: 'headers',
    severity: policy.severity,
    owasp: policy.owasp,
    cwe: 'CWE-693',
    url,
    status,
    evidence: actual || '<missing>',
    reason,
    risk: policy.risk,
    fix: policy.fix
  });
}

function normalizeHeaders(headers) {
  return Object.fromEntries(
    Object.entries(headers || {}).map(([key, value]) => [key.toLowerCase(), String(value).trim()])
  );
}
