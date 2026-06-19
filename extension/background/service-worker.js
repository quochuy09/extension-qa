const storageKey = 'factoryRecorderState';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'FACTORY_RUN_SUITE') {
    return false;
  }

  runSuiteInBackground()
    .then((result) => sendResponse(result))
    .catch(async (error) => {
      await patchState({
        runnerStatus: {
          scope: 'suite',
          status: 'failed',
          message: error.message,
          updatedAt: new Date().toISOString()
        }
      });
      sendResponse({ ok: false, error: error.message });
    });

  return true;
});

async function runSuiteInBackground() {
  const state = await getState();
  const suite = withSuiteDefaults(state.suite);
  const flows = orderedSuiteFlows(suite);

  if (flows.length === 0) {
    await setSuiteStatus('failed', 'Suite needs at least one flow.');
    return { ok: false, error: 'Suite needs at least one flow.' };
  }

  const firstUrl = flowStartUrl(flows[0]) || defaultDemoUrl();
  const tab = await getOrCreateRunnerTab(firstUrl);
  const results = [];

  await setSuiteStatus('running', `Running suite: ${suite.name || 'Manual QC Suite'}`);

  for (let index = 0; index < flows.length; index += 1) {
    const flow = flows[index];
    await setSuiteStatus('running', `Running suite flow ${index + 1}/${flows.length}: ${flow.name}`);
    const result = await runSingleFlow(tab.id, flow, state.replaySpeed || 'demo');
    const failure = await failureDetails(tab, result, `${flow.name} failed before any step result was returned.`);

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
      await patchState({
        lastSuiteRun: { completedAt: new Date().toISOString(), useCsv: false, results },
        lastCsvRun: null,
        lastReplayRun: null
      });
      await setSuiteStatus('failed', `Suite stopped at ${flow.name}: ${results[results.length - 1].error}`);
      return { ok: false, results };
    }
  }

  await patchState({
    lastSuiteRun: { completedAt: new Date().toISOString(), useCsv: false, results },
    lastCsvRun: null,
    lastReplayRun: null
  });
  await setSuiteStatus('passed', `Suite passed: ${results.length} flow${results.length === 1 ? '' : 's'}.`);
  return { ok: true, results };
}

async function runSingleFlow(tabId, flow, replaySpeed) {
  const actions = flow.actionLog?.actions || [];
  const startUrl = flowStartUrl(flow);
  await navigateRunnerTab(tabId, startUrl);

  if (actions.length === 0) {
    return {
      ok: false,
      error: 'Flow has no actions.',
      results: []
    };
  }

  return sendMessageToTab(tabId, {
    type: 'FACTORY_REPLAY_ACTIONS',
    actions,
    options: {
      speed: replaySpeed
    }
  });
}

function flowStartUrl(flow) {
  return flow.startUrl || flow.actionLog?.session?.startUrl || flow.actionLog?.actions?.[0]?.url || defaultDemoUrl();
}

async function getOrCreateRunnerTab(targetUrl) {
  const [activeTab] = await queryTabs({ active: true, currentWindow: true });
  if (activeTab?.id && isDemoUrl(activeTab.url)) {
    await updateTab(activeTab.id, { active: true });
    return activeTab;
  }

  const demoTabs = await queryTabs({ url: ['http://localhost:4173/*', 'http://127.0.0.1:4173/*'] });
  if (demoTabs[0]?.id) {
    await updateTab(demoTabs[0].id, { active: true });
    if (demoTabs[0].windowId) {
      await focusWindow(demoTabs[0].windowId);
    }
    await waitForTabReady(demoTabs[0].id);
    return getTab(demoTabs[0].id);
  }

  const created = await createTab({ url: targetUrl || defaultDemoUrl(), active: true });
  await waitForTabReady(created.id);
  return getTab(created.id);
}

async function navigateRunnerTab(tabId, url) {
  if (!url) {
    return;
  }

  await updateTab(tabId, { url, active: true });
  await waitForTabReady(tabId);
  await sendMessageToTab(tabId, { type: 'FACTORY_NAVIGATE', url });
  await delay(700);
}

async function sendMessageToTab(tabId, message) {
  const attempts = 16;
  let lastError = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await sendTabMessage(tabId, message);
    } catch (error) {
      lastError = error;
      await delay(250);
    }
  }

  return {
    ok: false,
    error: lastError?.message || 'Could not communicate with the demo tab.',
    results: []
  };
}

async function failureDetails(tab, result, fallbackError) {
  const results = result?.results || [];
  const last = results[results.length - 1] || null;
  const ok = Boolean(result?.ok);

  return {
    lastStep: last?.description || null,
    failedStep: ok ? null : last?.description || 'No step result captured',
    error: ok ? null : last?.error || result?.error || fallbackError,
    screenshot: ok ? null : await captureFailureScreenshot(tab)
  };
}

function captureFailureScreenshot(tab) {
  return new Promise((resolve) => {
    if (!tab?.windowId) {
      resolve(null);
      return;
    }

    chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError || !dataUrl) {
        resolve(null);
        return;
      }

      resolve(dataUrl);
    });
  });
}

async function setSuiteStatus(status, message) {
  await patchState({
    runnerStatus: {
      scope: 'suite',
      status,
      message,
      updatedAt: new Date().toISOString()
    }
  });
}

function waitForTabReady(tabId) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 6000);

    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId !== tabId || changeInfo.status !== 'complete') {
        return;
      }

      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    };

    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        return;
      }

      if (tab?.status === 'complete') {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    });
  });
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
    suite: {
      name: 'Manual QC Suite',
      flows: [],
      runOrder: []
    },
    replaySpeed: 'demo',
    ...state
  };
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

function queryTabs(queryInfo) {
  return new Promise((resolve) => chrome.tabs.query(queryInfo, resolve));
}

function getTab(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(tab);
    });
  });
}

function createTab(createProperties) {
  return new Promise((resolve, reject) => {
    chrome.tabs.create(createProperties, (tab) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(tab);
    });
  });
}

function updateTab(tabId, updateProperties) {
  return new Promise((resolve, reject) => {
    chrome.tabs.update(tabId, updateProperties, (tab) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(tab);
    });
  });
}

function focusWindow(windowId) {
  return new Promise((resolve) => {
    chrome.windows.update(windowId, { focused: true }, resolve);
  });
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(response);
    });
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
