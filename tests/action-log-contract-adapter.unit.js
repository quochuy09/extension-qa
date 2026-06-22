import assert from 'node:assert/strict';
import { adaptActionLog, actionPlaywrightKind, validateActionLog } from '../src/contract/action-log-contract-adapter.js';
import { readActionLog } from '../src/runtime/action-log-file.js';

const { actionLog: fixture } = await readActionLog();
const contract = adaptActionLog(fixture);

assert.equal(contract.schemaVersion, 1);
assert.ok(contract.actions.length > 0);
assert.ok(contract.groups.length > 0);
assert.equal(contract.actions[0].primarySelector.type, 'testId');

const networkContract = adaptActionLog({
  metadata: {
    schemaVersion: 1
  },
  groups: [
    {
      name: 'Login',
      actionIds: ['act-001']
    }
  ],
  actions: [
    {
      id: 'act-001',
      type: 'click',
      targetTag: 'button',
      targetText: 'Login',
      selectors: {
        testId: '[data-testid="login-button"]'
      },
      networkEvents: [
        {
          method: 'POST',
          url: 'http://localhost:4173/api/login',
          status: 200,
          requestBody: '{"username":"standard_user","password":"[redacted]"}',
          requestBodyType: 'json',
          requestBodyRedacted: true,
          requestBodyTruncated: false,
          responseHeaders: {
            'content-type': 'application/json'
          }
        }
      ]
    }
  ]
});
assert.equal(networkContract.actions[0].networkEvents[0].method, 'POST');
assert.equal(networkContract.actions[0].networkEvents[0].actionId, 'act-001');
assert.equal(networkContract.actions[0].networkEvents[0].requestBodyType, 'json');
assert.equal(networkContract.actions[0].networkEvents[0].requestBodyRedacted, true);
assert.equal(networkContract.actions[0].networkEvents[0].requestBodyTruncated, false);

const oldNetworkContract = adaptActionLog({
  metadata: {
    schemaVersion: 1
  },
  groups: [
    {
      name: 'Checkout',
      actionIds: ['act-old']
    }
  ],
  actions: [
    {
      id: 'act-old',
      type: 'click',
      targetTag: 'button',
      selectors: {
        testId: '[data-testid="place-order-button"]'
      },
      networkEvents: [
        {
          method: 'POST',
          url: 'http://localhost:4173/api/orders',
          status: 200,
          requestBody: '{"ok":true}'
        }
      ]
    }
  ]
});
assert.equal(oldNetworkContract.actions[0].networkEvents[0].requestBodyType, null);
assert.equal(oldNetworkContract.actions[0].networkEvents[0].requestBodyRedacted, false);

const selectAction = {
  type: 'input',
  controlType: 'select',
  selectors: {
    testId: '[data-testid="shipping-method-select"]'
  }
};
assert.equal(actionPlaywrightKind(selectAction), 'selectOption');

const checkboxAction = {
  type: 'input',
  controlType: 'checkbox',
  checked: false,
  selectors: {
    testId: '[data-testid="gift-wrap-checkbox"]'
  }
};
assert.equal(actionPlaywrightKind(checkboxAction), 'uncheck');

assert.equal(actionPlaywrightKind({
  type: 'input',
  controlType: 'select2',
  selectors: {
    testId: '[data-testid="superior-employee-select2"]'
  }
}), 'select2');

assert.equal(actionPlaywrightKind({
  type: 'input',
  controlType: 'multiselect',
  selectors: {
    testId: '[data-testid="face-photo-multiselect"]'
  }
}), 'multiselect');

const invalidErrors = validateActionLog({
  metadata: {
    schemaVersion: 1
  },
  groups: [],
  actions: []
});
assert.ok(invalidErrors.includes('actions must be a non-empty array.'));

console.log('Action log contract adapter tests passed.');
