import { adaptActionLog } from '../contract/action-log-contract-adapter.js';
import { createPlaywrightSecurityObserver } from './playwright-security-observer.js';
import { safeXssPayloads } from './payloads/xss-payloads.js';
import { runRequestTamperingAudit } from './request-tampering.js';
import { auditReflectedXss } from './rules/reflected-xss-rule.js';
import { auditSecurityHeaders } from './rules/security-headers-rule.js';

const textLikeControlTypes = new Set(['text', 'password', 'email', 'search', 'tel', 'url', 'number', 'textarea']);

export async function runActionLogSecurityAudit({ page, baseURL, actionLog, checks = ['headers', 'xss'] }) {
  const contract = adaptActionLog(actionLog);
  const observer = createPlaywrightSecurityObserver(page, { baseURL });
  const findings = [];

  await page.goto(pathFromUrl(contract.session.startUrl), { waitUntil: 'domcontentloaded' });
  await replayActions(page, contract.actions, demoReplayOptions());
  await page.waitForLoadState('networkidle').catch(() => {});

  if (checks.includes('headers')) {
    for (const response of observer.snapshot().responses) {
      findings.push(...auditSecurityHeaders(response));
    }
  }

  if (checks.includes('xss')) {
    findings.push(...await runXssPayloadAudit({ page, contract, baseURL }));
  }

  if (checks.includes('request-tampering')) {
    const result = await runRequestTamperingAudit({
      page,
      responses: observer.snapshot().responses,
      baseURL,
      actions: contract.actions
    });
    findings.push(...result.findings);
  }

  return {
    contract,
    findings,
    observer: observer.snapshot()
  };
}

export async function runXssPayloadAudit({ page, contract, baseURL, payloads = safeXssPayloads }) {
  const findings = [];
  const inputActions = contract.actions.filter(isXssInjectableAction);

  for (const action of inputActions) {
    for (const payload of payloads) {
      findings.push(...await runSingleXssPayloadAudit({ page, contract, baseURL, action, payload }));
    }
  }

  return findings;
}

export async function runSingleXssPayloadAudit({ page, contract, baseURL, action, payload }) {
  const observer = createPlaywrightSecurityObserver(page, { baseURL });
  await page.goto(pathFromUrl(contract.session.startUrl), { waitUntil: 'domcontentloaded' });
  await replayActions(page, contract.actions, {
    ...demoReplayOptions(),
    overrides: new Map([[action.id, payload.value]])
  });
  await page.waitForLoadState('networkidle').catch(() => {});

  const findings = [];
  const snapshot = observer.snapshot();
  findings.push(...await auditReflectedXss({
    page,
    payload,
    responses: snapshot.responses,
    action
  }));

  for (const dialog of snapshot.dialogs) {
    findings.push({
      id: 'xss-dialog-opened',
      severity: 'critical',
      owasp: 'OWASP Top 10 A03:2021 Injection',
      actionId: action.id,
      step: action.description,
      url: page.url(),
      payload: payload.value,
      evidence: `${dialog.type}: ${dialog.message}`,
      reason: 'Payload lam browser dialog xuat hien trong khi replay UI.',
      risk: 'Day la dau hieu script da duoc thuc thi.',
      fix: 'Encode output, validate input server-side, va them CSP de giam kha nang script execution.'
    });
  }

  return findings;
}

export async function replayActions(page, actions, options = {}) {
  const overrides = options.overrides || new Map();
  const delayMs = Number(options.delayMs || 0);
  const highlight = Boolean(options.highlight);

  for (const action of actions) {
    const locator = locatorForAction(page, action);
    if (highlight) {
      await highlightLocator(locator).catch(() => {});
      await delay(delayMs);
    }

    if (action.playwrightKind === 'click') {
      await locator.click();
      await delay(delayMs);
      continue;
    }

    if (action.playwrightKind === 'fill') {
      await locator.fill(overrides.get(action.id) ?? action.value ?? '');
      await delay(delayMs);
      continue;
    }

    if (action.playwrightKind === 'selectOption') {
      await locator.selectOption(overrides.get(action.id) ?? action.value ?? '');
      await delay(delayMs);
      continue;
    }

    if (action.playwrightKind === 'select2') {
      await selectSelect2Option(locator, overrides.get(action.id) ?? action.value ?? '', action.selectedText || '');
      await delay(delayMs);
      continue;
    }

    if (action.playwrightKind === 'multiselect') {
      await setMultiselectOptions(locator, overrides.get(action.id) ?? action.value ?? []);
      await delay(delayMs);
      continue;
    }

    if (action.playwrightKind === 'check') {
      await locator.check();
      await delay(delayMs);
      continue;
    }

    if (action.playwrightKind === 'uncheck') {
      await locator.uncheck();
      await delay(delayMs);
    }
  }
}

async function selectSelect2Option(root, value, selectedText = '') {
  await root.getByRole('combobox').click();
  const option = root.locator(`[data-option-value="${cssEscape(String(value))}"]`);
  if (await option.count()) {
    await option.first().click();
    return;
  }

  await root.getByRole('option', { name: selectedText }).click();
}

async function setMultiselectOptions(root, values) {
  const expectedValues = new Set((Array.isArray(values) ? values : [values]).map(String));
  const button = root.locator('[data-role="multiselect-button"]');
  if (await button.count()) {
    await button.click();
  }

  const checkboxes = root.locator('input[type="checkbox"]');
  const count = await checkboxes.count();
  for (let index = 0; index < count; index += 1) {
    const checkbox = checkboxes.nth(index);
    const value = await checkbox.inputValue();
    if (expectedValues.has(String(value))) {
      await checkbox.check();
    } else {
      await checkbox.uncheck();
    }
  }
}

export function formatSecurityFindings(findings) {
  if (findings.length === 0) {
    return 'Security audit passed.';
  }

  return [
    `Phat hien ${findings.length} security finding khi replay business flow:`,
    ...findings.map((finding, index) => [
      `${index + 1}. [${String(finding.severity || 'unknown').toUpperCase()}] ${finding.id}`,
      `   Step: ${finding.step || finding.actionId || '-'}`,
      `   URL: ${finding.url || '-'}`,
      `   OWASP: ${finding.owasp || '-'}`,
      `   Reason: ${finding.reason || '-'}`,
      `   Evidence: ${finding.evidence || '-'}`,
      `   Payload: ${finding.payload || '-'}`,
      `   Fix: ${finding.fix || '-'}`
    ].join('\n'))
  ].join('\n');
}

function locatorForAction(page, action) {
  const candidate = action.primarySelector || action.selectorCandidates?.[0];
  if (!candidate) {
    throw new Error(`No selector candidate for action ${action.id}`);
  }

  if (candidate.type === 'testId') {
    const match = candidate.value.match(/\[data-testid="(.+)"\]/);
    return match ? page.getByTestId(match[1]) : page.locator(candidate.value);
  }

  if (candidate.type === 'roleText') {
    const roleMatch = candidate.value.match(/getByRole\('([^']+)', \{ name: '([^']+)' \}\)/);
    if (roleMatch) {
      return page.getByRole(roleMatch[1], { name: roleMatch[2] });
    }
  }

  if (candidate.type === 'xpath') {
    return page.locator(`xpath=${candidate.value}`);
  }

  return page.locator(candidate.value);
}

export function isXssInjectableAction(action) {
  return action.type === 'input' && textLikeControlTypes.has(action.controlType);
}

export function pathFromUrl(url) {
  if (!url) {
    return '/';
  }

  try {
    const parsed = new URL(url);
    return `${parsed.pathname || '/'}${parsed.hash || ''}`;
  } catch {
    return '/';
  }
}

export function demoReplayOptions() {
  if (process.env.SECURITY_DEMO !== '1') {
    return {};
  }

  return {
    delayMs: Number(process.env.SECURITY_ACTION_DELAY || 700),
    highlight: true
  };
}

async function highlightLocator(locator) {
  await locator.evaluate((element) => {
    const previousOutline = element.style.outline;
    const previousBoxShadow = element.style.boxShadow;
    element.scrollIntoView({ block: 'center', inline: 'center' });
    element.style.outline = '3px solid #d93025';
    element.style.boxShadow = '0 0 0 6px rgba(217, 48, 37, 0.22)';
    window.setTimeout(() => {
      element.style.outline = previousOutline;
      element.style.boxShadow = previousBoxShadow;
    }, 900);
  });
}

function delay(ms) {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function cssEscape(value) {
  return String(value).replace(/["\\]/g, '\\$&');
}
