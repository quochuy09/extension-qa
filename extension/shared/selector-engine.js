(function () {
  function getSelectorPayload(element) {
    const text = visibleText(element);
    const testId = element.getAttribute('data-testid');
    const id = element.id;

    return {
      testId: testId ? `[data-testid="${cssEscape(testId)}"]` : null,
      id: id ? `#${cssEscape(id)}` : null,
      roleText: roleSelector(element, text),
      css: cssPath(element),
      xpath: xpathFor(element)
    };
  }

  function getPrimarySelector(selectors) {
    return selectors.testId || selectors.id || selectors.roleText || selectors.css || selectors.xpath || null;
  }

  function roleSelector(element, text) {
    const explicitRole = element.getAttribute('role');
    const tag = element.tagName.toLowerCase();
    const role =
      explicitRole ||
      (tag === 'button' ? 'button' : null) ||
      (tag === 'input' ? inputRole(element) : null) ||
      (tag === 'select' ? 'combobox' : null) ||
      (tag === 'textarea' ? 'textbox' : null) ||
      (tag === 'a' ? 'link' : null);

    if (!role) {
      return null;
    }

    const name = element.getAttribute('aria-label') || text || element.getAttribute('placeholder') || element.getAttribute('name');
    return name ? `getByRole('${role}', { name: '${escapeForSingleQuote(name)}' })` : `getByRole('${role}')`;
  }

  function inputRole(element) {
    const type = (element.getAttribute('type') || 'text').toLowerCase();
    if (type === 'checkbox') {
      return 'checkbox';
    }

    if (type === 'radio') {
      return 'radio';
    }

    return ['button', 'submit', 'reset'].includes(type) ? 'button' : 'textbox';
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
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
      const label = labelTextFor(element);
      return label || element.getAttribute('placeholder') || element.getAttribute('name') || '';
    }

    return (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function labelTextFor(element) {
    const explicitLabel = element.id ? document.querySelector(`label[for="${cssEscape(element.id)}"]`) : null;
    if (explicitLabel) {
      return explicitLabel.textContent?.trim() || '';
    }

    const wrappingLabel = element.closest('label');
    if (wrappingLabel) {
      return wrappingLabel.textContent?.replace(/\s+/g, ' ').trim() || '';
    }

    const fieldset = element.closest('fieldset');
    const legend = fieldset?.querySelector('legend');
    return legend?.textContent?.trim() || '';
  }

  function cssEscape(value) {
    return window.CSS?.escape ? window.CSS.escape(value) : String(value).replace(/"/g, '\\"');
  }

  function escapeForSingleQuote(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  window.FactorySelectorEngine = {
    getPrimarySelector,
    getSelectorPayload,
    visibleText
  };
})();
