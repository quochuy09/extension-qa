import { adaptActionLog } from '../contract/action-log-contract-adapter.js';

export function generatePlaywrightSpec(actionLog, reviewFeedback = []) {
  const contract = adaptActionLog(actionLog);
  const baseName = fileBaseName(contract.testCase.name);
  const className = pascalCase(`${baseName} page`);
  const pageObjectPath = `tests/generated/pages/${baseName}.page.js`;
  const specPath = `tests/generated/${baseName}.spec.js`;
  const pageObjectCode = renderPageObject(contract, className);
  const specCode = renderSpec(contract, className, pageObjectPath, reviewFeedback);

  return {
    targetPath: specPath,
    code: specCode,
    files: [
      {
        path: pageObjectPath,
        code: pageObjectCode
      },
      {
        path: specPath,
        code: specCode
      }
    ]
  };
}

function renderSpec(contract, className, pageObjectPath, reviewFeedback) {
  const relativePageObjectPath = `./${pageObjectPath.split('/').slice(2).join('/')}`;
  const datasetRows = dataRowsForContract(contract);
  const bindingByActionId = bindingMap(contract);
  const lines = [
    "import { test } from '@playwright/test';",
    `import { ${className} } from ${JSON.stringify(relativePageObjectPath)};`,
    '',
    `test.describe(${JSON.stringify(contract.testCase.name)}, () => {`
  ];

  if (datasetRows.length > 0 && bindingByActionId.size > 0) {
    lines.push(
      `  const datasetRows = ${JSON.stringify(datasetRows, null, 2).replace(/\n/g, '\n  ')};`,
      '',
      '  for (const [rowIndex, row] of datasetRows.entries()) {',
      `    test(\`${escapeTemplateLiteral(contract.testCase.name)} CSV row \${rowIndex + 1}\`, async ({ page }) => {`,
      `      const app = new ${className}(page);`,
      `      await app.gotoStart(${JSON.stringify(pathFromUrl(contract.session.startUrl))});`,
      ''
    );

    for (const group of contract.groups) {
      lines.push(`      await test.step(${JSON.stringify(group.name)}, async () => {`);
      for (const action of group.actions) {
        lines.push(`        await app.${methodNameForAction(action)}(${argumentForAction(action, bindingByActionId)});`);
      }

      const assertionName = assertionMethodName(group.name);
      lines.push(`        await app.${assertionName}();`);
      lines.push('      });', '');
    }

    lines.push('    });', '  }', '});', '');
  } else {
    lines.push(
    `  test(${JSON.stringify(contract.testCase.name)}, async ({ page }) => {`,
    `    const app = new ${className}(page);`,
    `    await app.gotoStart(${JSON.stringify(pathFromUrl(contract.session.startUrl))});`,
    ''
    );

    for (const group of contract.groups) {
      lines.push(`    await test.step(${JSON.stringify(group.name)}, async () => {`);
      for (const action of group.actions) {
        lines.push(`      await app.${methodNameForAction(action)}();`);
      }

      const assertionName = assertionMethodName(group.name);
      lines.push(`      await app.${assertionName}();`);
      lines.push('    });', '');
    }

    lines.push('  });', '});', '');
  }

  if (reviewFeedback.length > 0) {
    lines.push(`// Regenerated after reviewer feedback: ${reviewFeedback.map((item) => item.id).join(', ')}`, '');
  }

  return lines.join('\n');
}

function renderPageObject(contract, className) {
  const bindingByActionId = bindingMap(contract);
  const lines = [
    "import { expect } from '@playwright/test';",
    '',
    `export class ${className} {`,
    '  constructor(page) {',
    '    this.page = page;',
    '  }',
    '',
    '  async gotoStart(path) {',
    '    await this.page.goto(path || \'/\');',
    '  }',
    ''
  ];

  for (const action of contract.actions) {
    const binding = bindingByActionId.get(action.id);
    lines.push(`  async ${methodNameForAction(action)}(${binding ? 'value' : ''}) {`);
    lines.push(`    ${renderPomAction(action, binding)}`);
    lines.push('  }', '');
  }

  const renderedAssertions = new Set();
  for (const group of contract.groups) {
    const assertionName = assertionMethodName(group.name);
    if (renderedAssertions.has(assertionName)) {
      continue;
    }

    renderedAssertions.add(assertionName);
    lines.push(`  async ${assertionName}() {`);
    for (const assertion of assertionsForGroup(group.name)) {
      lines.push(`    ${assertion}`);
    }
    lines.push('  }', '');
  }

  if (contract.actions.some((action) => ['select2', 'multiselect'].includes(action.playwrightKind))) {
    lines.push(...customControlHelpers());
  }

  lines.push('}', '');
  return lines.join('\n');
}

function renderPomAction(action, binding = null) {
  const locator = locatorForPom(action);
  const valueExpression = binding ? `value ?? ${JSON.stringify(action.value ?? '')}` : JSON.stringify(action.value ?? '');

  if (action.playwrightKind === 'click') {
    return `await ${locator}.click();`;
  }

  if (action.playwrightKind === 'fill') {
    return `await ${locator}.fill(${valueExpression});`;
  }

  if (action.playwrightKind === 'selectOption') {
    return `await ${locator}.selectOption(${valueExpression});`;
  }

  if (action.playwrightKind === 'select2') {
    return `await this.selectSelect2Option(${locator}, ${valueExpression}, ${JSON.stringify(action.selectedText || '')});`;
  }

  if (action.playwrightKind === 'multiselect') {
    return `await this.setMultiselectOptions(${locator}, ${valueExpression});`;
  }

  if (action.playwrightKind === 'check') {
    return `await ${locator}.check();`;
  }

  if (action.playwrightKind === 'uncheck') {
    return `await ${locator}.uncheck();`;
  }

  throw new Error(`Unsupported Playwright action kind: ${action.playwrightKind}`);
}

function customControlHelpers() {
  return [
    '  async selectSelect2Option(root, value, selectedText = "") {',
    '    await root.getByRole("combobox").click();',
    '    const option = root.locator(`[data-option-value="${this.cssEscape(String(value))}"]`);',
    '    if (await option.count()) {',
    '      await option.first().click();',
    '      return;',
    '    }',
    '    await root.getByRole("option", { name: selectedText }).click();',
    '  }',
    '',
    '  async setMultiselectOptions(root, values) {',
    '    const expectedValues = new Set((Array.isArray(values) ? values : [values]).map(String));',
    '    const button = root.locator("[data-role=\\"multiselect-button\\"]");',
    '    const options = root.locator("[data-role=\\"multiselect-options\\"]");',
    '    if (await button.count()) {',
    '      await button.click();',
    '    }',
    '    const checkboxes = root.locator("input[type=\\"checkbox\\"]");',
    '    const count = await checkboxes.count();',
    '    for (let index = 0; index < count; index += 1) {',
    '      const checkbox = checkboxes.nth(index);',
    '      const value = await checkbox.inputValue();',
    '      const shouldCheck = expectedValues.has(String(value));',
    '      if (shouldCheck) {',
    '        await checkbox.check();',
    '      } else {',
    '        await checkbox.uncheck();',
    '      }',
    '    }',
    '    if (await options.count()) {',
    '      await this.page.keyboard.press("Escape").catch(() => {});',
    '    }',
    '  }',
    '',
    '  cssEscape(value) {',
    '    return value.replace(/["\\\\]/g, "\\\\$&");',
    '  }',
    ''
  ];
}

function dataRowsForContract(contract) {
  const dataset = contract.datasets[0];
  if (!dataset) {
    return [];
  }

  return (dataset.rows?.length ? dataset.rows : dataset.rowsPreview || []).slice(0, contract.runPolicy.maxRows);
}

function bindingMap(contract) {
  return new Map((contract.bindings || []).map((binding) => [binding.actionId, binding]));
}

function argumentForAction(action, bindingByActionId) {
  const binding = bindingByActionId.get(action.id);
  return binding ? `row[${JSON.stringify(binding.column)}]` : '';
}

function escapeTemplateLiteral(value) {
  return String(value || '').replace(/[`\\$]/g, '\\$&');
}

function locatorForPom(action) {
  const candidate = action.primarySelector;
  if (!candidate?.locator) {
    throw new Error(`No usable selector for action ${action.id}`);
  }

  return candidate.locator.replace(/^page\./, 'this.page.');
}

function assertionsForGroup(groupName) {
  const normalized = String(groupName || '').toLowerCase();

  if (normalized.includes('login')) {
    return ["await expect(this.page.getByRole('heading', { name: 'Products' })).toBeVisible();"];
  }

  if (normalized.includes('checkout')) {
    return [
      "await expect(this.page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible();",
      "await expect(this.page.getByTestId('confirmation-message')).toContainText('Thank you');"
    ];
  }

  if (normalized.includes('product') || normalized.includes('add cart')) {
    return [
      "await expect(this.page.getByTestId('cart-count')).not.toHaveText('0');",
      "await expect(this.page.getByRole('heading', { name: 'Cart' })).toBeVisible();"
    ];
  }

  if (normalized.includes('cart')) {
    return ["await expect(this.page.getByRole('heading', { name: 'Checkout' })).toBeVisible();"];
  }

  if (normalized.includes('confirmation')) {
    return ["await expect(this.page.getByTestId('confirmation-message')).toBeVisible();"];
  }

  return ['await expect(this.page).toHaveTitle(/Factory Demo Shop/);'];
}

function methodNameForAction(action) {
  return camelCase(`${action.type} ${action.targetText || action.controlType || action.id} ${action.order}`);
}

function assertionMethodName(groupName) {
  return camelCase(`assert ${groupName || 'group'} complete`);
}

function pathFromUrl(url) {
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

function fileBaseName(value) {
  return String(value || 'generated-flow')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'generated-flow';
}

function pascalCase(value) {
  return String(value)
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join('');
}

function camelCase(value) {
  const pascal = pascalCase(value);
  return `${pascal.charAt(0).toLowerCase()}${pascal.slice(1)}`;
}
