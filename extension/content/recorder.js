(function () {
  const storageKey = 'factoryRecorderState';
  let isRecording = false;
  const recordedInputs = new WeakMap();

  safeStorageGet((result) => {
    const state = withDefaults(result[storageKey]);
    isRecording = Boolean(state.isRecording);
    safeStorageSet(state);
    renderOverlay(state);
  });

  if (isExtensionContextAvailable()) {
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

  function controlMetadata(element) {
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
