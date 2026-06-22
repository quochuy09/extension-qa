import { test, request as playwrightRequest } from '@playwright/test';
import { adaptActionLog } from '../../src/contract/action-log-contract-adapter.js';
import { readActionLog } from '../../src/runtime/action-log-file.js';
import { safeXssPayloads } from '../../src/security/payloads/xss-payloads.js';
import { runSecurityRules, rulesForChecks } from '../../src/security/core/rule-registry.js';
import { createPlaywrightSecurityObserver } from '../../src/security/playwright-security-observer.js';
import { responseSecurityRules } from '../../src/security/rules/index.js';
import {
  addSecurityReportResult,
  createSecurityReport,
  writeSecurityReport
} from '../../src/security/security-report.js';
import {
  formatSecurityFindings,
  demoReplayOptions,
  isXssInjectableAction,
  pathFromUrl,
  replayActions,
  runSingleXssPayloadAudit
} from '../../src/security/playwright-security-runner.js';
import { runRequestTamperingAudit } from '../../src/security/request-tampering.js';
import { runObjectAccessProofAudit } from '../../src/security/object-access-proof.js';

const securityRuntimeEnabled = process.env.SECURITY_RUNTIME === '1' || process.argv.some((arg) => arg.includes('tests/security'));
const checks = securityChecksFromEnv();
const { filePath, actionLog } = await readActionLog();
const contract = adaptActionLog(actionLog);
const securityReport = createSecurityReport({
  source: filePath,
  checks,
  testCaseName: contract.testCase.name
});

test.describe(`Action log security replay - ${contract.testCase.name}`, () => {
  test.skip(!securityRuntimeEnabled, 'Security runtime is executed through npm run test:security.');

  test.afterAll(async () => {
    const paths = await writeSecurityReport(securityReport);
    logDemo(`Security report written: ${paths.jsonPath}, ${paths.htmlPath}`);
  });

  for (const group of contract.groups) {
    test(`business flow replay: ${group.name}`, async ({ page }, testInfo) => {
      await page.goto(pathFromUrl(contract.session.startUrl), { waitUntil: 'domcontentloaded' });
      const actionsToGroup = actionsThroughGroup(contract.actions, group);
      logDemo(`Replay business flow to group: ${group.name} (${actionsToGroup.length} actions)`);
      await replayActions(page, actionsToGroup, demoReplayOptions());
      addSecurityReportResult(securityReport, {
        type: 'business-flow-replay',
        name: group.name,
        actionCount: actionsToGroup.length,
        findings: []
      });

      await testInfo.attach('security-replay-group', {
        body: JSON.stringify({
          source: filePath,
          group: group.name,
          actionCount: actionsToGroup.length,
          targetGroupActionCount: group.actions.length,
          actions: actionsToGroup.map((action) => ({
            id: action.id,
            description: action.description
          }))
        }, null, 2),
        contentType: 'application/json'
      });
    });
  }

  const selectedResponseRules = rulesForChecks(responseSecurityRules, checks);
  if (selectedResponseRules.length > 0) {
    test(`response security rules: ${selectedResponseRules.map((rule) => rule.id).join(', ')}`, async ({ page, baseURL }, testInfo) => {
      const observer = createPlaywrightSecurityObserver(page, { baseURL });
      await page.goto(pathFromUrl(contract.session.startUrl), { waitUntil: 'domcontentloaded' });
      logDemo(`Replay full flow and audit response rules: ${selectedResponseRules.map((rule) => rule.id).join(', ')}`);
      await replayActions(page, contract.actions, demoReplayOptions());
      await page.waitForLoadState('networkidle').catch(() => {});

      const snapshot = observer.snapshot();
      const findings = await runSecurityRules({
        rules: selectedResponseRules,
        context: {
          scopes: ['response'],
          responses: snapshot.responses
        }
      });
      addSecurityReportResult(securityReport, {
        type: 'response-security-rules',
        name: selectedResponseRules.map((rule) => rule.id).join(', '),
        findings
      });
      await attachFindings(testInfo, 'response-security-findings', findings);
      failOnFindings(findings);
    });
  }

  if (checks.includes('xss')) {
    const inputActions = contract.actions.filter(isXssInjectableAction);
    for (const action of inputActions) {
      for (const payload of safeXssPayloads) {
        test(`xss payload ${payload.id}: ${action.description}`, async ({ page, baseURL }, testInfo) => {
          logDemo(`Inject XSS payload "${payload.id}" into: ${action.description}`);
          const findings = await runSingleXssPayloadAudit({
            page,
            contract,
            baseURL,
            action,
            payload
          });
          addSecurityReportResult(securityReport, {
            type: 'xss-ui-payload',
            name: action.description,
            actionId: action.id,
            payload,
            findings
          });

          await attachFindings(testInfo, 'xss-findings', findings, {
            source: filePath,
            actionId: action.id,
            action: action.description,
            payload
          });
          failOnFindings(findings);
        });
      }
    }
  }

  if (checks.includes('request-tampering')) {
    test('request tampering: cloned API requests reject modified parameters', async ({ page, baseURL }, testInfo) => {
      const observer = createPlaywrightSecurityObserver(page, { baseURL });
      await page.goto(pathFromUrl(contract.session.startUrl), { waitUntil: 'domcontentloaded' });
      logDemo('Replay full flow and run request tampering against captured API request bodies');
      const orderRequestSeen = page.waitForResponse((response) => {
        const request = response.request();
        return request.method() === 'POST' && new URL(response.url()).pathname === '/api/orders';
      }, { timeout: 5000 }).catch(() => null);
      await replayActions(page, contract.actions, demoReplayOptions());
      await orderRequestSeen;
      await page.waitForLoadState('networkidle').catch(() => {});
      await waitForObservedRequest(observer, (entry) => entry.method === 'POST' && new URL(entry.url).pathname === '/api/orders');

      const snapshot = observer.snapshot();
      const result = await runRequestTamperingAudit({
        page,
        responses: snapshot.responses,
        baseURL,
        actions: contract.actions
      });
      const targetName = result.targets.length
        ? result.targets.map((target) => `${target.method} ${target.path}`).join(', ')
        : 'No tamperable request targets';

      addSecurityReportResult(securityReport, {
        type: 'request-tampering',
        name: targetName,
        targetCount: result.targetCount,
        attemptCount: result.attempts.length,
        targets: result.targets,
        attempts: result.attempts,
        skippedRequests: result.skippedRequests,
        findings: result.findings
      });

      await attachFindings(testInfo, 'request-tampering-findings', result.findings, {
        source: filePath,
        targetCount: result.targetCount,
        attempts: result.attempts
      });

      if (result.targetCount === 0 && checks.length === 1) {
        throw new Error('Request tampering setup failed: replay did not produce a same-origin POST /api/orders request with JSON body.');
      }

      failOnFindings(result.findings);
    });
  }

  if (checks.includes('object-access')) {
    test('object access proof: second user cannot read another user order', async ({ page, baseURL }, testInfo) => {
      const observer = createPlaywrightSecurityObserver(page, { baseURL });
      await page.goto(pathFromUrl(contract.session.startUrl), { waitUntil: 'domcontentloaded' });
      logDemo('Replay full flow and verify cross-user object access is rejected');
      const orderRequestSeen = page.waitForResponse((response) => {
        const request = response.request();
        return request.method() === 'POST' && new URL(response.url()).pathname === '/api/orders';
      }, { timeout: 5000 }).catch(() => null);
      await replayActions(page, contract.actions, demoReplayOptions());
      await orderRequestSeen;
      await page.waitForLoadState('networkidle').catch(() => {});
      await waitForObservedRequest(observer, (entry) => entry.method === 'POST' && new URL(entry.url).pathname === '/api/orders');

      const result = await runObjectAccessProofAudit({
        apiRequest: playwrightRequest,
        baseURL,
        responses: observer.snapshot().responses
      });

      addSecurityReportResult(securityReport, {
        type: 'object-access-proof',
        name: result.target ? `GET ${result.target.path}` : 'No order target found',
        target: result.target,
        attempt: result.attempt,
        attempts: result.attempts,
        findings: result.findings
      });

      await attachFindings(testInfo, 'object-access-proof-findings', result.findings, {
        source: filePath,
        target: result.target,
        attempt: result.attempt,
        attempts: result.attempts
      });

      failOnFindings(result.findings);
    });
  }
});

async function attachFindings(testInfo, name, findings, metadata = {}) {
  await testInfo.attach(name, {
    body: JSON.stringify({
      ...metadata,
      checks,
      findings
    }, null, 2),
    contentType: 'application/json'
  });
}

function failOnFindings(findings) {
  if (findings.length > 0) {
    throw new Error(formatSecurityFindings(findings));
  }
}

function securityChecksFromEnv() {
  return String(process.env.SECURITY_CHECKS || 'xss')
    .split(',')
    .map((check) => check.trim())
    .filter(Boolean);
}

function actionsThroughGroup(actions, group) {
  const lastActionId = group.actionIds[group.actionIds.length - 1];
  const lastActionIndex = actions.findIndex((action) => action.id === lastActionId);
  return actions.slice(0, lastActionIndex + 1);
}

function logDemo(message) {
  if (process.env.SECURITY_DEMO === '1') {
    console.log(`[security-demo] ${message}`);
  }
}

async function waitForObservedRequest(observer, predicate, timeoutMs = 3000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (observer.snapshot().responses.some(predicate)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
}
