import { expect } from '@playwright/test';
import { adaptActionLog } from '../contract/action-log-contract-adapter.js';

export async function runActionLog(page, actionLog, { testStep } = {}) {
  const contract = adaptActionLog(actionLog);
  await page.goto(startRoute(contract.session.startUrl));

  for (const group of contract.groups) {
    const runGroup = async () => {
      for (const action of group.actions) {
        await runAction(page, action);
      }

      await assertGroupCheckpoint(page, group.name);
    };

    if (testStep) {
      await testStep(group.name, runGroup);
    } else {
      await runGroup();
    }
  }
}

async function runAction(page, action) {
  const locator = locatorFromAction(page, action);

  if (action.playwrightKind === 'click') {
    await locator.click();
    return;
  }

  if (action.playwrightKind === 'fill') {
    await locator.fill(String(action.value ?? ''));
    return;
  }

  if (action.playwrightKind === 'selectOption') {
    await locator.selectOption(String(action.value ?? ''));
    return;
  }

  if (action.playwrightKind === 'check') {
    await locator.check();
    return;
  }

  if (action.playwrightKind === 'uncheck') {
    await locator.uncheck();
    return;
  }

  throw new Error(`Unsupported action kind: ${action.playwrightKind}`);
}

function locatorFromAction(page, action) {
  for (const candidate of action.selectorCandidates) {
    const locator = locatorFromCandidate(page, candidate);
    if (locator) {
      return locator;
    }
  }

  throw new Error(`No runnable selector found for action: ${action.description}`);
}

function locatorFromCandidate(page, candidate) {
  if (candidate.type === 'testId') {
    const testId = extractDataTestId(candidate.value);
    return testId ? page.getByTestId(testId) : page.locator(candidate.value);
  }

  if (candidate.type === 'roleText') {
    return roleTextLocator(page, candidate.value);
  }

  if (candidate.type === 'id' || candidate.type === 'css') {
    return page.locator(candidate.value);
  }

  if (candidate.type === 'xpath') {
    return page.locator(`xpath=${candidate.value}`);
  }

  return null;
}

function extractDataTestId(selector) {
  const match = String(selector).match(/\[data-testid="(.+?)"\]/);
  return match ? match[1] : null;
}

function roleTextLocator(page, value) {
  const match = String(value).match(/^getByRole\('([^']+)'\s*,\s*\{\s*name:\s*'([^']+)'\s*\}\)$/);
  if (!match) {
    return null;
  }

  return page.getByRole(match[1], { name: match[2] });
}

async function assertGroupCheckpoint(page, groupName) {
  const normalized = String(groupName || '').toLowerCase();

  if (normalized.includes('login')) {
    await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible();
    return;
  }

  if (normalized.includes('checkout')) {
    await expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible();
    await expect(page.getByTestId('confirmation-message')).toContainText('Thank you');
    return;
  }

  if (normalized.includes('product') || normalized.includes('add cart')) {
    await expect(page.getByTestId('cart-count')).not.toHaveText('0');
    await expect(page.getByRole('heading', { name: 'Cart' })).toBeVisible();
    return;
  }

  if (normalized.includes('cart')) {
    await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
    return;
  }
}

function startRoute(url) {
  if (!url) {
    return '/';
  }

  try {
    const parsed = new URL(url);
    return `${parsed.pathname || '/'}${parsed.hash || ''}`;
  } catch {
    return url;
  }
}
