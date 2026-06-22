import assert from 'node:assert/strict';
import { classifyRuntimeResult } from '../src/runtime/runtime-result-classifier.js';

assert.deepEqual(classifyRuntimeResult({ exitCode: 0, output: '1 passed' }), {
  status: 'passed',
  category: 'none',
  retryableByHealing: false,
  reason: 'Playwright runtime validation passed.'
});

const selectorFailure = classifyRuntimeResult({
  exitCode: 1,
  output: "TimeoutError: locator('[data-testid=\"login-button\"]').click: Timeout 5000ms exceeded"
});
assert.equal(selectorFailure.status, 'failed');
assert.equal(selectorFailure.category, 'selector-failure');
assert.equal(selectorFailure.retryableByHealing, true);

const assertionFailure = classifyRuntimeResult({
  exitCode: 1,
  output: "Error: expect(locator).toBeVisible() failed"
});
assert.equal(assertionFailure.status, 'failed');
assert.equal(assertionFailure.category, 'assertion-failure');
assert.equal(assertionFailure.retryableByHealing, false);

const runtimeError = classifyRuntimeResult({
  exitCode: 1,
  output: 'TypeError: Cannot read properties of undefined'
});
assert.equal(runtimeError.status, 'failed');
assert.equal(runtimeError.category, 'runtime-error');
assert.equal(runtimeError.retryableByHealing, false);

console.log('Runtime result classifier tests passed.');
