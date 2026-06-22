import fs from 'node:fs/promises';
import path from 'node:path';

export function createSecurityReport({ source, checks, testCaseName }) {
  return {
    generatedAt: new Date().toISOString(),
    source,
    checks,
    testCaseName,
    results: []
  };
}

export function addSecurityReportResult(report, result) {
  report.results.push({
    timestamp: new Date().toISOString(),
    ...result
  });
}

export async function writeSecurityReport(report, outputDir = 'artifacts') {
  await fs.mkdir(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, 'security-report.json');
  const htmlPath = path.join(outputDir, 'security-report.html');
  await fs.writeFile(jsonPath, `${JSON.stringify(summaryForReport(report), null, 2)}\n`, 'utf8');
  await fs.writeFile(htmlPath, renderSecurityReportHtml(report), 'utf8');
  return { jsonPath, htmlPath };
}

export function summaryForReport(report) {
  const total = report.results.length;
  const failed = report.results.filter((result) => result.findings?.length > 0 || result.status === 'failed').length;
  return {
    ...report,
    summary: {
      total,
      passed: total - failed,
      failed
    }
  };
}

function renderSecurityReportHtml(report) {
  const summary = summaryForReport(report).summary;
  const rows = report.results.map((result) => {
    const findings = result.findings || [];
    const categories = unique(findings.map((finding) => finding.category)).join(', ') || '-';
    const severities = unique(findings.map((finding) => finding.severity)).join(', ') || '-';
    const standards = unique(findings.flatMap((finding) => [finding.owasp, finding.cwe]).filter(Boolean)).join('\n') || '-';
    const fixes = unique(findings.map((finding) => finding.fix).filter(Boolean)).join('\n') || '-';
    return `<tr>
      <td>${escapeHtml(result.type || '-')}</td>
      <td>${escapeHtml(result.name || result.action || '-')}</td>
      <td class="${findings.length > 0 || result.status === 'failed' ? 'fail' : 'pass'}">${findings.length > 0 || result.status === 'failed' ? 'FAIL' : 'PASS'}</td>
      <td>${escapeHtml(categories)}</td>
      <td>${escapeHtml(severities)}</td>
      <td>${escapeHtml(standards)}</td>
      <td>${escapeHtml(result.payload?.id || result.payload || '-')}</td>
      <td>${escapeHtml(findings.map((finding) => `${finding.id}: ${finding.reason}`).join('\n') || '-')}</td>
      <td>${escapeHtml(fixes)}</td>
    </tr>`;
  }).join('');
  const details = report.results.map(renderResultDetails).filter(Boolean).join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Security Replay Report</title>
    <style>
      body { font-family: Arial, Helvetica, sans-serif; margin: 32px; color: #18202a; }
      h1 { margin-bottom: 4px; }
      .muted { color: #637083; }
      .summary { display: flex; gap: 16px; margin: 20px 0; }
      .summary div { border: 1px solid #d7dee7; border-radius: 6px; padding: 10px 12px; }
      .detail { border: 1px solid #d7dee7; border-radius: 6px; margin-top: 18px; padding: 14px; }
      .detail h2 { font-size: 18px; margin: 0 0 8px; }
      .detail h3 { font-size: 15px; margin: 14px 0 6px; }
      .kv { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; margin: 8px 0; }
      .kv div { border: 1px solid #e4e9ef; border-radius: 4px; padding: 8px; background: #fbfcfd; }
      .snippet { max-height: 160px; overflow: auto; background: #f6f7f9; border: 1px solid #d7dee7; border-radius: 4px; padding: 8px; white-space: pre-wrap; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { border: 1px solid #d7dee7; padding: 8px; text-align: left; vertical-align: top; font-size: 14px; white-space: pre-wrap; }
      th { background: #f6f7f9; }
      .pass { color: #146c5f; font-weight: 700; }
      .fail { color: #a33a2b; font-weight: 700; }
    </style>
  </head>
  <body>
    <h1>Security Replay Report</h1>
    <p class="muted">${escapeHtml(report.testCaseName || 'Action log security replay')}</p>
    <p class="muted">Source: ${escapeHtml(report.source || '-')}</p>
    <p class="muted">Generated: ${escapeHtml(report.generatedAt)}</p>
    <div class="summary">
      <div>Total: <strong>${summary.total}</strong></div>
      <div>Passed: <strong>${summary.passed}</strong></div>
      <div>Failed: <strong>${summary.failed}</strong></div>
    </div>
    <table>
      <thead><tr><th>Type</th><th>Name</th><th>Status</th><th>Category</th><th>Severity</th><th>OWASP/CWE</th><th>Payload</th><th>Findings</th><th>Fix</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="9">No security results.</td></tr>'}</tbody>
    </table>
    ${details}
  </body>
</html>`;
}

function renderResultDetails(result) {
  const sections = [
    renderRequestTamperingDetails(result),
    renderObjectAccessDetails(result),
    renderFindingDetails(result)
  ].filter(Boolean).join('');

  if (!sections) {
    return '';
  }

  return `<section class="detail">
    <h2>${escapeHtml(result.type || 'Result')}: ${escapeHtml(result.name || '-')}</h2>
    ${sections}
  </section>`;
}

function renderRequestTamperingDetails(result) {
  if (!Array.isArray(result.targets) && !Array.isArray(result.attempts) && !Array.isArray(result.skippedRequests)) {
    return '';
  }

  return [
    renderTargetsTable(result.targets || []),
    renderAttemptsTable(result.attempts || []),
    renderSkippedRequestsTable(result.skippedRequests || [])
  ].filter(Boolean).join('');
}

function renderObjectAccessDetails(result) {
  if (result.type !== 'object-access-proof' && !result.target && !result.attempt) {
    return '';
  }

  const target = result.target || {};
  const attempts = Array.isArray(result.attempts) && result.attempts.length > 0 ? result.attempts : [result.attempt].filter(Boolean);
  const attempt = attempts[0] || {};
  const rows = attempts.map((item) => `<tr>
    <td>${escapeHtml(item.requestedAs || item.attackerUserId || '-')}</td>
    <td>${escapeHtml(item.expectedStatus ?? '-')}</td>
    <td>${escapeHtml(item.status ?? '-')}</td>
    <td>${escapeHtml(item.classification || '-')}</td>
    <td>${escapeHtml(item.setupIssue || item.networkError || '-')}</td>
    <td>${escapeHtml(truncateForHtml(item.responsePreview || '-'))}</td>
  </tr>`).join('');
  return `<h3>Object Access Proof</h3>
    <div class="kv">
      <div><strong>Victim</strong><br>${escapeHtml(attempt.victimUserId || target.victimUserId || '-')}</div>
      <div><strong>Attempts</strong><br>${escapeHtml(attempts.length || 0)}</div>
      <div><strong>Order ID</strong><br>${escapeHtml(attempt.orderId || target.orderId || '-')}</div>
    </div>
    <table>
      <thead><tr><th>Requested As</th><th>Expected</th><th>Actual</th><th>Classification</th><th>Setup Issue</th><th>Response</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6">No object access attempts.</td></tr>'}</tbody>
    </table>`;
}

function renderFindingDetails(result) {
  const findings = result.findings || [];
  if (findings.length === 0) {
    return '';
  }

  return `<h3>Findings</h3>${findings.map((finding) => `<div class="snippet"><strong>${escapeHtml(finding.id)}</strong> [${escapeHtml(finding.severity || '-')}] ${escapeHtml(finding.owasp || '')} ${escapeHtml(finding.cwe || '')}
Reason: ${escapeHtml(finding.reason || '-')}
Evidence: ${escapeHtml(truncateForHtml(finding.evidence || '-'))}
Fix: ${escapeHtml(finding.fix || '-')}</div>`).join('')}`;
}

function renderTargetsTable(targets) {
  if (targets.length === 0) {
    return '';
  }

  return `<h3>Tampering Targets</h3><table>
    <thead><tr><th>Method</th><th>Path</th><th>Profile</th><th>Fields</th><th>Attempts</th><th>Sensitive</th></tr></thead>
    <tbody>${targets.map((target) => `<tr>
      <td>${escapeHtml(target.method || '-')}</td>
      <td>${escapeHtml(target.path || target.url || '-')}</td>
      <td>${escapeHtml(target.profile || '-')}</td>
      <td>${escapeHtml((target.fieldsTested || []).join(', ') || '-')}</td>
      <td>${escapeHtml(target.attemptCount ?? '-')}</td>
      <td>${escapeHtml(target.requestBodySensitive ? 'yes' : 'no')}</td>
    </tr>`).join('')}</tbody>
  </table>`;
}

function renderAttemptsTable(attempts) {
  if (attempts.length === 0) {
    return '';
  }

  return `<h3>Tampering Attempts</h3><table>
    <thead><tr><th>Field</th><th>Category</th><th>Payload</th><th>Status</th><th>Accepted</th><th>Mapping</th><th>Action</th><th>Response</th></tr></thead>
    <tbody>${attempts.map((attempt) => `<tr>
      <td>${escapeHtml(attempt.field || '-')}</td>
      <td>${escapeHtml(attempt.mutationCategory || '-')}</td>
      <td>${escapeHtml(attempt.payload || '-')}</td>
      <td>${escapeHtml(attempt.status ?? '-')}</td>
      <td>${escapeHtml(attempt.accepted ? 'yes' : 'no')}</td>
      <td>${escapeHtml(attempt.mappingConfidence || '-')}</td>
      <td>${escapeHtml(attempt.actionId || '-')}</td>
      <td>${escapeHtml(truncateForHtml(attempt.responsePreview || attempt.networkError || '-'))}</td>
    </tr>`).join('')}</tbody>
  </table>`;
}

function renderSkippedRequestsTable(skippedRequests) {
  if (skippedRequests.length === 0) {
    return '';
  }

  return `<h3>Skipped Requests</h3><table>
    <thead><tr><th>Method</th><th>Path</th><th>Profile</th><th>Reason</th></tr></thead>
    <tbody>${skippedRequests.map((request) => `<tr>
      <td>${escapeHtml(request.method || '-')}</td>
      <td>${escapeHtml(request.path || request.url || '-')}</td>
      <td>${escapeHtml(request.profile || '-')}</td>
      <td>${escapeHtml(request.reason || '-')}</td>
    </tr>`).join('')}</tbody>
  </table>`;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function truncateForHtml(value, maxLength = 700) {
  const raw = String(value ?? '');
  return raw.length > maxLength ? `${raw.slice(0, maxLength)}...[truncated]` : raw;
}
