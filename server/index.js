import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, openDb } from './db.js';
import { readSessionCookie, userFromSession } from './auth.js';
import { loadKnowledge } from './kb.js';
import { llmConfig } from './llm.js';
import { registerAuth } from './routes/auth.js';
import { registerChat } from './routes/chat.js';
import { registerAdmin } from './routes/admin.js';
import { registerTelegram } from './routes/telegram.js';
import { registerSlack } from './routes/slack.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8080);
// No fixed default: without ADMIN_KEY a random key is made at start and printed to the log.
const ADMIN_KEY = process.env.ADMIN_KEY || crypto.randomBytes(12).toString('base64url');

const db = openDb(process.env.DB_PATH || path.join(ROOT, 'data', 'academy.db'));
cleanup(db);
setInterval(() => cleanup(db), 60 * 60_000).unref();
const kbDir = path.join(ROOT, 'knowledge');
const kb = loadKnowledge(kbDir);

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(
  express.json({
    limit: '64kb',
    verify: (req, _res, buf) => {
      if (req.originalUrl?.startsWith('/api/slack/')) req.rawBody = buf.toString('utf8');
    },
  }),
);

// Who is asking: a signed-in user (session cookie) or a guest (device id kept in the browser).
app.use('/api', (req, _res, next) => {
  req.sessionToken = readSessionCookie(req);
  req.user = userFromSession(db, req.sessionToken);
  const device = req.get('x-device-id') || req.query.d;
  req.deviceId = typeof device === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(device) ? device : null;
  req.owner = req.user ? `u:${req.user.id}` : req.deviceId ? `g:${req.deviceId}` : null;
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    model: llmConfig().model,
    documents: kb.map((d) => d.id),
    channels: {
      web: true,
      telegram: Boolean((process.env.TELEGRAM_BOT_TOKEN || '').trim()),
      slack: Boolean((process.env.SLACK_BOT_TOKEN || '').trim() && (process.env.SLACK_SIGNING_SECRET || '').trim()),
    },
    googleAuth: Boolean((process.env.GOOGLE_CLIENT_ID || '').trim()),
    githubAuth: Boolean((process.env.GITHUB_CLIENT_ID || '').trim() && (process.env.GITHUB_CLIENT_SECRET || '').trim()),
  });
});

registerAuth(app, { db });
registerChat(app, { db, kb, adminKey: ADMIN_KEY });
registerAdmin(app, { db, kb, kbDir, adminKey: ADMIN_KEY });
registerTelegram(app, { db, kb });
registerSlack(app, { db, kb });

app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));

// --- web app (built by Vite into web/dist) -------------------------------

const dist = path.join(ROOT, 'web', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: '7d', immutable: true }));
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(dist, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid_json' });
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'file_too_large' });
  console.error('[server]', err);
  res.status(500).json({ error: 'server_error' });
});

app.listen(PORT, () => {
  const { model, baseUrl } = llmConfig();
  console.log(`Academy Concierge on :${PORT} · model ${model} via ${baseUrl} · ${kb.length} docs`);
  if (!process.env.ADMIN_KEY) console.log(`Admin key (generated for this run): ${ADMIN_KEY}`);
});
