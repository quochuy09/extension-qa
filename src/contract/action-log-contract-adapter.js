const supportedSchemaVersions = new Set([1]);
const selectorPriority = ['testId', 'roleText', 'id', 'css', 'xpath'];
const textLikeControlTypes = new Set(['text', 'password', 'email', 'search', 'tel', 'url', 'number', 'textarea']);

export class ActionLogContractError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'ActionLogContractError';
    this.details = details;
  }
}

export function adaptActionLog(actionLog) {
  const normalizedActionLog = normalizeActionLogShape(actionLog);
  const errors = validateActionLog(normalizedActionLog);
  if (errors.length > 0) {
    throw new ActionLogContractError('Invalid action log contract.', errors);
  }

  const actions = normalizedActionLog.actions.map((action, index) => normalizeAction(action, index));
  const actionById = new Map(actions.map((action) => [action.id, action]));
  const groups = normalizeGroups(normalizedActionLog.groups, actionById);

  return {
    schemaVersion: normalizedActionLog.metadata.schemaVersion,
    source: normalizedActionLog.metadata.source || 'unknown',
    generatedAt: normalizedActionLog.metadata.generatedAt || null,
    targetApp: normalizedActionLog.metadata.targetApp || null,
    testCase: {
      name: normalizedActionLog.testCase?.name || 'Generated test',
      description: normalizedActionLog.testCase?.description || ''
    },
    session: {
      startUrl: normalizedActionLog.session?.startUrl || actions[0]?.url || null,
      browser: normalizedActionLog.session?.browser || 'chrome',
      recordedBy: normalizedActionLog.session?.recordedBy || 'manual-qa'
    },
    groups,
    actions,
    datasets: normalizeDatasets(normalizedActionLog.datasets || []),
    bindings: normalizeBindings(normalizedActionLog.bindings || []),
    runPolicy: {
      maxRows: Number(normalizedActionLog.runPolicy?.maxRows || 100),
      stopOnFirstFailure: normalizedActionLog.runPolicy?.stopOnFirstFailure !== false
    }
  };
}

export function validateActionLog(actionLog) {
  const normalizedActionLog = normalizeActionLogShape(actionLog);
  const errors = [];

  if (!isObject(normalizedActionLog)) {
    return ['Action log must be a JSON object.'];
  }

  if (!isObject(normalizedActionLog.metadata)) {
    errors.push('metadata is required.');
  } else if (!supportedSchemaVersions.has(normalizedActionLog.metadata.schemaVersion)) {
    errors.push(`metadata.schemaVersion must be one of: ${Array.from(supportedSchemaVersions).join(', ')}.`);
  }

  if (!Array.isArray(normalizedActionLog.actions) || normalizedActionLog.actions.length === 0) {
    errors.push('actions must be a non-empty array.');
  }

  if (!Array.isArray(normalizedActionLog.groups)) {
    errors.push('groups must be an array.');
  }

  if (Array.isArray(normalizedActionLog.actions)) {
    const actionIds = new Set();
    normalizedActionLog.actions.forEach((action, index) => {
      validateAction(action, index, actionIds).forEach((error) => errors.push(error));
    });

    if (Array.isArray(normalizedActionLog.groups)) {
      normalizedActionLog.groups.forEach((group, index) => {
        validateGroup(group, index, actionIds).forEach((error) => errors.push(error));
      });
    }
  }

  return errors;
}

function normalizeActionLogShape(actionLog) {
  if (!isObject(actionLog)) {
    return actionLog;
  }

  const schemaVersion = actionLog.metadata?.schemaVersion || legacySchemaVersion(actionLog.version);
  const source = actionLog.metadata?.source || actionLog.source || 'unknown';
  const generatedAt = actionLog.metadata?.generatedAt || actionLog.generatedAt || null;

  return {
    ...actionLog,
    metadata: {
      ...(actionLog.metadata || {}),
      schemaVersion,
      source,
      generatedAt
    },
    groups: Array.isArray(actionLog.groups) ? actionLog.groups : groupsFromActionGroupNames(actionLog.actions || [])
  };
}

function legacySchemaVersion(version) {
  return version === '1.0' || version === 1 ? 1 : undefined;
}

function groupsFromActionGroupNames(actions) {
  const groupsByName = new Map();

  for (const action of actions) {
    const groupName = action.groupName || 'Recorded flow';
    if (!groupsByName.has(groupName)) {
      groupsByName.set(groupName, []);
    }

    groupsByName.get(groupName).push(action.id);
  }

  return Array.from(groupsByName.entries()).map(([name, actionIds], index) => ({
    key: `group-${index + 1}`,
    name,
    screenName: name,
    actionIds,
    repeat: {
      enabled: false,
      count: 1
    }
  }));
}

export function orderedSelectorCandidates(action) {
  const selectors = action.selectors || {};
  return selectorPriority
    .map((type) => selectors[type] ? { type, value: selectors[type], locator: toPlaywrightLocator(type, selectors[type]) } : null)
    .filter(Boolean);
}

export function primarySelectorCandidate(action) {
  return orderedSelectorCandidates(action)[0] || null;
}

export function actionPlaywrightKind(action) {
  if (action.type === 'click') {
    return 'click';
  }

  if (action.type !== 'input') {
    return 'unsupported';
  }

  const controlType = action.controlType || inferControlType(action);
  if (controlType === 'select') {
    return 'selectOption';
  }

  if (controlType === 'select2') {
    return 'select2';
  }

  if (controlType === 'multiselect') {
    return 'multiselect';
  }

  if (controlType === 'checkbox') {
    return action.checked ? 'check' : 'uncheck';
  }

  if (controlType === 'radio') {
    return 'check';
  }

  if (textLikeControlTypes.has(controlType)) {
    return 'fill';
  }

  return 'fill';
}

function normalizeAction(action, index) {
  const controlType = action.controlType || inferControlType(action);
  const selectorCandidates = orderedSelectorCandidates(action);

  return {
    id: action.id,
    order: index + 1,
    description: action.description || fallbackDescription(action),
    type: action.type,
    playwrightKind: actionPlaywrightKind({ ...action, controlType }),
    value: action.value ?? null,
    checked: typeof action.checked === 'boolean' ? action.checked : null,
    controlType,
    selectedText: action.selectedText || null,
    url: action.url || null,
    title: action.title || null,
    groupName: action.groupName || null,
    screenName: action.screenName || null,
    targetTag: action.targetTag || null,
    targetText: action.targetText || '',
    selectors: action.selectors || {},
    selectorCandidates,
    primarySelector: selectorCandidates[0] || null,
    networkEvents: normalizeNetworkEvents(action.networkEvents || [], action.id)
  };
}

function normalizeNetworkEvents(networkEvents, actionId) {
  if (!Array.isArray(networkEvents)) {
    return [];
  }

  return networkEvents.map((event, index) => ({
    id: event.id || `${actionId}-net-${index + 1}`,
    actionId: event.actionId || actionId,
    method: String(event.method || 'GET').toUpperCase(),
    url: event.url || '',
    status: typeof event.status === 'number' ? event.status : null,
    startedAt: event.startedAt || null,
    capturedAt: event.capturedAt || null,
    requestHeaders: isObject(event.requestHeaders) ? event.requestHeaders : {},
    requestBody: event.requestBody ?? null,
    requestBodyType: event.requestBodyType || null,
    requestBodyRedacted: Boolean(event.requestBodyRedacted),
    requestBodyTruncated: Boolean(event.requestBodyTruncated),
    responseHeaders: isObject(event.responseHeaders) ? event.responseHeaders : {},
    responseBodyPreview: event.responseBodyPreview ?? null,
    failed: Boolean(event.failed),
    error: event.error || null,
    source: event.source || 'unknown'
  }));
}

function normalizeGroups(groups, actionById) {
  return groups.map((group, index) => {
    const actions = group.actionIds.map((actionId) => actionById.get(actionId)).filter(Boolean);
    return {
      key: group.key || group.name || `Group ${index + 1}`,
      name: group.name || group.key || `Group ${index + 1}`,
      screenName: group.screenName || actions[0]?.screenName || 'Unknown Screen',
      repeat: {
        enabled: Boolean(group.repeat?.enabled),
        count: Math.max(1, Number(group.repeat?.count || 1)),
        mode: group.repeat?.mode || 'fixed-count',
        dataset: group.repeat?.dataset || null
      },
      actionIds: group.actionIds,
      actions
    };
  });
}

function normalizeDatasets(datasets) {
  return datasets.map((dataset) => {
    const rows = Array.isArray(dataset.rows) ? dataset.rows : [];
    return {
      id: dataset.id,
      name: dataset.name,
      columns: dataset.columns || [],
      rowCount: Number(dataset.rowCount || rows.length || 0),
      rows,
      rowsPreview: dataset.rowsPreview || []
    };
  });
}

function normalizeBindings(bindings) {
  return bindings.map((binding) => ({
    actionId: binding.actionId,
    datasetId: binding.datasetId,
    column: binding.column
  }));
}

function validateAction(action, index, actionIds) {
  const errors = [];
  const prefix = `actions[${index}]`;

  if (!isObject(action)) {
    return [`${prefix} must be an object.`];
  }

  if (!action.id) {
    errors.push(`${prefix}.id is required.`);
  } else if (actionIds.has(action.id)) {
    errors.push(`${prefix}.id is duplicated: ${action.id}.`);
  } else {
    actionIds.add(action.id);
  }

  if (!['click', 'input'].includes(action.type)) {
    errors.push(`${prefix}.type must be "click" or "input".`);
  }

  if (!isObject(action.selectors)) {
    errors.push(`${prefix}.selectors is required.`);
  } else if (orderedSelectorCandidates(action).length === 0) {
    errors.push(`${prefix}.selectors must include at least one supported selector.`);
  }

  return errors;
}

function validateGroup(group, index, actionIds) {
  const errors = [];
  const prefix = `groups[${index}]`;

  if (!isObject(group)) {
    return [`${prefix} must be an object.`];
  }

  if (!group.name && !group.key) {
    errors.push(`${prefix}.name or ${prefix}.key is required.`);
  }

  if (!Array.isArray(group.actionIds)) {
    errors.push(`${prefix}.actionIds must be an array.`);
  } else {
    group.actionIds.forEach((actionId) => {
      if (!actionIds.has(actionId)) {
        errors.push(`${prefix}.actionIds references missing action id: ${actionId}.`);
      }
    });
  }

  return errors;
}

function inferControlType(action) {
  if (action.targetTag === 'textarea') {
    return 'textarea';
  }

  if (action.targetTag === 'select') {
    return 'select';
  }

  return action.targetTag === 'input' ? 'text' : action.targetTag || 'element';
}

function fallbackDescription(action) {
  if (action.type === 'click') {
    return `Click ${action.targetText || action.primarySelector || action.id}`;
  }

  return `Input value into ${action.targetText || action.primarySelector || action.id}`;
}

function toPlaywrightLocator(type, value) {
  if (type === 'testId') {
    const match = value.match(/\[data-testid="(.+)"\]/);
    return match ? `page.getByTestId(${JSON.stringify(match[1])})` : `page.locator(${JSON.stringify(value)})`;
  }

  if (type === 'roleText') {
    return `page.${value}`;
  }

  if (type === 'id' || type === 'css') {
    return `page.locator(${JSON.stringify(value)})`;
  }

  if (type === 'xpath') {
    return `page.locator(${JSON.stringify(`xpath=${value}`)})`;
  }

  return null;
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
