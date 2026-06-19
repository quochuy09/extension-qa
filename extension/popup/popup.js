const storageKey = 'factoryRecorderState';

const statusEl = document.querySelector('#status');
const actionCountEl = document.querySelector('#action-count');
const testCaseNameEl = document.querySelector('#test-case-name');
const testCaseDescriptionEl = document.querySelector('#test-case-description');
const startUrlEl = document.querySelector('#start-url');
const importLogEl = document.querySelector('#import-log');
const replayStartUrlEl = document.querySelector('#replay-start-url');
const replayImportLogEl = document.querySelector('#replay-import-log');
const dataStartUrlEl = document.querySelector('#data-start-url');
const dataImportLogEl = document.querySelector('#data-import-log');
const replaySpeedEl = document.querySelector('#replay-speed');
const csvFileEl = document.querySelector('#csv-file');
const replayActionLogNameEl = document.querySelector('#replay-action-log-name');
const dataActionLogNameEl = document.querySelector('#data-action-log-name');
const datasetSummaryEl = document.querySelector('#dataset-summary');
const bindingListEl = document.querySelector('#binding-list');
const reportSummaryEl = document.querySelector('#report-summary');
const reportListEl = document.querySelector('#report-list');
const suiteNameEl = document.querySelector('#suite-name');
const importFlowEl = document.querySelector('#import-flow');
const suiteFlowListEl = document.querySelector('#suite-flow-list');
const suiteBindingListEl = document.querySelector('#suite-binding-list');
const groupListEl = document.querySelector('#group-list');
const stepListEl = document.querySelector('#step-list');
const messageEl = document.querySelector('#message');
let runnerTabId = null;
const panelStatusDots = {
  record: document.querySelector('#record-status-dot'),
  replay: document.querySelector('#replay-status-dot'),
  data: document.querySelector('#data-status-dot'),
  suite: document.querySelector('#suite-status-dot')
};

document.addEventListener('click', (event) => {
  const target = event.target.closest('button, .file-button');
  if (!target) {
    return;
  }

  target.classList.add('button-flash');
  window.setTimeout(() => target.classList.remove('button-flash'), 350);
});

document.querySelectorAll('.tab-button').forEach((button) => {
  button.addEventListener('click', () => {
    activateTab(button.dataset.tab);
  });
});

document.querySelector('#start').addEventListener('click', async () => {
  setPanelStatus('record', 'running');
  const state = await getState();
  if (!state.startUrl) {
    const pageContext = await sendToActiveTab({ type: 'FACTORY_GET_PAGE_CONTEXT' });
    if (pageContext?.url) {
      await patchState({ startUrl: pageContext.url });
    }
  }
  await sendToActiveTab({ type: 'FACTORY_RECORDER_START' }, { focusAfterSend: true });
  await refresh();
});

document.querySelector('#stop').addEventListener('click', async () => {
  await sendToActiveTab({ type: 'FACTORY_RECORDER_STOP' });
  setPanelStatus('record', 'stopped');
  await refresh();
});

document.querySelector('#clear').addEventListener('click', async () => {
  await sendToActiveTab({ type: 'FACTORY_RECORDER_CLEAR' });
  setPanelStatus('record', 'idle');
  await refresh();
});

document.querySelector('#run-all').addEventListener('click', async () => {
  const state = await getState();
  const normalized = window.FactoryActionNormalizer.normalizeRecording(state);
  const actions = expandActionsByRepeat(normalized.actions, normalized.groups);
  setPanelStatus('replay', 'running');
  await navigateToUrl(state.startUrl || normalized.session.startUrl);
  await replayActions(actions, 'all steps', { skipScreenCheck: true });
  setPanelStatus('replay', 'stopped');
});

document.querySelector('#run-csv').addEventListener('click', async () => {
  const state = await getState();
  await runCsvLoop(state);
});

document.querySelector('#replay-stop').addEventListener('click', async () => {
  await stopReplay('Replay stop requested.');
  setPanelStatus('replay', 'stopped');
});

document.querySelector('#data-stop').addEventListener('click', async () => {
  await stopReplay('Data loop stop requested.');
  setPanelStatus('data', 'stopped');
});

document.querySelector('#replay-clear').addEventListener('click', async () => {
  await clearRecordingState();
  setPanelStatus('replay', 'idle');
  replayActionLogNameEl.textContent = 'No action log loaded';
  setMessage('Replay action log cleared.');
});

document.querySelector('#data-clear-log').addEventListener('click', async () => {
  await clearRecordingState();
  setPanelStatus('data', 'idle');
  dataActionLogNameEl.textContent = 'No action log loaded';
  setMessage('Data action log cleared.');
});

document.querySelector('#run-suite').addEventListener('click', async () => {
  await runSuiteInBackground();
});

document.querySelector('#run-suite-csv').addEventListener('click', async () => {
  const state = await getState();
  await runSuite(state, { useCsv: true });
});

document.querySelector('#download-current-flow').addEventListener('click', async () => {
  const state = await getState();
  await downloadCurrentSuiteFlow(state);
});

document.querySelector('#clear-csv').addEventListener('click', async () => {
  await patchState({
    dataset: null,
    datasetBindings: {},
    lastCsvRun: null
  });
  csvFileEl.value = '';
  setPanelStatus('data', 'idle');
  setMessage('CSV dataset cleared.');
});

document.querySelector('#export-report').addEventListener('click', async () => {
  const state = await getState();
  downloadJson(buildReportData(state), 'manual-qc-run-report.json');
  setMessage('Downloaded manual-qc-run-report.json');
});

document.querySelector('#export-report-html').addEventListener('click', async () => {
  const state = await getState();
  downloadText(buildReportHtml(buildReportData(state)), 'manual-qc-run-report.html', 'text/html');
  setMessage('Downloaded manual-qc-run-report.html');
});

document.querySelector('#download').addEventListener('click', async () => {
  const state = await getState();
  const actionLog = window.FactoryActionNormalizer.normalizeRecording(state);
  const fileName = `${sanitizeFileName(actionLog.testCase?.name || state.testCaseName, 'action-log')}.json`;
  downloadJson(actionLog, fileName);
  setMessage(`Downloaded ${fileName}`);
});

document.querySelector('#save-local').addEventListener('click', async () => {
  const state = await getState();
  const actionLog = window.FactoryActionNormalizer.normalizeRecording(state);
  const response = await fetch('http://localhost:4173/api/recordings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(actionLog)
  });

  if (!response.ok) {
    setMessage('Save failed. Is npm start running?');
    return;
  }

  const result = await response.json();
  setMessage(`Saved ${result.actionCount} steps to logs/action-log.json and ${pathFileName(result.namedPath)}`);
});

document.querySelector('#load-local').addEventListener('click', async () => {
  const response = await fetch('http://localhost:4173/api/recordings/latest');
  if (!response.ok) {
    setMessage('Load Local failed. Save Local once and restart npm start if needed.');
    return;
  }

  const actionLog = await response.json();
  await importActionLog(actionLog);
  setMessage(`Loaded ${actionLog.actions?.length || 0} steps from logs/action-log.json`);
});

testCaseNameEl.addEventListener('change', async () => {
  await patchState({ testCaseName: testCaseNameEl.value.trim() || 'Recorded checkout flow' });
});

testCaseDescriptionEl.addEventListener('change', async () => {
  await patchState({ testCaseDescription: testCaseDescriptionEl.value.trim() });
});

startUrlEl.addEventListener('change', async () => {
  await patchState({ startUrl: startUrlEl.value.trim() });
});

replayStartUrlEl.addEventListener('change', async () => {
  await patchState({ startUrl: replayStartUrlEl.value.trim() });
});

dataStartUrlEl.addEventListener('change', async () => {
  await patchState({ startUrl: dataStartUrlEl.value.trim() });
});

suiteNameEl.addEventListener('change', async () => {
  const state = await getState();
  await patchState({
    suite: {
      ...state.suite,
      name: suiteNameEl.value.trim() || 'Manual QC Suite'
    }
  });
});

importLogEl.addEventListener('change', async () => {
  const file = importLogEl.files?.[0];
  if (!file) {
    return;
  }

  const imported = JSON.parse(await file.text());
  await importActionLog(imported);
  setActionLogFileName(importLogEl, file.name);
  setMessage(`Imported ${imported.actions?.length || 0} steps from ${file.name}`);
});

replayImportLogEl.addEventListener('change', async () => {
  await importActionLogFromInput(replayImportLogEl);
});

dataImportLogEl.addEventListener('change', async () => {
  await importActionLogFromInput(dataImportLogEl);
});

importFlowEl.addEventListener('change', async () => {
  const files = Array.from(importFlowEl.files || []);
  for (const file of files) {
    const actionLog = JSON.parse(await file.text());
    await addFlowFromActionLog(actionLog, null, file.name);
  }
  importFlowEl.value = '';
});

replaySpeedEl.addEventListener('change', async () => {
  await patchState({ replaySpeed: replaySpeedEl.value });
});

csvFileEl.addEventListener('change', async () => {
  const file = csvFileEl.files?.[0];
  if (!file) {
    return;
  }

  const text = await readTextFile(file);
  const dataset = {
    ...window.FactoryCsvEngine.parseCsv(text),
    name: file.name
  };
  await patchState({
    dataset,
    datasetBindings: {}
  });
  setMessage(`Loaded ${dataset.rowCount} row${dataset.rowCount === 1 ? '' : 's'} from ${file.name}`);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes[storageKey]) {
    render(withDefaults(changes[storageKey].newValue));
  }
});

refresh();

async function sendToActiveTab(message, options = {}) {
  const targetUrl = options.url || (await currentStartUrl());
  const tab = await getOrCreateDemoTab(targetUrl);
  if (!tab?.id) {
    await patchState({ lastError: 'Could not open the local demo shop tab.' });
    return null;
  }

  if (targetUrl && !isDemoUrl(tab.url)) {
    await navigateBrowserTab(tab.id, targetUrl);
  }

  const result = await sendMessageToTab(tab.id, message);
  if (options.focusAfterSend) {
    await focusTab(tab.id);
  }

  return result;
}

async function currentStartUrl() {
  const state = await getState();
  const normalized = window.FactoryActionNormalizer.normalizeRecording(state);
  return state.startUrl || normalized.session.startUrl || defaultDemoUrl();
}

async function getOrCreateDemoTab(targetUrl) {
  const runnerTab = await getRunnerTab();
  if (runnerTab?.id) {
    return runnerTab;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id && isDemoUrl(tab.url)) {
    runnerTabId = tab.id;
    return tab;
  }

  const existingTabs = await chrome.tabs.query({
    url: ['http://localhost:4173/*', 'http://127.0.0.1:4173/*']
  });
  const existing = existingTabs[0];
  if (existing?.id) {
    runnerTabId = existing.id;
    await waitForTabReady(existing.id);
    return chrome.tabs.get(existing.id);
  }

  const created = await chrome.tabs.create({
    url: targetUrl || defaultDemoUrl(),
    active: false
  });
  runnerTabId = created.id;
  await waitForTabReady(created.id);
  return chrome.tabs.get(created.id);
}

async function getRunnerTab() {
  if (!runnerTabId) {
    return null;
  }

  try {
    const tab = await chrome.tabs.get(runnerTabId);
    if (tab?.id && isDemoUrl(tab.url)) {
      return tab;
    }
  } catch {
    runnerTabId = null;
  }

  return null;
}

async function sendMessageToTab(tabId, message) {
  const attempts = 12;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch {
      await delay(250);
    }
  }

  await patchState({ lastError: 'Open or refresh the local demo shop tab before using the recorder.' });
  return null;
}

async function navigateBrowserTab(tabId, url) {
  await chrome.tabs.update(tabId, { url });
  await waitForTabReady(tabId);
}

async function focusTab(tabId) {
  const tab = await chrome.tabs.get(tabId);
  await chrome.tabs.update(tabId, { active: true });
  if (tab.windowId) {
    await chrome.windows.update(tab.windowId, { focused: true });
  }
}

function waitForTabReady(tabId) {
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 6000);

    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId !== tabId || changeInfo.status !== 'complete') {
        return;
      }

      window.clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    };

    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        return;
      }

      if (tab?.status === 'complete') {
        window.clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    });
  });
}

async function refresh() {
  const state = await getState();
  render(state);
}

function render(state) {
  const normalized = window.FactoryActionNormalizer.normalizeRecording(state);
  statusEl.textContent = state.isRecording ? 'Recording' : 'Idle';
  if (state.isRecording) {
    setPanelStatus('record', 'running');
  }
  actionCountEl.textContent = String(normalized.actions.length);
  testCaseNameEl.value = state.testCaseName || 'Recorded checkout flow';
  testCaseDescriptionEl.value = state.testCaseDescription || '';
  startUrlEl.value = state.startUrl || normalized.session.startUrl || '';
  replayStartUrlEl.value = state.startUrl || normalized.session.startUrl || '';
  dataStartUrlEl.value = state.startUrl || normalized.session.startUrl || '';
  replaySpeedEl.value = state.replaySpeed || 'demo';
  suiteNameEl.value = state.suite?.name || 'Manual QC Suite';
  renderRunnerStatus(state.runnerStatus);
  renderDataset(state, normalized.actions);
  renderSuite(state);
  renderReports(state);
  renderGroups(state, normalized.groups);
  renderSteps(normalized.actions);
}

function renderRunnerStatus(runnerStatus) {
  if (runnerStatus?.scope !== 'suite') {
    return;
  }

  if (runnerStatus.status === 'running') {
    setPanelStatus('suite', 'running');
    setMessage(runnerStatus.message || 'Suite is running.');
    return;
  }

  if (runnerStatus.status === 'passed' || runnerStatus.status === 'failed') {
    setPanelStatus('suite', 'stopped');
    setMessage(runnerStatus.message || 'Suite finished.');
  }
}

function renderDataset(state, actions) {
  const dataset = state.dataset;
  const inputActions = actions.filter(isCsvBindableAction);
  bindingListEl.innerHTML = '';

  if (!dataset?.columns?.length) {
    datasetSummaryEl.className = 'dataset-summary empty';
    datasetSummaryEl.textContent = 'No CSV loaded';
    bindingListEl.innerHTML = '';
    return;
  }

  datasetSummaryEl.className = 'dataset-summary';
  datasetSummaryEl.textContent = `${dataset.name}: ${dataset.rowCount} row${dataset.rowCount === 1 ? '' : 's'}, ${dataset.columns.length} column${dataset.columns.length === 1 ? '' : 's'}${dataset.truncated ? ' (limited to 100 rows)' : ''}`;

  if (inputActions.length === 0) {
    bindingListEl.innerHTML = '<div class="empty">No input steps to bind</div>';
    return;
  }

  for (const action of inputActions) {
    const row = document.createElement('div');
    row.className = 'binding-row';
    const currentBinding = state.datasetBindings?.[action.id]?.column || '';
    row.innerHTML = `
      <span>${escapeHtml(action.description || window.FactoryActionNormalizer.describeAction(action))}</span>
      <select data-action-id="${escapeHtml(action.id)}">
        <option value="">Recorded value</option>
        ${dataset.columns.map((column) => `<option value="${escapeHtml(column)}" ${column === currentBinding ? 'selected' : ''}>${escapeHtml(column)}</option>`).join('')}
      </select>
    `;

    row.querySelector('select').addEventListener('change', async (event) => {
      await updateDatasetBinding(action.id, event.target.value, dataset.id);
    });

    bindingListEl.appendChild(row);
  }
}

function renderSuite(state) {
  const suite = withSuiteDefaults(state.suite);
  suiteFlowListEl.innerHTML = '';
  suiteBindingListEl.innerHTML = '';

  if (suite.flows.length === 0) {
    suiteFlowListEl.innerHTML = '<div class="empty">No flows yet. Save current recording or import action-log files.</div>';
    return;
  }

  const orderedFlows = orderedSuiteFlows(suite);
  orderedFlows.forEach((flow) => {
    const node = document.createElement('article');
    node.className = 'flow-node';
    node.draggable = true;
    node.dataset.flowId = flow.flowId;
    node.innerHTML = `
      <span class="drag-handle" title="Drag to reorder">=</span>
      <div>
        <strong>${escapeHtml(flow.name)}</strong>
        <small>${flow.actionLog?.actions?.length || 0} step${flow.actionLog?.actions?.length === 1 ? '' : 's'}</small>
      </div>
      <button class="flow-remove" data-role="remove-flow" type="button" title="Remove flow">x</button>
    `;

    node.addEventListener('dragstart', () => {
      node.classList.add('dragging');
    });
    node.addEventListener('dragend', async () => {
      node.classList.remove('dragging');
      await persistSuiteOrderFromDom();
    });
    node.addEventListener('dragover', (event) => {
      event.preventDefault();
      const dragging = suiteFlowListEl.querySelector('.dragging');
      if (dragging && dragging !== node) {
        const rect = node.getBoundingClientRect();
        const insertBefore = event.clientY < rect.top + rect.height / 2;
        suiteFlowListEl.insertBefore(dragging, insertBefore ? node : node.nextSibling);
      }
    });

    node.querySelector('[data-role="remove-flow"]').addEventListener('click', async () => {
      await removeSuiteFlow(flow.flowId);
    });

    suiteFlowListEl.appendChild(node);
  });

  renderSuiteBindings(state, orderedFlows);
}

function renderSuiteBindings(state, flows) {
  const dataset = state.dataset;
  if (!dataset?.columns?.length || flows.length === 0) {
    return;
  }

  const title = document.createElement('div');
  title.className = 'dataset-summary';
  title.textContent = 'Suite CSV bindings';
  suiteBindingListEl.appendChild(title);

  for (const flow of flows) {
    const inputActions = (flow.actionLog?.actions || []).filter(isCsvBindableAction);
    if (inputActions.length === 0) {
      continue;
    }

    const flowHeader = document.createElement('div');
    flowHeader.className = 'screen';
    flowHeader.textContent = flow.name;
    suiteBindingListEl.appendChild(flowHeader);

    for (const action of inputActions) {
      const row = document.createElement('div');
      row.className = 'binding-row';
      const currentBinding = state.suiteBindings?.[flow.flowId]?.[action.id]?.column || '';
      row.innerHTML = `
        <span>${escapeHtml(action.description || window.FactoryActionNormalizer.describeAction(action))}</span>
        <select data-flow-id="${escapeHtml(flow.flowId)}" data-action-id="${escapeHtml(action.id)}">
          <option value="">Recorded value</option>
          ${dataset.columns.map((column) => `<option value="${escapeHtml(column)}" ${column === currentBinding ? 'selected' : ''}>${escapeHtml(column)}</option>`).join('')}
        </select>
      `;

      row.querySelector('select').addEventListener('change', async (event) => {
        await updateSuiteBinding(flow.flowId, action.id, event.target.value, dataset.id);
      });

      suiteBindingListEl.appendChild(row);
    }
  }
}

function renderGroups(state, groups) {
  groupListEl.innerHTML = '';

  if (groups.length === 0) {
    groupListEl.innerHTML = '<div class="empty">No groups yet</div>';
    return;
  }

  for (const group of groups) {
    const card = document.createElement('article');
    card.className = 'group-card';
    const settings = state.groupSettings?.[group.name] || {};
    const repeatEnabled = Boolean(settings.repeatEnabled || group.repeat.enabled);
    const repeatCount = Math.max(1, Number(settings.repeatCount || group.repeat.count || 1));

    card.innerHTML = `
      <div class="group-title">
        <div>
          <strong>${escapeHtml(group.name)}</strong>
          <div class="screen">${escapeHtml(group.screenName)}</div>
        </div>
        <span class="screen">${group.actionIds.length} step${group.actionIds.length === 1 ? '' : 's'}</span>
      </div>
      <div class="repeat-controls">
        <label>
          <input data-role="repeat-enabled" type="checkbox" ${repeatEnabled ? 'checked' : ''} />
          Repeat
        </label>
        <input data-role="repeat-count" type="number" min="1" max="999" value="${repeatCount}" ${repeatEnabled ? '' : 'disabled'} />
      </div>
      <div class="inline-edit">
        <label>Group name</label>
        <input data-role="group-name" type="text" value="${escapeHtml(group.name)}" />
        <label>Screen name</label>
        <input data-role="screen-name" type="text" value="${escapeHtml(group.screenName)}" />
      </div>
      <div class="group-actions">
        <button data-role="run-group" type="button">Run Group</button>
      </div>
    `;

    const checkbox = card.querySelector('[data-role="repeat-enabled"]');
    const countInput = card.querySelector('[data-role="repeat-count"]');
    const groupNameInput = card.querySelector('[data-role="group-name"]');
    const screenNameInput = card.querySelector('[data-role="screen-name"]');
    const groupKey = group.key || group.name;

    checkbox.addEventListener('change', async () => {
      countInput.disabled = !checkbox.checked;
      await updateGroupSettings(groupKey, {
        repeatEnabled: checkbox.checked,
        repeatCount: Math.max(1, Number(countInput.value || 1)),
        displayName: groupNameInput.value.trim() || groupKey,
        screenName: screenNameInput.value.trim() || group.screenName
      });
    });

    countInput.addEventListener('change', async () => {
      await updateGroupSettings(groupKey, {
        repeatEnabled: checkbox.checked,
        repeatCount: Math.max(1, Number(countInput.value || 1)),
        displayName: groupNameInput.value.trim() || groupKey,
        screenName: screenNameInput.value.trim() || group.screenName
      });
    });

    groupNameInput.addEventListener('change', async () => {
      await updateGroupSettings(groupKey, {
        displayName: groupNameInput.value.trim() || groupKey,
        screenName: screenNameInput.value.trim() || group.screenName,
        repeatEnabled: checkbox.checked,
        repeatCount: Math.max(1, Number(countInput.value || 1))
      });
    });

    screenNameInput.addEventListener('change', async () => {
      await updateGroupSettings(groupKey, {
        displayName: groupNameInput.value.trim() || groupKey,
        screenName: screenNameInput.value.trim() || group.screenName,
        repeatEnabled: checkbox.checked,
        repeatCount: Math.max(1, Number(countInput.value || 1))
      });
    });

    card.querySelector('[data-role="run-group"]').addEventListener('click', async () => {
      const currentState = await getState();
      const normalized = window.FactoryActionNormalizer.normalizeRecording(currentState);
      const currentGroup = normalized.groups.find((item) => (item.key || item.name) === groupKey);
      const actions = actionsForGroup(normalized.actions, currentGroup);
      await runReplayGroup(actions, currentGroup, group.name);
    });

    groupListEl.appendChild(card);
  }
}

function renderSteps(actions) {
  stepListEl.innerHTML = '';

  if (actions.length === 0) {
    stepListEl.innerHTML = '<li class="empty">Start recording and interact with the demo shop.</li>';
    return;
  }

  actions.forEach((action, index) => {
    const item = document.createElement('li');
    item.dataset.actionId = action.id;
    const selectors = action.selectors || {};
    item.innerHTML = `
      <details class="step-card">
        <summary>
          <span class="step-index">${index + 1}</span>
          <span class="step-main">
            <strong>${escapeHtml(action.description || window.FactoryActionNormalizer.describeAction(action))}</strong>
            <span>${escapeHtml(action.groupName)} - ${escapeHtml(action.screenName)}</span>
            <span class="selector">${escapeHtml(action.primarySelector || action.elementSignature || '')}</span>
          </span>
          <button data-role="run-step" type="button">Run</button>
          <button class="danger" data-role="delete-step" type="button">Delete</button>
        </summary>
        <div class="step-meta">
          <label>Step description</label>
          <input data-role="step-description" type="text" value="${escapeHtml(action.description || window.FactoryActionNormalizer.describeAction(action))}" />
          <dl class="selector-grid">
            ${selectorRow('testId', selectors.testId)}
            ${selectorRow('id', selectors.id)}
            ${selectorRow('role', selectors.roleText)}
            ${selectorRow('css', selectors.css)}
            ${selectorRow('xpath', selectors.xpath)}
          </dl>
        </div>
      </details>
    `;

    item.querySelector('[data-role="delete-step"]').addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await deleteRawAction(action);
    });

    item.querySelector('[data-role="run-step"]').addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await replayActions([action], `step ${index + 1}`);
    });

    item.querySelector('[data-role="step-description"]').addEventListener('change', async (event) => {
      await updateStepDescription(action.id, event.target.value.trim());
    });

    stepListEl.appendChild(item);
  });
}

async function replayActions(actions, label, options = {}) {
  if (actions.length === 0) {
    setMessage(`Nothing to run for ${label}.`);
    return;
  }

  if (!options.skipScreenCheck) {
    const canReplay = await confirmScreenContext(actions[0]);
    if (!canReplay) {
      setMessage('Replay cancelled because current screen does not match the first step.');
      return {
        ok: false,
        error: 'Replay cancelled by wrong-screen warning.',
        results: []
      };
    }
  }

  markReplayPending(actions);
  const result = await sendToActiveTab({
    type: 'FACTORY_REPLAY_ACTIONS',
    actions,
    options: {
      speed: replaySpeedEl.value || 'demo'
    }
  });

  if (!result) {
    setMessage('Replay failed. Open the local demo shop tab first.');
    return {
      ok: false,
      error: 'Replay failed because the active demo tab did not respond.',
      results: []
    };
  }

  if (result.ok) {
    applyReplayResults(result.results || []);
    const last = result.results[result.results.length - 1];
    if (options.recordRun !== false) {
      await patchState({
        lastReplayRun: {
          completedAt: new Date().toISOString(),
          label,
          ok: true,
          results: result.results
        },
        lastSuiteRun: null
      });
    }
    setMessage(`Replay passed: ${label}. Last step: ${last?.description || 'completed'}`);
    return result;
  }

  const failed = result.results?.[result.results.length - 1];
  applyReplayResults(result.results || []);
  if (options.recordRun !== false) {
    await patchState({
      lastReplayRun: {
        completedAt: new Date().toISOString(),
        label,
        ok: false,
        results: result.results || [],
        error: failed?.error || result.error
      },
      lastSuiteRun: null
    });
  }
  setMessage(`Replay failed: ${failed?.description || failed?.actionId || 'unknown step'} - ${failed?.error || result.error}`);
  return result;
}

function markReplayPending(actions) {
  clearStepStatuses();
  actions.forEach((action, index) => {
    const node = stepListEl.querySelector(`[data-action-id="${cssEscape(action.id)}"]`);
    if (node) {
      node.classList.add(index === 0 ? 'status-running' : 'status-pending');
    }
  });
}

function applyReplayResults(results) {
  clearStepStatuses();
  results.forEach((result) => {
    const node = stepListEl.querySelector(`[data-action-id="${cssEscape(result.actionId)}"]`);
    if (!node) {
      return;
    }

    node.classList.add(result.status === 'failed' ? 'status-failed' : 'status-passed');
  });
}

function clearStepStatuses() {
  stepListEl.querySelectorAll('li').forEach((node) => {
    node.classList.remove('status-running', 'status-pending', 'status-passed', 'status-failed');
  });
}

async function confirmScreenContext(firstAction) {
  const pageContext = await sendToActiveTab({ type: 'FACTORY_GET_PAGE_CONTEXT' });
  if (!pageContext?.ok || !firstAction?.url) {
    return true;
  }

  const expectedRoute = routeFromUrl(firstAction.url);
  const currentRoute = pageContext.route;
  if (expectedRoute === currentRoute) {
    return true;
  }

  return window.confirm(`The first step was recorded on "${expectedRoute}", but the current screen is "${currentRoute}". Continue replay anyway?`);
}

async function runReplayGroup(actions, group, groupName) {
  if (actions.length === 0) {
    setMessage(`Nothing to run for ${groupName}.`);
    return;
  }

  setPanelStatus('replay', 'running');
  const repeatCount = group?.repeat?.enabled ? Math.max(1, Number(group.repeat.count || 1)) : 1;
  let lastResult = null;

  for (let index = 0; index < repeatCount; index += 1) {
    await navigateToFirstAction(actions);
    lastResult = await replayActions(actions, `${groupName} group ${index + 1}/${repeatCount}`, { skipScreenCheck: true });

    if (!lastResult?.ok) {
      setPanelStatus('replay', 'stopped');
      return lastResult;
    }
  }

  setPanelStatus('replay', 'stopped');
  return lastResult;
}

async function runCsvLoop(state) {
  const normalized = window.FactoryActionNormalizer.normalizeRecording(state);
  const dataset = state.dataset;

  if (!dataset?.rows?.length) {
    setMessage('CSV loop needs a loaded dataset.');
    return;
  }

  setPanelStatus('data', 'running');
  const baseActions = expandActionsByRepeat(normalized.actions, normalized.groups);
  const bindings = state.datasetBindings || {};
  const results = [];

  for (let rowIndex = 0; rowIndex < dataset.rows.length; rowIndex += 1) {
    const row = dataset.rows[rowIndex];
    const actions = window.FactoryCsvEngine.applyBindings(baseActions, bindings, row);
    setMessage(`Running CSV row ${rowIndex + 1}/${dataset.rows.length}`);
    await navigateToFirstAction(actions);
    const result = await replayActions(actions, `CSV row ${rowIndex + 1}`, { skipScreenCheck: true, recordRun: false });
    const failure = await failureDetails(result, `CSV row ${rowIndex + 1} failed before any step result was returned.`);
    results.push({
      rowIndex: rowIndex + 1,
      ok: Boolean(result?.ok),
      lastStep: failure.lastStep,
      failedStep: result?.ok ? null : failure.failedStep,
      error: result?.ok ? null : failure.error,
      screenshot: result?.ok ? null : failure.screenshot
    });

    if (!result?.ok) {
      await patchState({ lastCsvRun: { completedAt: new Date().toISOString(), results }, lastSuiteRun: null, lastReplayRun: null });
      setPanelStatus('data', 'stopped');
      setMessage(`CSV loop stopped at row ${rowIndex + 1}: ${results[results.length - 1].error}`);
      return;
    }
  }

  await patchState({ lastCsvRun: { completedAt: new Date().toISOString(), results }, lastSuiteRun: null, lastReplayRun: null });
  setPanelStatus('data', 'stopped');
  setMessage(`CSV loop passed: ${results.length} row${results.length === 1 ? '' : 's'}.`);
}

async function runSuite(state, { useCsv }) {
  runnerTabId = null;
  const suite = withSuiteDefaults(state.suite);
  const flows = orderedSuiteFlows(suite);
  if (flows.length === 0) {
    setMessage('Suite needs at least one flow.');
    return;
  }

  setPanelStatus('suite', 'running');
  if (useCsv) {
    await runSuiteCsv(state, flows);
    setPanelStatus('suite', 'stopped');
    return;
  }

  const results = [];
  for (let flowIndex = 0; flowIndex < flows.length; flowIndex += 1) {
    const flow = flows[flowIndex];
    setMessage(`Running suite flow ${flowIndex + 1}/${flows.length}: ${flow.name}`);
    const result = await runSingleFlow(flow, null, { label: flow.name });
    const failure = await failureDetails(result, `${flow.name} failed before any step result was returned.`);
    results.push({
      flowId: flow.flowId,
      flowName: flow.name,
      ok: Boolean(result?.ok),
      lastStep: failure.lastStep,
      failedStep: result?.ok ? null : failure.failedStep,
      error: result?.ok ? null : failure.error,
      screenshot: result?.ok ? null : failure.screenshot
    });

    if (!result?.ok) {
      await patchState({ lastSuiteRun: { completedAt: new Date().toISOString(), useCsv: false, results }, lastCsvRun: null, lastReplayRun: null });
      setPanelStatus('suite', 'stopped');
      setMessage(`Suite stopped at ${flow.name}: ${results[results.length - 1].error}`);
      return;
    }
  }

  await patchState({ lastSuiteRun: { completedAt: new Date().toISOString(), useCsv: false, results }, lastCsvRun: null, lastReplayRun: null });
  setPanelStatus('suite', 'stopped');
  setMessage(`Suite passed: ${results.length} flow${results.length === 1 ? '' : 's'}.`);
}

async function runSuiteInBackground() {
  setPanelStatus('suite', 'running');
  setMessage('Suite run started in background.');

  try {
    const result = await chrome.runtime.sendMessage({ type: 'FACTORY_RUN_SUITE' });
    setPanelStatus('suite', result?.ok ? 'stopped' : 'stopped');
    setMessage(result?.ok ? 'Suite passed. Report updated.' : `Suite failed. ${result?.error || 'Report updated.'}`);
    await refresh();
  } catch (error) {
    setPanelStatus('suite', 'stopped');
    setMessage(`Suite runner failed to start: ${error.message}`);
  }
}

async function runSuiteCsv(state, flows) {
  runnerTabId = null;
  const dataset = state.dataset;
  if (!dataset?.rows?.length) {
    setMessage('Suite CSV needs a loaded dataset.');
    return;
  }

  const results = [];
  for (let rowIndex = 0; rowIndex < dataset.rows.length; rowIndex += 1) {
    const row = dataset.rows[rowIndex];
    for (const flow of flows) {
      setMessage(`Running row ${rowIndex + 1}/${dataset.rows.length}: ${flow.name}`);
      const result = await runSingleFlow(flow, row, { label: `CSV row ${rowIndex + 1} - ${flow.name}` });
      const failure = await failureDetails(result, `${flow.name} failed before any step result was returned.`);
      results.push({
        rowIndex: rowIndex + 1,
        flowId: flow.flowId,
        flowName: flow.name,
        ok: Boolean(result?.ok),
        lastStep: failure.lastStep,
        failedStep: result?.ok ? null : failure.failedStep,
        error: result?.ok ? null : failure.error,
        screenshot: result?.ok ? null : failure.screenshot
      });

      if (!result?.ok) {
        await patchState({ lastCsvRun: { completedAt: new Date().toISOString(), suite: true, results }, lastSuiteRun: null, lastReplayRun: null });
        setMessage(`Suite CSV stopped at row ${rowIndex + 1}, flow ${flow.name}: ${results[results.length - 1].error}`);
        return;
      }
    }
  }

  await patchState({ lastCsvRun: { completedAt: new Date().toISOString(), suite: true, results }, lastSuiteRun: null, lastReplayRun: null });
  setMessage(`Suite CSV passed: ${dataset.rows.length} row${dataset.rows.length === 1 ? '' : 's'}, ${flows.length} flow${flows.length === 1 ? '' : 's'}.`);
}

async function runSingleFlow(flow, csvRow, { label }) {
  let actions = flow.actionLog?.actions || [];
  if (csvRow) {
    const state = await getState();
    actions = window.FactoryCsvEngine.applyBindings(actions, state.suiteBindings?.[flow.flowId] || {}, csvRow);
  }

  await navigateToUrl(flow.startUrl || flow.actionLog?.session?.startUrl || actions[0]?.url);

  return replayActions(actions, label, { skipScreenCheck: true, recordRun: false });
}

async function failureDetails(result, fallbackError) {
  const results = result?.results || [];
  const last = results[results.length - 1] || null;
  const ok = Boolean(result?.ok);

  return {
    lastStep: last?.description || null,
    failedStep: ok ? null : last?.description || 'No step result captured',
    error: ok ? null : last?.error || result?.error || fallbackError,
    screenshot: ok ? null : await captureFailureScreenshot()
  };
}

function captureFailureScreenshot() {
  return new Promise((resolve) => {
    try {
      chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
        if (chrome.runtime.lastError || !dataUrl) {
          resolve(null);
          return;
        }

        resolve(dataUrl);
      });
    } catch {
      resolve(null);
    }
  });
}

async function navigateToFirstAction(actions) {
  const firstUrl = actions[0]?.url;
  if (!firstUrl) {
    return;
  }

  await navigateToUrl(firstUrl);
}

function expandActionsByRepeat(actions, groups) {
  return groups.flatMap((group) => expandGroupActions(actionsForGroup(actions, group), group));
}

function actionsForGroup(actions, group) {
  if (!group) {
    return [];
  }

  return group.actionIds.map((actionId) => actions.find((action) => action.id === actionId)).filter(Boolean);
}

function expandGroupActions(actions, group) {
  const repeatCount = group?.repeat?.enabled ? Math.max(1, Number(group.repeat.count || 1)) : 1;
  const expanded = [];

  for (let index = 0; index < repeatCount; index += 1) {
    expanded.push(...actions);
  }

  return expanded;
}

async function updateGroupSettings(groupName, nextSettings) {
  const state = await getState();
  await patchState({
    groupSettings: {
      ...state.groupSettings,
      [groupName]: {
        ...(state.groupSettings?.[groupName] || {}),
        ...nextSettings
      }
    }
  });
}

async function updateDatasetBinding(actionId, column, datasetId) {
  const state = await getState();
  const nextBindings = {
    ...(state.datasetBindings || {})
  };

  if (!column) {
    delete nextBindings[actionId];
  } else {
    nextBindings[actionId] = {
      datasetId,
      column
    };
  }

  await patchState({ datasetBindings: nextBindings });
}

async function addFlowFromActionLog(actionLog, state = null, fileName = null) {
  const currentState = state || (await getState());
  const suite = withSuiteDefaults(currentState.suite);
  const flowId = `flow-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const flow = {
    flowId,
    name: actionLog.testCase?.name || fileName?.replace(/\.json$/i, '') || `Flow ${suite.flows.length + 1}`,
    startUrl: actionLog.session?.startUrl || actionLog.actions?.[0]?.url || currentState?.startUrl || '',
    startBehavior: suite.flows.length === 0 ? 'navigate' : 'continue',
    actionLog
  };

  const nextSuite = {
    ...suite,
    flows: [...suite.flows, flow],
    runOrder: [...suite.runOrder, flowId]
  };

  await patchState({ suite: nextSuite });
  setMessage(`Added flow: ${flow.name}`);
}

async function downloadCurrentSuiteFlow(state) {
  const suite = withSuiteDefaults(state.suite);
  const flows = orderedSuiteFlows(suite);
  const sourceFlows = flows.length > 0 ? flows : [{
    flowId: 'current-recording',
    name: state.testCaseName || 'Current Flow',
    actionLog: window.FactoryActionNormalizer.normalizeRecording(state)
  }];

  const mergedActions = [];
  const groups = [];
  sourceFlows.forEach((flow) => {
    const flowActions = flow.actionLog?.actions || [];
    const actionIds = [];
    flowActions.forEach((action) => {
      const actionId = `act-${String(mergedActions.length + 1).padStart(3, '0')}`;
      mergedActions.push({
        ...action,
        id: actionId,
        groupName: flow.name
      });
      actionIds.push(actionId);
    });

    if (actionIds.length > 0) {
      groups.push({
        key: flow.flowId,
        name: flow.name,
        screenName: flow.name,
        actionIds,
        repeat: {
          enabled: false,
          count: 1
        }
      });
    }
  });

  const suiteName = suite.name || state.testCaseName || 'Manual QC Suite';
  const mergedFlow = {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    source: 'suite-builder',
    testCase: {
      name: suiteName,
      description: 'Merged flow downloaded from Suite Builder'
    },
    session: {
      startUrl: mergedActions[0]?.url || sourceFlows[0]?.actionLog?.session?.startUrl || ''
    },
    metadata: {
      flowCount: sourceFlows.length,
      actionCount: mergedActions.length
    },
    actions: mergedActions,
    groups
  };
  const fileName = `${sanitizeFileName(suiteName, 'merged-flow')}.json`;
  downloadJson(mergedFlow, fileName);
  setMessage(`Downloaded merged flow: ${fileName}`);
}

async function updateSuiteFlow(flowId, patch) {
  const state = await getState();
  const suite = withSuiteDefaults(state.suite);
  await patchState({
    suite: {
      ...suite,
      flows: suite.flows.map((flow) => (flow.flowId === flowId ? { ...flow, ...patch } : flow))
    }
  });
}

async function removeSuiteFlow(flowId) {
  const state = await getState();
  const suite = withSuiteDefaults(state.suite);
  const nextBindings = { ...(state.suiteBindings || {}) };
  delete nextBindings[flowId];
  await patchState({
    suite: {
      ...suite,
      flows: suite.flows.filter((flow) => flow.flowId !== flowId),
      runOrder: suite.runOrder.filter((id) => id !== flowId)
    },
    suiteBindings: nextBindings
  });
}

async function persistSuiteOrderFromDom() {
  const state = await getState();
  const suite = withSuiteDefaults(state.suite);
  const runOrder = Array.from(suiteFlowListEl.querySelectorAll('.flow-node')).map((node) => node.dataset.flowId);
  await patchState({
    suite: {
      ...suite,
      runOrder
    }
  });
}

async function updateSuiteBinding(flowId, actionId, column, datasetId) {
  const state = await getState();
  const suiteBindings = {
    ...(state.suiteBindings || {}),
    [flowId]: {
      ...(state.suiteBindings?.[flowId] || {})
    }
  };

  if (!column) {
    delete suiteBindings[flowId][actionId];
  } else {
    suiteBindings[flowId][actionId] = {
      datasetId,
      column
    };
  }

  await patchState({ suiteBindings });
}

async function updateStepDescription(actionId, description) {
  const state = await getState();
  await patchState({
    customStepDescriptions: {
      ...(state.customStepDescriptions || {}),
      [actionId]: description
    }
  });
}

async function deleteRawAction(actionToDelete) {
  const state = await getState();
  const rawActions = state.rawActions.filter((action) => action.id !== actionToDelete.id && action.timestamp !== actionToDelete.timestamp);
  await patchState({ rawActions });
}

async function importActionLog(actionLog) {
  const importBatchId = `import-${Date.now()}`;
  const importedActions = (actionLog.actions || []).map((action) => ({
    ...action,
    importBatchId
  }));
  const groupSettings = {};
  for (const group of actionLog.groups || []) {
    groupSettings[group.key || group.name] = {
      displayName: group.name,
      screenName: group.screenName,
      repeatEnabled: Boolean(group.repeat?.enabled),
      repeatCount: Math.max(1, Number(group.repeat?.count || 1))
    };
  }

  await patchState({
    rawActions: importedActions,
    testCaseName: actionLog.testCase?.name || 'Imported recording',
    testCaseDescription: actionLog.testCase?.description || '',
    startUrl: actionLog.session?.startUrl || importedActions[0]?.url || '',
    groupSettings,
    customStepDescriptions: Object.fromEntries(importedActions.map((action) => [action.id, action.description]).filter(([, description]) => description)),
    dataset: null,
    datasetBindings: {},
    lastReplayRun: null,
    lastCsvRun: null
  });
}

async function importActionLogFromInput(input) {
  const file = input.files?.[0];
  if (!file) {
    return;
  }

  const imported = JSON.parse(await file.text());
  await importActionLog(imported);
  setActionLogFileName(input, file.name);
  setMessage(`Imported ${imported.actions?.length || 0} steps from ${file.name}`);
}

async function stopReplay(message) {
  await sendToActiveTab({ type: 'FACTORY_REPLAY_STOP' });
  setMessage(message);
}

async function clearRecordingState() {
  await sendToActiveTab({ type: 'FACTORY_RECORDER_CLEAR' });
  await patchState({
    rawActions: [],
    groupSettings: {},
    customStepDescriptions: {},
    lastReplayRun: null,
    lastSuiteRun: null,
    lastCsvRun: null
  });
}

function buildReportData(state) {
  return {
    exportedAt: new Date().toISOString(),
    testCaseName: state.testCaseName,
    lastReplayRun: state.lastReplayRun || null,
    lastSuiteRun: state.lastSuiteRun || null,
    lastCsvRun: state.lastCsvRun || null
  };
}

function buildReportHtml(report) {
  const sections = reportSections(report).join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Manual QC Run Report</title>
    <style>
      body { font-family: Arial, Helvetica, sans-serif; margin: 32px; color: #18202a; }
      h1 { margin-bottom: 4px; }
      .muted { color: #637083; }
      section { margin-top: 24px; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th, td { border: 1px solid #d7dee7; padding: 8px; text-align: left; font-size: 14px; }
      th { background: #f6f7f9; }
      .pass { color: #146c5f; font-weight: 700; }
      .fail { color: #a33a2b; font-weight: 700; }
      .error-cell { display: grid; gap: 8px; }
      .screenshot { max-width: 280px; border: 1px solid #d7dee7; border-radius: 6px; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(report.testCaseName || 'Manual QC Run Report')}</h1>
    <p class="muted">Exported at ${escapeHtml(report.exportedAt)}</p>
    ${sections || '<p>No run results.</p>'}
  </body>
</html>`;
}

function reportSections(report) {
  if (report.lastSuiteRun?.results?.length) {
    return [htmlSuiteSection('Suite', report.lastSuiteRun.results)];
  }

  if (report.lastCsvRun?.results?.length) {
    return [htmlCsvSection('CSV', report.lastCsvRun.results)];
  }

  return [htmlRunSection('Replay', report.lastReplayRun?.results || [])];
}

function htmlRunSection(title, results) {
  if (!results.length) {
    return '';
  }

  return `<section>
    <h2>${escapeHtml(title)}</h2>
    <table>
      <thead><tr><th>Step</th><th>Status</th><th>Description</th><th>Error</th></tr></thead>
      <tbody>
        ${results
          .map(
            (result) => `<tr>
              <td>${escapeHtml(result.stepIndex || result.actionId || '-')}</td>
              <td class="${result.status === 'failed' ? 'fail' : 'pass'}">${escapeHtml(result.status || (result.ok ? 'passed' : 'failed'))}</td>
              <td>${escapeHtml(result.description || '-')}</td>
              <td>${escapeHtml(result.error || '')}</td>
            </tr>`
          )
          .join('')}
      </tbody>
    </table>
  </section>`;
}

function htmlSuiteSection(title, results) {
  if (!results.length) {
    return '';
  }

  return `<section>
    <h2>${escapeHtml(title)}</h2>
    <table>
      <thead><tr><th>Flow</th><th>Status</th><th>Last step</th><th>Failed step</th><th>Error</th></tr></thead>
      <tbody>
        ${results
          .map(
            (result) => `<tr>
              <td>${escapeHtml(result.flowName || result.flowId || '-')}</td>
              <td class="${result.ok ? 'pass' : 'fail'}">${result.ok ? 'passed' : 'failed'}</td>
              <td>${escapeHtml(result.lastStep || '')}</td>
              <td>${escapeHtml(result.failedStep || '')}</td>
              <td>${htmlErrorCell(result)}</td>
            </tr>`
          )
          .join('')}
      </tbody>
    </table>
  </section>`;
}

function htmlCsvSection(title, results) {
  if (!results.length) {
    return '';
  }

  return `<section>
    <h2>${escapeHtml(title)}</h2>
    <table>
      <thead><tr><th>Row</th><th>Flow</th><th>Status</th><th>Last step</th><th>Failed step</th><th>Error</th></tr></thead>
      <tbody>
        ${results
          .map(
            (result) => `<tr>
              <td>${escapeHtml(result.rowIndex || '-')}</td>
              <td>${escapeHtml(result.flowName || '-')}</td>
              <td class="${result.ok ? 'pass' : 'fail'}">${result.ok ? 'passed' : 'failed'}</td>
              <td>${escapeHtml(result.lastStep || '')}</td>
              <td>${escapeHtml(result.failedStep || '')}</td>
              <td>${htmlErrorCell(result)}</td>
            </tr>`
          )
          .join('')}
      </tbody>
    </table>
  </section>`;
}

function htmlErrorCell(result) {
  const screenshot = result.screenshot
    ? `<a href="${result.screenshot}" target="_blank" rel="noreferrer"><img class="screenshot" src="${result.screenshot}" alt="Failure screenshot" /></a>`
    : '';

  if (!result.error && !screenshot) {
    return '';
  }

  return `<div class="error-cell">
    ${result.error ? `<div>${escapeHtml(result.error)}</div>` : ''}
    ${screenshot}
  </div>`;
}

function renderReports(state) {
  reportListEl.innerHTML = '';
  const suiteResults = state.lastSuiteRun?.results || [];
  const csvResults = state.lastCsvRun?.results || [];
  const replayResults = state.lastReplayRun?.results || [];

  if (suiteResults.length > 0) {
    const passed = suiteResults.filter((result) => result.ok).length;
    reportSummaryEl.className = 'dataset-summary';
    reportSummaryEl.textContent = `Suite run: ${passed}/${suiteResults.length} flows passed`;
    suiteResults.forEach((result) => {
      reportListEl.appendChild(reportRow(result.flowName, result.ok, result.ok ? 'Completed' : result.failedStep || result.error || 'Failed without detailed step data'));
    });
    return;
  }

  if (csvResults.length > 0) {
    const passed = csvResults.filter((result) => result.ok).length;
    reportSummaryEl.className = 'dataset-summary';
    reportSummaryEl.textContent = state.lastCsvRun?.suite
      ? `Suite CSV run: ${passed}/${csvResults.length} flow executions passed`
      : `CSV run: ${passed}/${csvResults.length} rows passed`;
    csvResults.forEach((result) => {
      const label = result.flowName ? `Row ${result.rowIndex} - ${result.flowName}` : `Row ${result.rowIndex}`;
      reportListEl.appendChild(reportRow(label, result.ok, result.ok ? 'Completed' : result.failedStep || result.error || 'Failed without detailed step data'));
    });
    return;
  }

  if (replayResults.length > 0) {
    const passed = replayResults.filter((result) => result.status === 'passed').length;
    reportSummaryEl.className = 'dataset-summary';
    reportSummaryEl.textContent = `Replay: ${passed}/${replayResults.length} steps passed`;
    replayResults.forEach((result) => {
      reportListEl.appendChild(reportRow(`Step ${result.stepIndex}`, result.status === 'passed', result.description || result.error || 'Completed'));
    });
    return;
  }

  reportSummaryEl.className = 'dataset-summary empty';
  reportSummaryEl.textContent = 'No runs yet';
}

function reportRow(label, ok, detail) {
  const row = document.createElement('div');
  row.className = 'report-row';
  row.innerHTML = `
    <span class="report-status ${ok ? 'pass' : 'fail'}">${ok ? 'PASS' : 'FAIL'}</span>
    <span>${escapeHtml(label)} - ${escapeHtml(detail)}</span>
  `;
  return row;
}

function routeFromUrl(url) {
  try {
    return new URL(url).hash.replace('#/', '') || 'login';
  } catch {
    return '';
  }
}

async function navigateToUrl(url) {
  if (!url) {
    return;
  }

  const result = await sendToActiveTab({ type: 'FACTORY_NAVIGATE', url }, { url });
  if (!result?.ok) {
    const tab = await getOrCreateDemoTab(url);
    if (tab?.id) {
      await navigateBrowserTab(tab.id, url);
    }
  }
  await delay(700);
}

function isDemoUrl(url) {
  if (!url) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return ['localhost:4173', '127.0.0.1:4173'].includes(parsed.host);
  } catch {
    return false;
  }
}

function defaultDemoUrl() {
  return 'http://localhost:4173/';
}

function withSuiteDefaults(suite = {}) {
  const flows = Array.isArray(suite.flows) ? suite.flows : [];
  return {
    name: 'Manual QC Suite',
    flows,
    runOrder: Array.isArray(suite.runOrder) && suite.runOrder.length > 0 ? suite.runOrder : flows.map((flow) => flow.flowId),
    ...suite,
    flows
  };
}

function orderedSuiteFlows(suite) {
  const order = suite.runOrder || [];
  const ordered = order.map((flowId) => suite.flows.find((flow) => flow.flowId === flowId)).filter(Boolean);
  const missing = suite.flows.filter((flow) => !order.includes(flow.flowId));
  return [...ordered, ...missing];
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function selectorRow(label, value) {
  return `
    <div>
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value || '-')}</dd>
    </div>
  `;
}

function getState() {
  return new Promise((resolve) => {
    chrome.storage.local.get(storageKey, (result) => {
      resolve(withDefaults(result[storageKey]));
    });
  });
}

async function patchState(partial) {
  const state = await getState();
  await chrome.storage.local.set({
    [storageKey]: {
      ...state,
      ...partial,
      updatedAt: new Date().toISOString()
    }
  });
}

function withDefaults(state = {}) {
  return {
    isRecording: false,
    rawActions: [],
    testCaseName: 'Recorded checkout flow',
    testCaseDescription: '',
    groupSettings: {},
    startUrl: '',
    dataset: null,
    datasetBindings: {},
    customStepDescriptions: {},
    lastCsvRun: null,
    lastReplayRun: null,
    lastSuiteRun: null,
    suite: {
      name: 'Manual QC Suite',
      flows: [],
      runOrder: []
    },
    suiteBindings: {},
    replaySpeed: 'demo',
    updatedAt: null,
    ...state
  };
}

function isCsvBindableAction(action) {
  if (action.type !== 'input') {
    return false;
  }

  return !['checkbox', 'radio'].includes(action.controlType);
}

function setPanelStatus(panelName, status) {
  const dot = panelStatusDots[panelName];
  if (!dot) {
    return;
  }

  dot.classList.remove('idle', 'running', 'stopped');
  dot.classList.add(status);
}

function setActionLogFileName(input, fileName) {
  if (input === replayImportLogEl) {
    replayActionLogNameEl.textContent = fileName;
    return;
  }

  if (input === dataImportLogEl) {
    dataActionLogNameEl.textContent = fileName;
  }
}

async function readTextFile(file) {
  const buffer = await file.arrayBuffer();
  const decoders = [
    () => new TextDecoder('utf-8', { fatal: true }).decode(buffer),
    () => new TextDecoder('shift_jis').decode(buffer)
  ];

  for (const decode of decoders) {
    try {
      return decode().replace(/^\uFEFF/, '');
    } catch {
      // Try the next common encoding for Japanese CSV exports.
    }
  }

  return file.text();
}

function sanitizeFileName(value, fallback) {
  const cleaned = String(value || '')
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return cleaned || fallback;
}

function pathFileName(value) {
  return String(value || '')
    .split(/[\\/]/)
    .filter(Boolean)
    .pop() || 'action-log.json';
}

function downloadJson(data, fileName) {
  downloadText(`${JSON.stringify(data, null, 2)}\n`, fileName, 'application/json');
}

function downloadText(content, fileName, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function setMessage(message) {
  messageEl.textContent = message;
}

function activateTab(tabName) {
  document.querySelectorAll('.tab-button').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tabName);
  });

  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.panel === tabName);
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function cssEscape(value) {
  return window.CSS?.escape ? window.CSS.escape(value) : String(value).replace(/"/g, '\\"');
}
