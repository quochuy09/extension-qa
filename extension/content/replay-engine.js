(function () {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'FACTORY_REPLAY_STOP') {
      window.FactoryReplayStopRequested = true;
      sendResponse({ ok: true });
      return true;
    }

    if (message?.type === 'FACTORY_NAVIGATE') {
      if (message.url === window.location.href) {
        window.dispatchEvent(new CustomEvent('factory:navigate'));
        sendResponse({ ok: true, sameUrl: true });
        return true;
      }

      window.location.href = message.url;
      sendResponse({ ok: true });
      return true;
    }

    if (message?.type === 'FACTORY_GET_PAGE_CONTEXT') {
      sendResponse({
        ok: true,
        url: window.location.href,
        route: routeFromUrl(window.location.href),
        title: document.title
      });
      return true;
    }

    if (message?.type !== 'FACTORY_REPLAY_ACTIONS') {
      return false;
    }

    replayActions(message.actions || [], normalizeOptions(message.options))
      .then((result) => sendResponse(result))
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error.message,
          results: []
        });
      });

    return true;
  });

  async function replayActions(actions, options) {
    const results = [];
    window.FactoryReplayInProgress = true;
    window.FactoryReplayStopRequested = false;
    const overlay = createReplayOverlay();

    try {
      for (let index = 0; index < actions.length; index += 1) {
        if (window.FactoryReplayStopRequested) {
          updateReplayOverlay(overlay, 'Replay stopped', 'Stopped by user', 'failed');
          return {
            ok: false,
            stopped: true,
            error: 'Replay stopped by user.',
            results
          };
        }

        const action = actions[index];
        const startedAt = performance.now();
        const description = action.description || describeAction(action);
        updateReplayOverlay(overlay, `Running Step ${index + 1}/${actions.length}`, description, 'running');
        const result = await replayAction(action, options);
        results.push({
          ...result,
          actionId: action.id,
          description,
          status: result.ok ? 'passed' : 'failed',
          stepIndex: index + 1,
          totalSteps: actions.length,
          elapsedMs: Math.round(performance.now() - startedAt)
        });

        if (!result.ok) {
          updateReplayOverlay(overlay, `Failed Step ${index + 1}/${actions.length}`, description, 'failed');
          return {
            ok: false,
            failedActionId: action.id,
            results
          };
        }

        await sleep(options.afterActionMs);
        await waitForPageToSettle();
      }

      updateReplayOverlay(overlay, 'Replay passed', `${actions.length} step${actions.length === 1 ? '' : 's'} completed`, 'passed');
      await sleep(options.afterActionMs);
      return {
        ok: true,
        results
      };
    } finally {
      window.FactoryReplayInProgress = false;
      window.setTimeout(() => overlay.remove(), 1200);
    }
  }

  async function replayAction(action, options) {
    const resolved = resolveElement(action);
    if (!resolved.element) {
      return {
        ok: false,
        selector: resolved.selector,
        error: `Element not found for ${action.type} action.`
      };
    }

    await prepareElementForHumanReplay(resolved.element, options);

    if (action.type === 'click') {
      resolved.element.click();
      return {
        ok: true,
        selector: resolved.selector,
        action: 'click'
      };
    }

    if (action.type === 'input') {
      await setControlValue(resolved.element, action, options);
      return {
        ok: true,
        selector: resolved.selector,
        action: 'input'
      };
    }

    return {
      ok: false,
      selector: resolved.selector,
      error: `Unsupported replay action type: ${action.type}`
    };
  }

  function resolveElement(action) {
    const candidates = selectorCandidates(action);

    for (const candidate of candidates) {
      const element = queryElement(candidate);
      if (element) {
        return {
          selector: candidate.value,
          selectorType: candidate.type,
          element
        };
      }
    }

    return {
      selector: candidates[0]?.value || null,
      element: null
    };
  }

  function selectorCandidates(action) {
    const selectors = action.selectors || {};
    return [
      selectors.testId ? { type: 'testId', value: selectors.testId } : null,
      selectors.id ? { type: 'id', value: selectors.id } : null,
      selectors.css ? { type: 'css', value: selectors.css } : null,
      selectors.xpath ? { type: 'xpath', value: selectors.xpath } : null
    ].filter(Boolean);
  }

  function queryElement(candidate) {
    if (candidate.type === 'xpath') {
      return document.evaluate(candidate.value, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    }

    try {
      return document.querySelector(candidate.value);
    } catch {
      return null;
    }
  }

  async function prepareElementForHumanReplay(element, options) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    await sleep(options.scrollMs);
    const cleanup = highlightElement(element);
    await sleep(options.beforeActionMs);
    cleanup();
  }

  function highlightElement(element) {
    const previousOutline = element.style.outline;
    const previousOutlineOffset = element.style.outlineOffset;
    const previousBoxShadow = element.style.boxShadow;

    element.style.outline = '3px solid #d9461e';
    element.style.outlineOffset = '3px';
    element.style.boxShadow = '0 0 0 6px rgba(217, 70, 30, 0.18)';

    return () => {
      element.style.outline = previousOutline;
      element.style.outlineOffset = previousOutlineOffset;
      element.style.boxShadow = previousBoxShadow;
    };
  }

  async function setControlValue(element, action, options) {
    if (element instanceof HTMLSelectElement) {
      setSelectValue(element, action.value ?? '');
      return;
    }

    if (element instanceof HTMLInputElement && ['checkbox', 'radio'].includes((element.type || '').toLowerCase())) {
      setCheckedValue(element, Boolean(action.checked));
      return;
    }

    await setTextValue(element, action.value ?? '', options);
  }

  function setSelectValue(element, value) {
    element.focus();
    element.value = String(value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function setCheckedValue(element, checked) {
    element.focus();
    if (element.type === 'radio') {
      if (checked && !element.checked) {
        element.click();
      }
      return;
    }

    if (element.checked !== checked) {
      element.click();
      return;
    }

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function setTextValue(element, value, options) {
    element.focus();
    element.value = '';
    element.dispatchEvent(new Event('input', { bubbles: true }));

    for (const character of String(value)) {
      element.value += character;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(options.keyMs);
    }

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function waitForPageToSettle() {
    return new Promise((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
    });
  }

  function normalizeOptions(options = {}) {
    const speed = options.speed || 'demo';
    const presets = {
      slow: {
        scrollMs: 450,
        beforeActionMs: 650,
        afterActionMs: 900,
        keyMs: 90
      },
      demo: {
        scrollMs: 300,
        beforeActionMs: 420,
        afterActionMs: 650,
        keyMs: 55
      },
      normal: {
        scrollMs: 120,
        beforeActionMs: 160,
        afterActionMs: 240,
        keyMs: 20
      }
    };

    return presets[speed] || presets.demo;
  }

  function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function routeFromUrl(url) {
    try {
      return new URL(url).hash.replace('#/', '') || 'login';
    } catch {
      return '';
    }
  }

  function createReplayOverlay() {
    let overlay = document.querySelector('#factory-replay-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'factory-replay-overlay';
      overlay.style.cssText = [
        'position:fixed',
        'left:50%',
        'bottom:24px',
        'z-index:2147483647',
        'width:min(560px, calc(100vw - 32px))',
        'transform:translateX(-50%)',
        'padding:14px 16px',
        'border:1px solid #c8d0d8',
        'border-radius:8px',
        'background:#ffffff',
        'color:#18202a',
        'font:14px Arial, Helvetica, sans-serif',
        'box-shadow:0 12px 32px rgba(20,28,38,.22)',
        'pointer-events:none'
      ].join(';');
      document.body.appendChild(overlay);
    }

    return overlay;
  }

  function updateReplayOverlay(overlay, title, description, status) {
    const colors = {
      running: '#146c5f',
      passed: '#146c5f',
      failed: '#a33a2b'
    };

    overlay.innerHTML = `
      <div style="font-size:12px;font-weight:700;color:${colors[status] || '#146c5f'};text-transform:uppercase;margin-bottom:4px">${escapeHtml(title)}</div>
      <div style="font-size:15px;font-weight:700;line-height:1.35">${escapeHtml(description)}</div>
    `;
  }

  function describeAction(action) {
    if (action.description) {
      return action.description;
    }

    const target = action.targetText || action.primarySelector || action.elementSignature || action.targetTag || 'element';
    if (action.type === 'input') {
      return `Input "${action.value || ''}" into ${target}`;
    }

    return `Click ${target}`;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
})();
