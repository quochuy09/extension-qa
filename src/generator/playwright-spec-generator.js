const defaultTestPath = 'tests/generated-checkout.spec.ts';

export function generatePlaywrightSpec(recording, reviewFeedback = []) {
  const actions = recording.actions;
  const lines = [
    "import { test, expect } from '@playwright/test';",
    '',
    "test.describe('Generated checkout flow', () => {",
    "  test('customer can login, add an item, and place an order', async ({ page }) => {",
    "    await page.goto('/');",
    ''
  ];

  for (const group of recording.groups) {
    lines.push(`    await test.step('${group.name}', async () => {`);
    const groupActions = group.actionIds.map((id) => actions.find((action) => action.id === id)).filter(Boolean);

    for (const action of groupActions) {
      lines.push(`      ${renderAction(action)}`);
    }

    for (const assertion of assertionsForGroup(group.name)) {
      lines.push(`      ${assertion}`);
    }

    lines.push('    });', '');
  }

  lines.push('  });', '});', '');

  if (reviewFeedback.length > 0) {
    lines.push(`// Regenerated after reviewer feedback: ${reviewFeedback.map((item) => item.id).join(', ')}`, '');
  }

  return {
    targetPath: defaultTestPath,
    code: lines.join('\n')
  };
}

function renderAction(action) {
  const locator = bestLocator(action);

  if (action.type === 'input') {
    return `await ${locator}.fill(${JSON.stringify(action.value ?? '')});`;
  }

  if (action.type === 'click') {
    return `await ${locator}.click();`;
  }

  throw new Error(`Unsupported action type: ${action.type}`);
}

function bestLocator(action) {
  const selectors = action.selectors || {};

  if (selectors.testId) {
    const match = selectors.testId.match(/\[data-testid="(.+)"\]/);
    if (match) {
      return `page.getByTestId(${JSON.stringify(match[1])})`;
    }
  }

  if (selectors.roleText) {
    return `page.${selectors.roleText}`;
  }

  if (selectors.css) {
    return `page.locator(${JSON.stringify(selectors.css)})`;
  }

  if (selectors.xpath) {
    return `page.locator(${JSON.stringify(`xpath=${selectors.xpath}`)})`;
  }

  throw new Error(`No usable selector for action ${action.id}`);
}

function assertionsForGroup(groupName) {
  const assertions = {
    Login: ["await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible();"],
    Products: [
      "await expect(page.getByTestId('cart-count')).toHaveText('1');",
      "await expect(page.getByRole('heading', { name: 'Cart' })).toBeVisible();"
    ],
    Cart: ["await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();"],
    Checkout: [
      "await expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible();",
      "await expect(page.getByTestId('confirmation-message')).toContainText('Thank you');"
    ],
    Confirmation: ["await expect(page.getByTestId('confirmation-message')).toBeVisible();"]
  };

  return assertions[groupName] || [];
}
