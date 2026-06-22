(function () {
  const storageKey = 'factoryRecorderState';
  let isRecording = false;
  const recordedInputs = new WeakMap();
  let lastRecordedActionId = null;

  safeStorageGet((result) => {
    const state = withDefaults(result[storageKey]);
    isRecording = Boolean(state.isRecording);
    safeStorageSet(state);
    renderOverlay(state);
  });

  if (isExtensionContextAvailable()) {
    installNetworkCaptureBridge();

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local' || !changes[storageKey]) {
        return;
      }

      const state = withDefaults(changes[storageKey].newValue);
      isRecording = Boolean(state.isRecording);
      renderOverlay(state);
    });

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === 'FACTORY_RECORDER_START') {
        updateState({ isRecording: true });
        sendResponse({ ok: true });
        return true;
      }

      if (message?.type === 'FACTORY_RECORDER_STOP') {
        updateState({ isRecording: false });
        sendResponse({ ok: true });
        return true;
      }

      if (message?.type === 'FACTORY_RECORDER_CLEAR') {
        safeStorageSet(withDefaults({
          isRecording,
          rawActions: [],
          groupSettings: {},
          updatedAt: new Date().toISOString()
        }));
        sendResponse({ ok: true });
        return true;
      }

      return false;
    });
  }

  document.addEventListener(
    'click',
    (event) => {
      if (!isRecording || window.FactoryReplayInProgress || event.target.closest('#factory-recorder-overlay')) {
        return;
      }

      const customControlAction = buildCustomControlAction(event.target);
      if (customControlAction) {
        window.setTimeout(() => appendAction(customControlAction()), 0);
        return;
      }

      const target = event.target.closest('button,a,[role="button"],input[type="submit"]');
      if (target) {
        appendAction(buildAction('click', target));
      }
    },
    true
  );

  document.addEventListener(
    'change',
    (event) => {
      if (!isRecording || window.FactoryReplayInProgress) {
        return;
      }

      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
        return;
      }

      if (target.closest('[data-control-type="select2"], [data-control-type="multiselect"]')) {
        return;
      }

      const value = target.value;
      if (recordedInputs.get(target) === value) {
        return;
      }

      recordedInputs.set(target, value);
      appendAction(buildAction('input', target, value));
    },
    true
  );

  function appendAction(action) {
    lastRecordedActionId = action.id;
    safeStorageGet((result) => {
      const state = withDefaults(result[storageKey]);
      const rawActions = [...state.rawActions, action];

      safeStorageSet({
        ...state,
        rawActions,
        isRecording,
        updatedAt: new Date().toISOString()
      });
    });
  }

  function appendNetworkEvent(networkEvent) {
    if (!isRecording || !networkEvent?.url) {
      return;
    }

    const capturedAt = new Date().toISOString();
    safeStorageGet((result) => {
      const state = withDefaults(result[storageKey]);
      const rawActions = [...state.rawActions];
      const targetIndex = findNetworkTargetActionIndex(rawActions);
      if (targetIndex < 0) {
        return;
      }

      const targetAction = rawActions[targetIndex];
      const networkEvents = [...(targetAction.networkEvents || []), {
        ...networkEvent,
        id: `net-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        capturedAt,
        actionId: targetAction.id,
        source: 'content-script-network-bridge'
      }].slice(-5);

      rawActions[targetIndex] = {
        ...targetAction,
        networkEvents
      };

      safeStorageSet({
        ...state,
        rawActions,
        isRecording,
        updatedAt: capturedAt
      });
    });
  }

  function findNetworkTargetActionIndex(rawActions) {
    if (!rawActions.length) {
      return -1;
    }

    if (lastRecordedActionId) {
      const index = rawActions.findIndex((action) => action.id === lastRecordedActionId);
      if (index >= 0) {
        return index;
      }
    }

    return rawActions.length - 1;
  }

  function updateState(partial) {
    safeStorageGet((result) => {
      const state = withDefaults(result[storageKey]);
      safeStorageSet({
        ...state,
        ...partial,
        updatedAt: new Date().toISOString()
      });
    });
  }

  function safeStorageGet(callback) {
    if (!isExtensionContextAvailable()) {
      disableInvalidContextRecorder();
      return;
    }

    try {
      chrome.storage.local.get(storageKey, callback);
    } catch {
      disableInvalidContextRecorder();
    }
  }

  function safeStorageSet(state) {
    if (!isExtensionContextAvailable()) {
      disableInvalidContextRecorder();
      return;
    }

    try {
      chrome.storage.local.set({ [storageKey]: state });
    } catch {
      disableInvalidContextRecorder();
    }
  }

  function isExtensionContextAvailable() {
    try {
      return Boolean(chrome?.runtime?.id && chrome.storage?.local);
    } catch {
      return false;
    }
  }

  function disableInvalidContextRecorder() {
    isRecording = false;
    const overlay = document.querySelector('#factory-recorder-overlay');
    if (overlay) {
      overlay.hidden = true;
    }
  }

  function buildAction(type, element, value = null) {
    const selectors = window.FactorySelectorEngine.getSelectorPayload(element);
    const control = controlMetadata(element);
    const groupName = window.FactoryActionNormalizer.inferGroupName({
      url: window.location.href,
      targetText: window.FactorySelectorEngine.visibleText(element),
      selectors
    });

    return {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type,
      value,
      url: window.location.href,
      title: document.title,
      targetTag: element.tagName.toLowerCase(),
      targetText: window.FactorySelectorEngine.visibleText(element),
      ...control,
      selectors,
      primarySelector: window.FactorySelectorEngine.getPrimarySelector(selectors),
      groupName,
      screenName: window.FactoryActionNormalizer.inferScreenName({ url: window.location.href }, groupName),
      elementSignature: window.FactorySelectorEngine.getPrimarySelector(selectors)
    };
  }

  function buildCustomControlAction(target) {
    const select2Wrapper = target.closest?.('[data-control-type="select2"]');
    if (select2Wrapper && target.closest('[data-option-value]')) {
      return () => buildAction('input', select2Wrapper, select2Wrapper.dataset.selectedValue || '');
    }

    const multiselectWrapper = target.closest?.('[data-control-type="multiselect"]');
    if (multiselectWrapper && target.closest('input[type="checkbox"], label[data-option-value]')) {
      return () => buildAction('input', multiselectWrapper, selectedMultiselectValues(multiselectWrapper));
    }

    return null;
  }

  function selectedMultiselectValues(wrapper) {
    return Array.from(wrapper.querySelectorAll('input[type="checkbox"]:checked')).map((checkbox) => checkbox.value);
  }

  function controlMetadata(element) {
    if (element?.dataset?.controlType === 'select2') {
      return {
        controlType: 'select2',
        selectedText: element.dataset.selectedText || ''
      };
    }

    if (element?.dataset?.controlType === 'multiselect') {
      return {
        controlType: 'multiselect',
        selectedText: Array.from(element.querySelectorAll('input[type="checkbox"]:checked')).map((checkbox) => checkbox.closest('label')?.textContent?.trim() || checkbox.value)
      };
    }

    if (element instanceof HTMLSelectElement) {
      return {
        controlType: 'select',
        selectedText: element.selectedOptions?.[0]?.textContent?.trim() || ''
      };
    }

    if (element instanceof HTMLTextAreaElement) {
      return {
        controlType: 'textarea'
      };
    }

    if (element instanceof HTMLInputElement) {
      const inputType = (element.getAttribute('type') || 'text').toLowerCase();
      const metadata = {
        controlType: inputType
      };

      if (inputType === 'checkbox' || inputType === 'radio') {
        metadata.checked = element.checked;
      }

      return metadata;
    }

    return {
      controlType: element.tagName.toLowerCase()
    };
  }

  function withDefaults(state = {}) {
    return {
      isRecording: false,
      rawActions: [],
      testCaseName: 'Recorded checkout flow',
      testCaseDescription: '',
      groupSettings: {},
      updatedAt: null,
      ...state
    };
  }

  function installNetworkCaptureBridge() {
    if (!document.documentElement) {
      window.requestAnimationFrame(installNetworkCaptureBridge);
      return;
    }

    window.addEventListener('message', (event) => {
      if (event.source !== window || event.data?.type !== 'FACTORY_RECORDER_NETWORK_EVENT') {
        return;
      }

      appendNetworkEvent(event.data.event);
    });

    if (document.documentElement.dataset.factoryNetworkBridge === 'installed') {
      return;
    }

    document.documentElement.dataset.factoryNetworkBridge = 'installed';
    const script = document.createElement('script');
    script.textContent = `(${pageNetworkCapture.toString()})();`;
    document.documentElement.appendChild(script);
    script.remove();
  }

  function pageNetworkCapture() {
    if (window.__factoryRecorderNetworkCaptureInstalled) {
      return;
    }

    window.__factoryRecorderNetworkCaptureInstalled = true;
    const sensitiveHeaderPattern = /authorization|cookie|x-api-key|token|secret/i;
    const sensitiveBodyPattern = /password|token|secret|credential|authorization/i;
    const maxBodyLength = 2000;

    const originalFetch = window.fetch;
    if (typeof originalFetch === 'function') {
      window.fetch = async function factoryRecorderFetch(input, init = {}) {
        const startedAt = new Date().toISOString();
        const request = requestFromFetch(input, init);

        try {
          const response = await originalFetch.apply(this, arguments);
          captureFetchResponse(request, response, startedAt);
          return response;
        } catch (error) {
          postNetworkEvent({
            ...request,
            startedAt,
            failed: true,
            error: error?.message || 'fetch failed'
          });
          throw error;
        }
      };
    }

    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

    XMLHttpRequest.prototype.open = function factoryRecorderOpen(method, url) {
      this.__factoryRecorderRequest = {
        method: String(method || 'GET').toUpperCase(),
        url: absoluteUrl(url),
        requestHeaders: {}
      };
      return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.setRequestHeader = function factoryRecorderSetRequestHeader(name, value) {
      if (this.__factoryRecorderRequest) {
        this.__factoryRecorderRequest.requestHeaders[name] = value;
      }
      return originalSetRequestHeader.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function factoryRecorderSend(body) {
      const startedAt = new Date().toISOString();
      const request = {
        ...(this.__factoryRecorderRequest || { method: 'GET', url: '' }),
        startedAt,
        ...sanitizeRequestBodyFields(body)
      };

      this.addEventListener('loadend', () => {
        postNetworkEvent({
          ...request,
          status: this.status,
          responseHeaders: parseHeaderString(this.getAllResponseHeaders()),
          responseBodyPreview: sanitizeBody(this.responseText)
        });
      });

      return originalSend.apply(this, arguments);
    };

    function requestFromFetch(input, init) {
      const request = input instanceof Request ? input : null;
      return {
        method: String(init.method || request?.method || 'GET').toUpperCase(),
        url: absoluteUrl(request?.url || input),
        requestHeaders: sanitizeHeaders(headersObject(init.headers || request?.headers)),
        ...sanitizeRequestBodyFields(init.body)
      };
    }

    async function captureFetchResponse(request, response, startedAt) {
      const event = {
        ...request,
        startedAt,
        status: response.status,
        responseHeaders: sanitizeHeaders(headersObject(response.headers))
      };

      try {
        const contentType = response.headers.get('content-type') || '';
        if (/json|text|html|xml|javascript/i.test(contentType)) {
          event.responseBodyPreview = sanitizeBody(await response.clone().text());
        }
      } catch {
        event.responseBodyPreview = '[unavailable]';
      }

      postNetworkEvent(event);
    }

    function postNetworkEvent(event) {
      if (!event.url || !sameOriginOrLocal(event.url)) {
        return;
      }

      window.postMessage({
        type: 'FACTORY_RECORDER_NETWORK_EVENT',
        event
      }, window.location.origin);
    }

    function sameOriginOrLocal(value) {
      try {
        const url = new URL(value, window.location.href);
        return url.origin === window.location.origin || ['localhost', '127.0.0.1'].includes(url.hostname);
      } catch {
        return false;
      }
    }

    function absoluteUrl(value) {
      try {
        return new URL(String(value), window.location.href).href;
      } catch {
        return String(value || '');
      }
    }

    function headersObject(headers) {
      if (!headers) {
        return {};
      }

      if (headers instanceof Headers) {
        return Object.fromEntries(headers.entries());
      }

      if (Array.isArray(headers)) {
        return Object.fromEntries(headers);
      }

      return { ...headers };
    }

    function parseHeaderString(value) {
      return String(value || '')
        .trim()
        .split(/\\r?\\n/)
        .filter(Boolean)
        .reduce((headers, line) => {
          const separatorIndex = line.indexOf(':');
          if (separatorIndex > 0) {
            headers[line.slice(0, separatorIndex).trim()] = line.slice(separatorIndex + 1).trim();
          }
          return headers;
        }, {});
    }

    function sanitizeHeaders(headers) {
      return Object.fromEntries(
        Object.entries(headers || {}).map(([name, value]) => [
          name,
          sensitiveHeaderPattern.test(name) ? '[redacted]' : String(value)
        ])
      );
    }

    function sanitizeBody(body) {
      if (body == null) {
        return null;
      }

      if (typeof body !== 'string') {
        return `[${Object.prototype.toString.call(body).slice(8, -1)}]`;
      }

      const truncated = body.length > maxBodyLength ? `${body.slice(0, maxBodyLength)}...[truncated]` : body;
      if (!sensitiveBodyPattern.test(truncated)) {
        return truncated;
      }

      try {
        const parsed = JSON.parse(truncated);
        return JSON.stringify(redactObject(parsed));
      } catch {
        return truncated.replace(/([^&=]*?(password|token|secret|credential|authorization)[^&=]*=)[^&\s]+/gi, '$1[redacted]');
      }
    }

    function sanitizeRequestBodyFields(body) {
      if (body == null) {
        return {
          requestBody: null,
          requestBodyType: 'empty',
          requestBodyRedacted: false,
          requestBodyTruncated: false
        };
      }

      if (body instanceof URLSearchParams) {
        const raw = body.toString();
        return {
          requestBody: sanitizeBody(raw),
          requestBodyType: 'form-urlencoded',
          requestBodyRedacted: sensitiveBodyPattern.test(raw),
          requestBodyTruncated: raw.length > maxBodyLength
        };
      }

      if (body instanceof FormData) {
        const values = {};
        let redacted = false;
        for (const [key, value] of body.entries()) {
          if (value instanceof File) {
            values[key] = '[File]';
            redacted = true;
            continue;
          }

          values[key] = sensitiveBodyPattern.test(key) ? '[redacted]' : String(value);
          redacted = redacted || sensitiveBodyPattern.test(key);
        }

        return {
          requestBody: JSON.stringify(values),
          requestBodyType: 'form-data',
          requestBodyRedacted: redacted,
          requestBodyTruncated: false
        };
      }

      if (typeof body !== 'string') {
        return {
          requestBody: null,
          requestBodyType: Object.prototype.toString.call(body).slice(8, -1).toLowerCase(),
          requestBodyRedacted: true,
          requestBodyTruncated: false
        };
      }

      const sanitized = sanitizeBody(body);
      return {
        requestBody: sanitized,
        requestBodyType: looksLikeJson(body) ? 'json' : 'text',
        requestBodyRedacted: sanitized !== body,
        requestBodyTruncated: body.length > maxBodyLength
      };
    }

    function redactObject(value) {
      if (!value || typeof value !== 'object') {
        return value;
      }

      if (Array.isArray(value)) {
        return value.map(redactObject);
      }

      return Object.fromEntries(
        Object.entries(value).map(([key, child]) => [
          key,
          sensitiveBodyPattern.test(key) ? '[redacted]' : redactObject(child)
        ])
      );
    }

    function looksLikeJson(value) {
      return /^\s*[\[{]/.test(String(value || ''));
    }
  }

  function renderOverlay(state) {
    const ready = document.body;
    if (!ready) {
      window.requestAnimationFrame(() => renderOverlay(state));
      return;
    }

    let overlay = document.querySelector('#factory-recorder-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'factory-recorder-overlay';
      overlay.setAttribute('aria-live', 'polite');
      overlay.style.cssText = [
        'position:fixed',
        'right:16px',
        'bottom:16px',
        'z-index:2147483647',
        'padding:10px 12px',
        'border:1px solid #c8d0d8',
        'border-radius:8px',
        'background:#ffffff',
        'color:#18202a',
        'font:12px Arial, Helvetica, sans-serif',
        'box-shadow:0 8px 24px rgba(20,28,38,.18)',
        'pointer-events:none'
      ].join(';');
      document.body.appendChild(overlay);
    }

    overlay.hidden = !state.isRecording;
    overlay.textContent = `Recording ${state.rawActions.length} step${state.rawActions.length === 1 ? '' : 's'}`;
  }
})();
