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

app.use(express.json({ limit: '2mb' }));
app.use(express.static(publicDir));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'demo-shop', timestamp: new Date().toISOString() });
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
