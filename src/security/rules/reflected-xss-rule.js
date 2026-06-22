export async function auditReflectedXss({ page, payload, responses = [], action = null }) {
  const findings = [];
  const marker = payload.marker;

  for (const response of responses) {
    const body = response.body || '';
    if (!body.includes(marker)) {
      continue;
    }

    findings.push({
      id: 'reflected-xss-response-marker',
      severity: 'high',
      owasp: 'OWASP Top 10 A03:2021 Injection',
      actionId: action?.id || null,
      step: action?.description || null,
      url: response.url,
      status: response.status,
      payload: payload.value,
      evidence: `Marker ${marker} was reflected in response body.`,
      reason: 'Payload marker duoc reflect lai trong HTTP response.',
      risk: 'Neu output khong encode dung context, attacker co the chen script vao page.',
      fix: 'Encode output theo context HTML/attribute/JS va validate input server-side.'
    });
  }

  const unsafeDomMatches = await page.evaluate((markerValue) => {
    const matches = [];
    document.querySelectorAll('script, [onerror], [onclick], [onload], [href^="javascript:"]').forEach((node) => {
      const html = node.outerHTML || '';
      if (html.includes(markerValue)) {
        matches.push(html.slice(0, 300));
      }
    });
    return matches;
  }, marker);

  for (const match of unsafeDomMatches) {
    findings.push({
      id: 'reflected-xss-unsafe-dom',
      severity: 'critical',
      owasp: 'OWASP Top 10 A03:2021 Injection',
      actionId: action?.id || null,
      step: action?.description || null,
      url: page.url(),
      status: null,
      payload: payload.value,
      evidence: match,
      reason: 'Payload marker xuat hien trong script/event-handler/javascript URL.',
      risk: 'Day la dau hieu payload co the duoc browser thuc thi.',
      fix: 'Khong render user input vao script/event handler; encode output va dung CSP.'
    });
  }

  return findings;
}
