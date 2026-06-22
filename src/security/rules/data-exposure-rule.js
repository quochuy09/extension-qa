import { createFinding } from '../core/finding.js';

const sensitiveBodyPatterns = [
  { id: 'response-leaks-password', pattern: /\b(password|passwd|pwd)\b\s*[:=]/i, label: 'password-like key' },
  { id: 'response-leaks-api-key', pattern: /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|secret)\b\s*[:=]/i, label: 'secret/token key' },
  { id: 'response-leaks-stack-trace', pattern: /(stack trace|traceback|at\s+[a-z0-9_.<>]+\s*\(|exception:|error:\s+at\s+)/i, label: 'stack trace or exception detail' }
];

const sensitiveQueryPattern = /(token|password|secret|api[_-]?key)=/i;
const sourceMapPattern = /\.map($|\?)/i;
const technologyHeaders = ['x-powered-by', 'server'];

export const dataExposureRule = {
  id: 'sensitive-data-exposure',
  check: 'data-exposure',
  category: 'data-exposure',
  appliesTo: ['response'],
  run({ responses = [] }) {
    return responses.flatMap(auditDataExposure);
  }
};

export function auditDataExposure(response) {
  return [
    ...auditBody(response),
    ...auditUrl(response),
    ...auditHeaders(response)
  ];
}

function auditBody(response) {
  const body = response.body || '';
  if (!body) {
    return [];
  }

  return sensitiveBodyPatterns
    .filter((item) => item.pattern.test(body))
    .map((item) => createFinding({
      id: item.id,
      title: 'Sensitive data pattern in response body',
      category: 'data-exposure',
      severity: item.id.includes('stack') ? 'medium' : 'high',
      owasp: 'OWASP Top 10 A02:2021 Cryptographic Failures',
      cwe: 'CWE-200',
      url: response.url,
      status: response.status,
      evidence: item.label,
      reason: `Response body co dau hieu chua ${item.label}.`,
      risk: 'Thong tin nhay cam hoac debug detail co the bi lo cho client.',
      fix: 'Khong tra secret/debug detail ra response; dung error handler va response DTO an toan.'
    }));
}

function auditUrl(response) {
  const findings = [];
  if (sensitiveQueryPattern.test(response.url || '')) {
    findings.push(createFinding({
      id: 'sensitive-data-in-url',
      title: 'Sensitive value appears in URL query',
      category: 'data-exposure',
      severity: 'high',
      owasp: 'OWASP Top 10 A02:2021 Cryptographic Failures',
      cwe: 'CWE-598',
      url: response.url,
      status: response.status,
      evidence: 'Sensitive query parameter name detected.',
      reason: 'URL query co ten parameter nhay cam nhu token/password/secret.',
      risk: 'URL co the bi ghi vao browser history, proxy log, server log, analytics.',
      fix: 'Khong dat secret trong query string; dung body hoac secure cookie phu hop.'
    }));
  }

  if (sourceMapPattern.test(response.url || '')) {
    findings.push(createFinding({
      id: 'source-map-exposed',
      title: 'Source map exposed',
      category: 'data-exposure',
      severity: 'low',
      owasp: 'OWASP ASVS 14.3.3',
      cwe: 'CWE-540',
      url: response.url,
      status: response.status,
      evidence: response.url,
      reason: 'Source map file duoc serve cho client.',
      risk: 'Source map co the lam lo source structure hoac comment/debug info.',
      fix: 'Khong publish source map len public production hoac gioi han truy cap.'
    }));
  }

  return findings;
}

function auditHeaders(response) {
  const headers = normalizeHeaders(response.headers);
  return technologyHeaders
    .filter((header) => headers[header])
    .map((header) => createFinding({
      id: 'server-technology-disclosure',
      title: 'Server technology disclosure',
      category: 'data-exposure',
      severity: 'info',
      owasp: 'OWASP ASVS 14.3.3',
      cwe: 'CWE-200',
      url: response.url,
      status: response.status,
      evidence: `${header}: ${headers[header]}`,
      reason: `Response header tiet lo cong nghe server qua ${header}.`,
      risk: 'Thong tin fingerprint co the giup attacker chon exploit phu hop.',
      fix: `An hoac giam chi tiet header ${header} neu khong can thiet.`
    }));
}

function normalizeHeaders(headers) {
  return Object.fromEntries(
    Object.entries(headers || {}).map(([key, value]) => [key.toLowerCase(), String(value).trim()])
  );
}
