(function () {
  const state = {
    cart: []
  };

  const routes = {
    login: document.querySelector('#login-view'),
    products: document.querySelector('#products-view'),
    cart: document.querySelector('#cart-view'),
    checkout: document.querySelector('#checkout-view'),
    confirmation: document.querySelector('#confirmation-view')
  };

  const products = {
    'bento-laptop-stand': {
      id: 'bento-laptop-stand',
      name: 'Bento Laptop Stand'
    },
    'qa-notebook': {
      id: 'qa-notebook',
      name: 'QA Field Notebook'
    }
  };

  function routeFromLocation() {
    const hashRoute = window.location.hash.replace(/^#\/?/, '');
    if (routes[hashRoute]) {
      return hashRoute;
    }

    const pathRoute = window.location.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
    if (routes[pathRoute]) {
      return pathRoute;
    }

    return 'login';
  }

  function show(route, options = {}) {
    const nextRoute = routes[route] ? route : 'login';
    resetRouteDefaults(nextRoute);
    Object.values(routes).forEach((view) => view.classList.remove('active'));
    routes[nextRoute].classList.add('active');

    if (options.updateUrl !== false && window.location.hash !== `#/${nextRoute}`) {
      window.history.pushState({}, '', `#/${nextRoute}`);
    }
  }

  function resetRouteDefaults(route) {
    if (route === 'login') {
      document.querySelector('#login-form').reset();
    }

    if (route === 'checkout') {
      document.querySelector('#checkout-form').reset();
      resetCustomControls();
    }
  }

  function updateCart() {
    document.querySelector('#cart-count').textContent = String(state.cart.length);
    const list = document.querySelector('#cart-items');
    list.innerHTML = '';

    if (state.cart.length === 0) {
      const empty = document.createElement('li');
      empty.textContent = 'Your cart is empty.';
      list.appendChild(empty);
      return;
    }

    state.cart.forEach((productId) => {
      const item = document.createElement('li');
      item.textContent = products[productId]?.name || productId;
      list.appendChild(item);
    });
  }

  document.querySelector('#login-form').addEventListener('submit', (event) => {
    event.preventDefault();
    show('products');
  });

  document.querySelectorAll('[data-testid^="add-to-cart-"]').forEach((button) => {
    button.addEventListener('click', () => {
      const card = button.closest('[data-product-id]');
      state.cart.push(products[card.dataset.productId].id);
      updateCart();
    });
  });

  document.querySelector('#nav-products').addEventListener('click', () => show('products'));
  document.querySelector('#nav-cart').addEventListener('click', () => {
    updateCart();
    show('cart');
  });
  document.querySelector('#checkout-button').addEventListener('click', () => show('checkout'));
  document.querySelector('#checkout-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = event.submitter || document.querySelector('#place-order-button');
    submitButton.disabled = true;

    try {
      setOrderError('');
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json'
        },
        body: JSON.stringify(orderPayloadFromForm(event.currentTarget))
      });
      const result = await response.json().catch(() => ({ ok: false, error: 'Invalid server response.' }));

      if (!response.ok || result.ok !== true) {
        setOrderError(result.error || 'Order validation failed.');
        return;
      }

      state.cart = [];
      updateCart();
      show('confirmation');
    } finally {
      submitButton.disabled = false;
    }
  });
  document.querySelector('#back-to-products').addEventListener('click', () => show('products'));
  window.addEventListener('hashchange', () => show(routeFromLocation(), { updateUrl: false }));
  window.addEventListener('popstate', () => show(routeFromLocation(), { updateUrl: false }));
  window.addEventListener('factory:navigate', () => show(routeFromLocation(), { updateUrl: false }));

  setupSelect2Demo();
  setupMultiselectDemo();
  updateCart();
  show(routeFromLocation(), { updateUrl: false });

  function setupSelect2Demo() {
    document.querySelectorAll('[data-control-type="select2"]').forEach((wrapper) => {
      const button = wrapper.querySelector('[data-role="select2-button"]');
      const results = wrapper.querySelector('[data-role="select2-results"]');
      const select = wrapper.querySelector('select');

      button.addEventListener('click', () => {
        const nextOpen = results.hidden;
        results.hidden = !nextOpen;
        button.setAttribute('aria-expanded', String(nextOpen));
      });

      results.querySelectorAll('[data-option-value]').forEach((option) => {
        option.addEventListener('click', () => {
          setSelect2Value(wrapper, option.dataset.optionValue, option.textContent.trim());
          select.dispatchEvent(new Event('change', { bubbles: true }));
        });
      });
    });
  }

  function setupMultiselectDemo() {
    document.querySelectorAll('[data-control-type="multiselect"]').forEach((wrapper) => {
      const button = wrapper.querySelector('[data-role="multiselect-button"]');
      const options = wrapper.querySelector('[data-role="multiselect-options"]');
      button.addEventListener('click', () => {
        const nextOpen = options.hidden;
        options.hidden = !nextOpen;
        button.setAttribute('aria-expanded', String(nextOpen));
      });

      wrapper.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
        checkbox.addEventListener('change', () => updateMultiselectSummary(wrapper));
      });
    });
  }

  function resetCustomControls() {
    document.querySelectorAll('[data-control-type="select2"]').forEach((wrapper) => {
      setSelect2Value(wrapper, '', '未選択');
    });

    document.querySelectorAll('[data-control-type="multiselect"]').forEach((wrapper) => {
      wrapper.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
        checkbox.checked = false;
      });
      updateMultiselectSummary(wrapper);
    });
  }

  function setSelect2Value(wrapper, value, text) {
    const select = wrapper.querySelector('select');
    const rendered = wrapper.querySelector('[data-role="select2-rendered"]');
    const results = wrapper.querySelector('[data-role="select2-results"]');
    const button = wrapper.querySelector('[data-role="select2-button"]');
    select.value = value;
    wrapper.dataset.selectedValue = value;
    wrapper.dataset.selectedText = text;
    rendered.textContent = text;
    results.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  }

  function updateMultiselectSummary(wrapper) {
    const checked = Array.from(wrapper.querySelectorAll('input[type="checkbox"]:checked'));
    const button = wrapper.querySelector('[data-role="multiselect-button"]');
    button.textContent = checked.length
      ? checked.map((checkbox) => checkbox.closest('label').textContent.trim()).join(', ')
      : 'Choose options';
  }

  function orderPayloadFromForm(form) {
    const formData = new FormData(form);
    return {
      fullName: String(formData.get('fullName') || ''),
      postalCode: String(formData.get('postalCode') || ''),
      shippingMethod: String(formData.get('shippingMethod') || ''),
      superiorEmployee: String(formData.get('superiorEmployee') || ''),
      facePhoto: formData.getAll('facePhoto[]').map(String),
      paymentMethod: String(formData.get('paymentMethod') || ''),
      giftWrap: formData.has('giftWrap'),
      deliveryNote: String(formData.get('deliveryNote') || ''),
      cart: [...state.cart]
    };
  }

  function setOrderError(message) {
    const form = document.querySelector('#checkout-form');
    let error = form.querySelector('[data-testid="checkout-error"]');
    if (!error) {
      error = document.createElement('p');
      error.dataset.testid = 'checkout-error';
      error.setAttribute('role', 'alert');
      error.className = 'form-error';
      form.insertBefore(error, form.querySelector('#place-order-button'));
    }

    error.textContent = message;
    error.hidden = !message;
  }
})();
