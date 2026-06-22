(function () {
  function normalizeRecording(state) {
    const rawActions = Array.isArray(state.rawActions) ? state.rawActions : [];
    const actions = dedupeConsecutiveActions(rawActions).map((action) => enrichActionContext(action, state));
    const groups = groupActions(actions, state.groupSettings || {});

    return {
      metadata: {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        source: 'chrome-extension-recorder',
        targetApp: 'factory-demo-shop',
        actionCount: actions.length
      },
      session: {
        startUrl: state.startUrl || actions[0]?.url || null,
        browser: 'chrome',
        recordedBy: 'manual-qa'
      },
      testCase: {
        name: state.testCaseName || 'Recorded checkout flow',
        description: state.testCaseDescription || ''
      },
      groups,
      datasets: state.dataset ? [datasetForExport(state.dataset)] : [],
      bindings: bindingsForExport(state.datasetBindings || {}),
      runPolicy: {
        maxRows: 100,
        stopOnFirstFailure: true
      },
      actions
    };
  }

  function dedupeConsecutiveActions(actions) {
    const result = [];

    for (const action of actions) {
      const previous = result[result.length - 1];
      if (previous && shouldDedupe(previous, action)) {
        result[result.length - 1] = {
          ...action,
          dedupedFrom: previous.id
        };
        continue;
      }

      result.push(action);
    }

    return result.map((action, index) => {
      const id = `act-${String(index + 1).padStart(3, '0')}`;
      return {
        ...stripInternalFields(action),
        id,
        networkEvents: normalizeNetworkEvents(action.networkEvents, id)
      };
    });
  }

  function shouldDedupe(previous, action) {
    if (previous.type !== action.type || previous.elementSignature !== action.elementSignature) {
      return false;
    }

    if ((previous.importBatchId || action.importBatchId) && previous.importBatchId !== action.importBatchId) {
      return false;
    }

    return true;
  }

  function stripInternalFields(action) {
    const { importBatchId, ...publicAction } = action;
    return publicAction;
  }

  function normalizeNetworkEvents(networkEvents, actionId) {
    if (!Array.isArray(networkEvents) || networkEvents.length === 0) {
      return undefined;
    }

    return networkEvents.map((event, index) => ({
      id: event.id || `${actionId}-net-${index + 1}`,
      actionId,
      method: event.method || 'GET',
      url: event.url || '',
      status: typeof event.status === 'number' ? event.status : null,
      startedAt: event.startedAt || null,
      capturedAt: event.capturedAt || null,
      requestHeaders: event.requestHeaders || {},
      requestBody: event.requestBody ?? null,
      requestBodyType: event.requestBodyType || null,
      requestBodyRedacted: Boolean(event.requestBodyRedacted),
      requestBodyTruncated: Boolean(event.requestBodyTruncated),
      responseHeaders: event.responseHeaders || {},
      responseBodyPreview: event.responseBodyPreview ?? null,
      failed: Boolean(event.failed),
      error: event.error || null,
      source: event.source || 'unknown'
    }));
  }

  function enrichActionContext(action, state = {}) {
    const groupName = inferGroupName(action);
    const customDescription = state.customStepDescriptions?.[action.id];
    const enriched = {
      ...action,
      groupName,
      screenName: inferScreenName(action, groupName)
    };

    return {
      ...enriched,
      description: customDescription || describeAction(enriched)
    };
  }

  function groupActions(actions, groupSettings) {
    const groups = [];

    for (const action of actions) {
      const groupName = action.groupName || inferGroupName(action);
      const current = groups[groups.length - 1];

      if (!current || current.key !== groupName) {
        const settings = groupSettings[groupName] || {};
        groups.push({
          key: groupName,
          name: settings.displayName || groupName,
          screenName: settings.screenName || action.screenName || inferScreenName(action, groupName),
          repeat: {
            enabled: Boolean(settings.repeatEnabled),
            count: Math.max(1, Number(settings.repeatCount || 1)),
            mode: 'fixed-count',
            dataset: null
          },
          startedAtActionId: action.id,
          actionIds: []
        });
      }

      groups[groups.length - 1].actionIds.push(action.id);
    }

    return groups;
  }

  function inferGroupName(action) {
    const route = routeFromUrl(action.url);
    const text = `${action.targetText || ''} ${action.selectors?.testId || ''}`.toLowerCase();

    if (route.includes('login') || text.includes('login') || text.includes('username') || text.includes('password')) {
      return 'Login';
    }

    if (route.includes('products') || text.includes('add-to-cart') || text.includes('add to cart')) {
      return 'Product Selection';
    }

    if (route.includes('cart') || text.includes('nav-cart') || text.includes('cart')) {
      return 'Cart';
    }

    if (route.includes('checkout') || text.includes('checkout') || text.includes('order') || text.includes('postal')) {
      return 'Checkout';
    }

    if (route.includes('confirmation') || text.includes('confirmed')) {
      return 'Confirmation';
    }

    return 'Unclassified';
  }

  function inferScreenName(action, groupName = null) {
    const route = routeFromUrl(action.url);
    const names = {
      login: 'Login Page',
      products: 'Product List Page',
      cart: 'Cart Page',
      checkout: 'Checkout Page',
      confirmation: 'Confirmation Page'
    };

    if (names[route]) {
      return names[route];
    }

    if (groupName && groupName !== 'Unclassified') {
      return `${groupName} Screen`;
    }

    return 'Unknown Screen';
  }

  function routeFromUrl(url) {
    try {
      return new URL(url).hash.replace('#/', '') || 'login';
    } catch {
      return '';
    }
  }

  function buildGroupSummary(state) {
    return groupActions(dedupeConsecutiveActions(state.rawActions || []).map((action) => enrichActionContext(action, state)), state.groupSettings || {});
  }

  function datasetForExport(dataset) {
    const rows = Array.isArray(dataset.rows) ? dataset.rows : [];
    return {
      id: dataset.id,
      name: dataset.name,
      columns: dataset.columns || [],
      rowCount: dataset.rowCount || rows.length || 0,
      rows,
      rowsPreview: rows.slice(0, 3)
    };
  }

  function bindingsForExport(datasetBindings) {
    return Object.entries(datasetBindings)
      .filter(([, binding]) => binding?.column)
      .map(([actionId, binding]) => ({
        actionId,
        datasetId: binding.datasetId,
        column: binding.column
      }));
  }

  function describeAction(action) {
    const targetName = readableTargetName(action);

    if (action.type === 'input') {
      if (action.controlType === 'select') {
        return `Select "${action.selectedText || action.value || ''}" from ${targetName}`;
      }

      if (action.controlType === 'radio') {
        return `Select ${targetName}`;
      }

      if (action.controlType === 'checkbox') {
        return `${action.checked ? 'Check' : 'Uncheck'} ${targetName}`;
      }

      return `Input "${action.value || ''}" into ${targetName}`;
    }

    if (action.type === 'click') {
      return `Click ${targetName}`;
    }

    return `${capitalize(action.type || 'Interact with')} ${targetName}`;
  }

  function readableTargetName(action) {
    const text = cleanText(action.targetText);
    const testId = action.selectors?.testId || action.primarySelector || action.elementSignature || '';

    if (text) {
      return `${text} ${roleNoun(action)}`.trim();
    }

    const inferred = inferNameFromSelector(testId);
    if (inferred) {
      return `${inferred} ${roleNoun(action)}`.trim();
    }

    return `${action.targetTag || 'element'}`;
  }

  function roleNoun(action) {
    if (action.targetTag === 'button' || action.type === 'click') {
      return 'button';
    }

    if (action.controlType === 'select') {
      return 'dropdown';
    }

    if (action.controlType === 'radio') {
      return 'option';
    }

    if (action.controlType === 'checkbox') {
      return 'checkbox';
    }

    if (['input', 'textarea', 'select'].includes(action.targetTag)) {
      return 'field';
    }

    return '';
  }

  function inferNameFromSelector(selector) {
    const match = String(selector).match(/data-testid="([^"]+)"/);
    const raw = match?.[1] || String(selector).replace(/^[#.]|\[|\]/g, '');
    return raw
      .replace(/^(add-to-cart|nav)-/g, '')
      .replace(/-(input|button|field)$/g, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
      .trim();
  }

  function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function capitalize(value) {
    return String(value).charAt(0).toUpperCase() + String(value).slice(1);
  }

  window.FactoryActionNormalizer = {
    buildGroupSummary,
    describeAction,
    dedupeConsecutiveActions,
    inferGroupName,
    inferScreenName,
    normalizeRecording
  };
})();
