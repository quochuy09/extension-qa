import { test } from '@playwright/test';
import { readActionLog } from '../src/runtime/action-log-file.js';
import { runActionLog } from '../src/runtime/action-log-runner.js';

const { filePath, actionLog } = await readActionLog();

test.describe('Action log runtime runner', () => {
  test(`run ${actionLog.testCase?.name || filePath}`, async ({ page }) => {
    await runActionLog(page, actionLog, {
      testStep: test.step
    });
  });
});
