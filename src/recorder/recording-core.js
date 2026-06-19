import fs from 'node:fs/promises';
import path from 'node:path';

export const defaultOutputPath = path.resolve('logs/action-log.json');

export async function installRecorder(page, onAction) {
  await page.exposeBinding('__recordFactoryAction', async (_source, action) => {
    onAction(action);
  });

  await page.addInitScript(recorderBrowserScript);
}

export function normalizeRecording(rawActions) {
  const deduped = dedupeConsecutiveActions(rawActions);
  return {
    metadata: {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      source: 'playwright-recorder',
      actionCount: deduped.length
    },
    groups: groupActions(deduped),
    actions: deduped
  };
}

export async function writeRecording(rawActions, outputPath = defaultOutputPath) {
  const normalized = normalizeRecording(rawActions);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  return normalized;
}

function dedupeConsecutiveActions(actions) {
  const result = [];

  for (const action of actions) {
    const previous = result[result.length - 1];
    if (previous && isDuplicate(previous, action)) {
      result[result.length - 1] = {
        ...action,
        dedupedFrom: previous.id
      };
      continue;
    }

    result.push(action);
  }

  return result.map((action, index) => ({
    ...action,
    id: `act-${String(index + 1).padStart(3, '0')}`
  }));
}

function isDuplicate(previous, current) {
  const sameElement = previous.elementSignature === current.elementSignature;
  const sameType = previous.type === current.type;
  const fastRepeat = new Date(current.timestamp).getTime() - new Date(previous.timestamp).getTime() < 700;

  if (!sameElement || !sameType) {
    return false;
  }

  if (current.type === 'input') {
    return true;
  }

  return fastRepeat;
}

function groupActions(actions) {
  const groups = [];

  for (const action of actions) {
    const groupName = inferGroupName(action);
    const current = groups[groups.length - 1];

    if (!current || current.name !== groupName) {
      groups.push({
        name: groupName,
        startedAtActionId: action.id,
        actionIds: []
      });
    }

    groups[groups.length - 1].actionIds.push(action.id);
  }

  return groups;
}

function inferGroupName(action) {
  const route = action.url.split('#/')[1] || action.url.split('/').pop() || '';
  const text = `${action.targetText || ''} ${action.selectors?.testId || ''}`.toLowerCase();

  if (route.includes('login') || text.includes('login') || text.includes('username') || text.includes('password')) {
    return 'Login';
  }

  if (route.includes('products') || text.includes('add-to-cart') || text.includes('add to cart')) {
    return 'Products';
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

  return 'Products';
}

function recorderBrowserScript() {
  const recordedInputs = new WeakMap();

  function selectorPayload(element) {
    const tag = element.tagName.toLowerCase();
    const text = visibleText(element);
    const testId = element.getAttribute('data-testid');
    const id = element.id;

    return {
      id: id ? `#${cssEscape(id)}` : null,
      testId: testId ? `[data-testid="${cssEscape(testId)}"]` : null,
      roleText: roleSelector(element, text),
      css: cssPath(element),
      xpath: xpathFor(element)
    };
  }

  function roleSelector(element, text) {
    const explicitRole = element.getAttribute('role');
    const tag = element.tagName.toLowerCase();
    const role =
      explicitRole ||
      (tag === 'button' ? 'button' : null) ||
      (tag === 'input' ? inputRole(element) : null) ||
      (tag === 'a' ? 'link' : null);

    if (!role) {
      return null;
    }

    const name = element.getAttribute('aria-label') || text || element.getAttribute('placeholder') || element.getAttribute('name');
    return name ? `getByRole('${role}', { name: '${escapeForSingleQuote(name)}' })` : `getByRole('${role}')`;
  }

  function inputRole(element) {
    const type = (element.getAttribute('type') || 'text').toLowerCase();
    if (['button', 'submit', 'reset'].includes(type)) {
      return 'button';
    }

    return 'textbox';
  }

  function cssPath(element) {
    if (element.id) {
      return `#${cssEscape(element.id)}`;
    }

    const segments = [];
    let current = element;

    while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
      const tag = current.tagName.toLowerCase();
      const testId = current.getAttribute('data-testid');
      if (testId) {
        segments.unshift(`${tag}[data-testid="${cssEscape(testId)}"]`);
        break;
      }

      const siblings = Array.from(current.parentElement.children).filter((child) => child.tagName === current.tagName);
      const index = siblings.indexOf(current) + 1;
      segments.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${index})` : tag);
      current = current.parentElement;
    }

    return segments.join(' > ');
  }

  function xpathFor(element) {
    const testId = element.getAttribute('data-testid');
    if (testId) {
      return `//*[@data-testid="${testId}"]`;
    }

    if (element.id) {
      return `//*[@id="${element.id}"]`;
    }

    const parts = [];
    let current = element;

    while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
      const siblings = Array.from(current.parentElement.children).filter((child) => child.tagName === current.tagName);
      const index = siblings.indexOf(current) + 1;
      parts.unshift(`${current.tagName.toLowerCase()}[${index}]`);
      current = current.parentElement;
    }

    return `//body/${parts.join('/')}`;
  }

  function visibleText(element) {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      const label = document.querySelector(`label[for="${cssEscape(element.id)}"]`);
      return label?.textContent?.trim() || element.getAttribute('placeholder') || element.getAttribute('name') || '';
    }

    return (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function emit(type, element, value = null) {
    const selectors = selectorPayload(element);
    const action = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type,
      value,
      url: window.location.href,
      title: document.title,
      targetTag: element.tagName.toLowerCase(),
      targetText: visibleText(element),
      selectors,
      elementSignature: selectors.testId || selectors.id || selectors.roleText || selectors.css
    };

    window.__recordFactoryAction(action);
  }

  document.addEventListener(
    'click',
    (event) => {
      const target = event.target.closest('button,a,[role="button"],input[type="submit"]');
      if (target) {
        emit('click', target);
      }
    },
    true
  );

  document.addEventListener(
    'change',
    (event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
        const value = target.type === 'password' ? target.value : target.value;
        const previous = recordedInputs.get(target);
        if (previous !== value) {
          recordedInputs.set(target, value);
          emit('input', target, value);
        }
      }
    },
    true
  );

  function cssEscape(value) {
    return window.CSS?.escape ? window.CSS.escape(value) : String(value).replace(/"/g, '\\"');
  }

  function escapeForSingleQuote(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }
}
