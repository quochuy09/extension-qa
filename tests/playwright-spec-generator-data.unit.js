import assert from 'node:assert/strict';
import { generatePlaywrightSpec } from '../src/generator/playwright-spec-generator.js';

const actionLog = {
  metadata: {
    schemaVersion: 1,
    source: 'unit-test',
    generatedAt: '2026-06-19T00:00:00.000Z'
  },
  session: {
    startUrl: 'http://localhost:4173/checkout'
  },
  testCase: {
    name: 'CSV checkout'
  },
  groups: [
    {
      name: 'Checkout',
      actionIds: ['act-001']
    }
  ],
  datasets: [
    {
      id: 'csv-1',
      name: 'checkout-users.csv',
      columns: ['fullName'],
      rowCount: 2,
      rows: [
        { fullName: 'Alice Nguyen' },
        { fullName: 'Bao Tran' }
      ],
      rowsPreview: [
        { fullName: 'Alice Nguyen' }
      ]
    }
  ],
  bindings: [
    {
      actionId: 'act-001',
      datasetId: 'csv-1',
      column: 'fullName'
    }
  ],
  actions: [
    {
      id: 'act-001',
      type: 'input',
      value: 'Recorded User',
      targetTag: 'input',
      targetText: 'Full name',
      selectors: {
        testId: '[data-testid="full-name-input"]'
      }
    }
  ]
};

const generated = generatePlaywrightSpec(actionLog);
const spec = generated.files.find((file) => file.path.endsWith('.spec.js')).code;
const pageObject = generated.files.find((file) => file.path.endsWith('.page.js')).code;

assert.match(spec, /const datasetRows = \[/);
assert.match(spec, /CSV row \$\{rowIndex \+ 1\}/);
assert.match(spec, /row\["fullName"\]/);
assert.match(pageObject, /async inputFullName1\(value\)/);
assert.match(pageObject, /fill\(value \?\? "Recorded User"\)/);

const customControlLog = {
  metadata: {
    schemaVersion: 1,
    source: 'unit-test'
  },
  session: {
    startUrl: 'http://localhost:4173/checkout'
  },
  testCase: {
    name: 'Custom controls'
  },
  groups: [
    {
      name: 'Checkout',
      actionIds: ['act-001', 'act-002']
    }
  ],
  actions: [
    {
      id: 'act-001',
      type: 'input',
      controlType: 'select2',
      value: 'employee-20',
      selectedText: '佐藤 花子',
      targetTag: 'div',
      targetText: 'Superior employee',
      selectors: {
        testId: '[data-testid="superior-employee-select2"]'
      }
    },
    {
      id: 'act-002',
      type: 'input',
      controlType: 'multiselect',
      value: ['1', '0'],
      selectedText: ['あり', 'なし'],
      targetTag: 'div',
      targetText: 'Face photo checklist',
      selectors: {
        testId: '[data-testid="face-photo-multiselect"]'
      }
    }
  ]
};

const customGenerated = generatePlaywrightSpec(customControlLog);
const customPageObject = customGenerated.files.find((file) => file.path.endsWith('.page.js')).code;

assert.match(customPageObject, /selectSelect2Option/);
assert.match(customPageObject, /setMultiselectOptions/);
assert.match(customPageObject, /employee-20/);
assert.match(customPageObject, /\["1","0"\]/);

console.log('Playwright spec generator data-driven tests passed.');
