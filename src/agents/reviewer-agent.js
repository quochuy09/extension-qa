import { CodexAgentAdapter, promptPath } from './codex-agent-adapter.js';

export class ReviewerAgent {
  constructor({ name = 'Agent Reviewer', codex = new CodexAgentAdapter() } = {}) {
    this.name = name;
    this.codex = codex;
  }

  async review({ code }) {
    const codexResult = await this.codex.run({
      promptPath: promptPath('reviewer-agent.md'),
      payload: { code },
      fallback: () => null
    });

    if (codexResult?.mode === 'codex') {
      return parseCodexReview(codexResult.output, this.name);
    }

    const findings = [
      ...checkNoHardWaits(code),
      ...checkSelectorPriority(code),
      ...checkAssertions(code),
      ...checkIdempotency(code)
    ];

    return {
      agent: this.name,
      mode: 'deterministic-fallback',
      approved: findings.length === 0,
      findings,
      checklist: [
        'No hard waitForTimeout calls',
        'Prefer data-testid before role/text, css, xpath',
        'Clear business assertions',
        'Idempotent test flow'
      ]
    };
  }
}

function parseCodexReview(output, agentName) {
  try {
    const parsed = JSON.parse(output);
    return {
      agent: agentName,
      mode: 'codex',
      approved: Boolean(parsed.approved),
      findings: Array.isArray(parsed.findings) ? parsed.findings : [],
      checklist: parsed.checklist || []
    };
  } catch {
    return {
      agent: agentName,
      mode: 'codex',
      approved: false,
      findings: [
        {
          id: 'invalid-codex-review-output',
          severity: 'high',
          message: 'Codex reviewer output was not valid JSON.'
        }
      ],
      checklist: []
    };
  }
}

function checkNoHardWaits(code) {
  return code.includes('waitForTimeout')
    ? [{ id: 'no-hard-waits', severity: 'high', message: 'Do not use hard waitForTimeout.' }]
    : [];
}

function checkSelectorPriority(code) {
  const findings = [];
  const hasCssLocatorForKnownTestIds = /page\.locator\(['"](#username|#password|#login-button|#checkout-button|#place-order-button)/.test(code);
  const hasXpath = /xpath=/.test(code);

  if (hasCssLocatorForKnownTestIds) {
    findings.push({
      id: 'selector-priority',
      severity: 'medium',
      message: 'Known demo elements have data-testid selectors; avoid falling back to css.'
    });
  }

  if (hasXpath) {
    findings.push({
      id: 'avoid-xpath',
      severity: 'medium',
      message: 'XPath should only be used as last resort.'
    });
  }

  return findings;
}

function checkAssertions(code) {
  const expectCount = (code.match(/await expect\(/g) || []).length;
  return expectCount < 4
    ? [{ id: 'clear-assertions', severity: 'high', message: 'Generated test needs assertions after major business milestones.' }]
    : [];
}

function checkIdempotency(code) {
  const startsFromBase = code.includes("await page.goto('/');");
  const usesUniqueExternalData = /Date\.now|Math\.random/.test(code);

  if (!startsFromBase) {
    return [{ id: 'idempotent-start', severity: 'high', message: 'Test must start from a clean application route.' }];
  }

  if (usesUniqueExternalData) {
    return [{ id: 'avoid-random-data', severity: 'low', message: 'Demo flow should remain deterministic unless unique data is required.' }];
  }

  return [];
}
