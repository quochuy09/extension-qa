import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT || 4173);
const publicDir = path.resolve(__dirname, '../../public');
const actionLogPath = path.resolve(__dirname, '../../logs/action-log.json');
const logsDir = path.dirname(actionLogPath);
const orders = [];
const maxOrders = 50;

app.disable('x-powered-by');

app.use((_req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  next();
});

app.use(express.json({ limit: '2mb' }));
app.use(express.static(publicDir));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'demo-shop', timestamp: new Date().toISOString() });
});

app.post('/api/demo/login', requireLoopbackDemoEndpoint, (req, res) => {
  if (!['alice', 'bob'].includes(req.body?.userId)) {
    res.status(400).json({ ok: false, error: 'Invalid demo user.' });
    return;
  }

  res.cookie('demoUserId', req.body.userId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/'
  });
  res.json({ ok: true, userId: req.body.userId });
});

app.post('/api/recordings', async (req, res) => {
  if (!req.body?.metadata || !Array.isArray(req.body?.actions)) {
    res.status(400).json({ ok: false, error: 'Invalid action log payload.' });
    return;
  }

  const namedPath = path.join(logsDir, `${safeFileName(req.body.testCase?.name || 'action-log')}.json`);
  const payload = `${JSON.stringify(req.body, null, 2)}\n`;
  await fs.mkdir(logsDir, { recursive: true });
  await Promise.all([
    fs.writeFile(actionLogPath, payload, 'utf8'),
    fs.writeFile(namedPath, payload, 'utf8')
  ]);
  res.json({
    ok: true,
    path: actionLogPath,
    namedPath,
    actionCount: req.body.actions.length
  });
});

app.post('/api/orders', (req, res) => {
  const validation = validateOrder(req.body);
  if (!validation.ok) {
    res.status(400).json({
      ok: false,
      error: validation.error,
      field: validation.field
    });
    return;
  }

  const order = {
    orderId: `ORD-${Date.now()}`,
    ownerUserId: currentUserId(req),
    payload: {
      cart: req.body.cart,
      shippingMethod: req.body.shippingMethod,
      paymentMethod: req.body.paymentMethod
    },
    createdAt: new Date().toISOString()
  };
  orders.push(order);
  while (orders.length > maxOrders) {
    orders.shift();
  }

  res.json({
    ok: true,
    orderId: order.orderId,
    itemCount: req.body.cart.length
  });
});

app.get('/api/orders/:orderId', requireLoopbackDemoEndpoint, (req, res) => {
  const userId = authenticatedDemoUserId(req);
  if (!userId) {
    res.status(401).json({ ok: false, error: 'Authentication required.' });
    return;
  }

  const order = orders.find((candidate) => candidate.orderId === req.params.orderId);
  if (!order) {
    res.status(404).json({ ok: false, error: 'Order not found.' });
    return;
  }

  if (order.ownerUserId !== userId) {
    res.status(403).json({
      ok: false,
      error: 'Forbidden order access.',
      orderId: order.orderId
    });
    return;
  }

  res.json({
    ok: true,
    orderId: order.orderId,
    ownerUserId: order.ownerUserId,
    order: {
      cart: order.payload.cart,
      shippingMethod: order.payload.shippingMethod,
      paymentMethod: order.payload.paymentMethod
    }
  });
});

app.get('/api/recordings/latest', async (_req, res) => {
  try {
    const content = await fs.readFile(actionLogPath, 'utf8');
    res.type('application/json').send(content);
  } catch {
    res.status(404).json({ ok: false, error: 'No local action log has been saved yet.' });
  }
});

app.get(['/', '/login', '/products', '/cart', '/checkout', '/confirmation'], (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(port, () => {
  console.log(`Demo shop is running at http://localhost:${port}`);
});

function safeFileName(value) {
  return String(value || '')
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'action-log';
}

export function isLoopbackRemoteAddress(value) {
  const normalized = String(value || '')
    .trim()
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .split('%')[0];

  return normalized === '127.0.0.1'
    || normalized === '::1'
    || normalized === '::ffff:127.0.0.1'
    || normalized === 'localhost';
}

function requireLoopbackDemoEndpoint(req, res, next) {
  if (isLoopbackRemoteAddress(req.socket?.remoteAddress || req.ip)) {
    next();
    return;
  }

  res.status(403).json({ ok: false, error: 'Local demo endpoint only.' });
}

function currentUserId(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  return ['alice', 'bob'].includes(cookies.demoUserId) ? cookies.demoUserId : 'alice';
}

function authenticatedDemoUserId(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  return ['alice', 'bob'].includes(cookies.demoUserId) ? cookies.demoUserId : null;
}

function parseCookies(value) {
  return String(value || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex > 0) {
        cookies[part.slice(0, separatorIndex)] = decodeURIComponent(part.slice(separatorIndex + 1));
      }
      return cookies;
    }, {});
}

function validateOrder(payload) {
  const allowedFields = new Set([
    'fullName',
    'postalCode',
    'shippingMethod',
    'superiorEmployee',
    'facePhoto',
    'paymentMethod',
    'giftWrap',
    'deliveryNote',
    'cart'
  ]);
  const requiredFields = ['fullName', 'postalCode', 'shippingMethod', 'facePhoto', 'paymentMethod', 'giftWrap', 'cart'];

  if (!isPlainObject(payload)) {
    return invalid('body', 'Order payload must be a JSON object.');
  }

  for (const field of Object.keys(payload)) {
    if (!allowedFields.has(field)) {
      return invalid(field, 'Unknown field is not allowed.');
    }
  }

  for (const field of requiredFields) {
    if (!(field in payload)) {
      return invalid(field, 'Required field is missing.');
    }
  }

  const stringChecks = [
    ['fullName', 1, 80],
    ['postalCode', 1, 20],
    ['deliveryNote', 0, 200]
  ];
  for (const [field, min, max] of stringChecks) {
    if (field in payload && !validStringLength(payload[field], min, max)) {
      return invalid(field, `${field} must be a string from ${min} to ${max} characters.`);
    }
  }

  if (!['standard', 'express', 'pickup'].includes(payload.shippingMethod)) {
    return invalid('shippingMethod', 'Invalid shipping method.');
  }

  if (!['', 'employee-19', 'employee-20', 'employee-21'].includes(payload.superiorEmployee ?? '')) {
    return invalid('superiorEmployee', 'Invalid superior employee.');
  }

  if (!Array.isArray(payload.facePhoto) || payload.facePhoto.length > 2 || payload.facePhoto.some((value) => !['1', '0'].includes(value))) {
    return invalid('facePhoto', 'Invalid face photo option.');
  }

  if (!['card', 'bank'].includes(payload.paymentMethod)) {
    return invalid('paymentMethod', 'Invalid payment method.');
  }

  if (typeof payload.giftWrap !== 'boolean') {
    return invalid('giftWrap', 'giftWrap must be a boolean.');
  }

  if (!Array.isArray(payload.cart) || payload.cart.length < 1 || payload.cart.length > 10) {
    return invalid('cart', 'Cart must contain from 1 to 10 items.');
  }

  if (payload.cart.some((value) => !['bento-laptop-stand', 'qa-notebook'].includes(value))) {
    return invalid('cart', 'Cart contains an unknown product.');
  }

  return { ok: true };
}

function invalid(field, error) {
  return {
    ok: false,
    field,
    error
  };
}

function validStringLength(value, min, max) {
  return typeof value === 'string' && value.length >= min && value.length <= max;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
