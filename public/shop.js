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
    'bento-laptop-stand': 'Bento Laptop Stand',
    'qa-notebook': 'QA Field Notebook'
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

    state.cart.forEach((productName) => {
      const item = document.createElement('li');
      item.textContent = productName;
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
      state.cart.push(products[card.dataset.productId]);
      updateCart();
    });
  });

  document.querySelector('#nav-products').addEventListener('click', () => show('products'));
  document.querySelector('#nav-cart').addEventListener('click', () => {
    updateCart();
    show('cart');
  });
  document.querySelector('#checkout-button').addEventListener('click', () => show('checkout'));
  document.querySelector('#checkout-form').addEventListener('submit', (event) => {
    event.preventDefault();
    state.cart = [];
    updateCart();
    show('confirmation');
  });
  document.querySelector('#back-to-products').addEventListener('click', () => show('products'));
  window.addEventListener('hashchange', () => show(routeFromLocation(), { updateUrl: false }));
  window.addEventListener('popstate', () => show(routeFromLocation(), { updateUrl: false }));
  window.addEventListener('factory:navigate', () => show(routeFromLocation(), { updateUrl: false }));

  updateCart();
  show(routeFromLocation(), { updateUrl: false });
})();
