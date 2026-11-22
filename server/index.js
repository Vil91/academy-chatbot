import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, getStudent } from './db.js';
import { loadKnowledge } from './kb.js';
import { chatCompletion, llmConfig } from './llm.js';
import { buildSystemPrompt, parseModelJson, detectLang } from './prompt.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8080);
// No fixed default: without ADMIN_KEY a random key is made at start and printed to the log.
const ADMIN_KEY = process.env.ADMIN_KEY || crypto.randomBytes(12).toString('base64url');

const db = openDb(process.env.DB_PATH || path.join(ROOT, 'data', 'academy.db'));
const kb = loadKnowledge(path.join(ROOT, 'knowledge'));
const ALLOWED_SOURCES = new Set([...kb.map((d) => d.id), 'student_profile']);

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));

// --- small helpers -------------------------------------------------------

function rateLimit(max, windowMs = 60_000) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const list = (hits.get(req.ip) || []).filter((t) => now - t < windowMs);
    if (list.length >= max) return res.status(429).json({ error: 'too_many_requests' });
    list.push(now);
    hits.set(req.ip, list);
    next();
  };
}

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const sid = (v) => (typeof v === 'string' ? v.slice(0, 64) : null);
const lang = (v) => (['hy', 'ru', 'en'].includes(v) ? v : 'hy');

// --- API -----------------------------------------------------------------

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, model: llmConfig().model, documents: kb.map((d) => d.id) });
});

app.post('/api/chat', rateLimit(20), async (req, res) => {
  const { sessionId, messages, studentCode, uiLang } = req.body || {};
  if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages_required' });

  const history = messages
    .slice(-12)
    .filter((m) => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  const last = history.at(-1);
  if (!last || last.role !== 'user' || !last.content.trim()) {
    return res.status(400).json({ error: 'last_message_must_be_user' });
  }
  if (last.content.length > 1000) return res.status(400).json({ error: 'message_too_long' });

  const student = studentCode ? getStudent(db, studentCode) : null;
  const langHint = detectLang(last.content, lang(uiLang));
  const system = buildSystemPrompt({
    kb,
    student,
    uiLang: lang(uiLang),
    langHint,
    today: new Date().toISOString().slice(0, 10),
  });

  let raw;
  try {
    raw = await chatCompletion([{ role: 'system', content: system }, ...history]);
  } catch (err) {
    console.error('[chat] LLM error:', err.message);
    return res.status(502).json({ error: 'llm_unavailable' });
  }

  const out = parseModelJson(raw, {
    fallbackLang: langHint,
    allowedSources: ALLOWED_SOURCES,
    signedIn: Boolean(student),
  });

  const session = sid(sessionId);
  const log = db.prepare('INSERT INTO messages (session_id, role, content, lang) VALUES (?, ?, ?, ?)');
  log.run(session, 'user', last.content, out.lang);
  log.run(session, 'assistant', out.answer, out.lang);
  if (out.handoff) {
    db.prepare('INSERT INTO handoffs (session_id, question, answer, lang) VALUES (?, ?, ?, ?)').run(
      session,
      last.content,
      out.answer,
      out.lang,
    );
  }

  res.json(out);
});

app.post('/api/student/login', rateLimit(30), (req, res) => {
  const student = getStudent(db, req.body?.code);
  if (!student) return res.status(404).json({ error: 'student_not_found' });
  res.json({ student });
});

app.post('/api/lead', rateLimit(10), (req, res) => {
  const name = str(req.body?.name, 120);
  const contact = str(req.body?.contact, 120);
  if (name.length < 2 || contact.length < 3) return res.status(400).json({ error: 'name_and_contact_required' });
  const info = db
    .prepare('INSERT INTO leads (session_id, name, contact, interest, preferred_time, lang) VALUES (?, ?, ?, ?, ?, ?)')
    .run(sid(req.body?.sessionId), name, contact, str(req.body?.interest, 80), str(req.body?.preferredTime, 80), lang(req.body?.lang));
  res.status(201).json({ ok: true, id: Number(info.lastInsertRowid) });
});

app.post('/api/excuse', rateLimit(10), (req, res) => {
  const student = getStudent(db, req.body?.code);
  if (!student) return res.status(401).json({ error: 'sign_in_required' });
  const date = str(req.body?.date, 10);
  const reason = str(req.body?.reason, 500);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || reason.length < 3) return res.status(400).json({ error: 'date_and_reason_required' });
  const info = db
    .prepare('INSERT INTO excuses (student_code, date, reason) VALUES (?, ?, ?)')
    .run(student.code, date, reason);
  res.status(201).json({ ok: true, id: Number(info.lastInsertRowid) });
});

app.get('/api/admin/summary', (req, res) => {
  if (req.get('x-admin-key') !== ADMIN_KEY) return res.status(401).json({ error: 'unauthorized' });
  const all = (sql) => db.prepare(sql).all();
  const one = (sql) => db.prepare(sql).get();
  res.json({
    counts: {
      leads: one('SELECT COUNT(*) AS n FROM leads').n,
      openHandoffs: one("SELECT COUNT(*) AS n FROM handoffs WHERE status = 'open'").n,
      excuses: one('SELECT COUNT(*) AS n FROM excuses').n,
      questions: one("SELECT COUNT(*) AS n FROM messages WHERE role = 'user'").n,
    },
    leads: all('SELECT * FROM leads ORDER BY id DESC LIMIT 50'),
    handoffs: all('SELECT * FROM handoffs ORDER BY id DESC LIMIT 50'),
    excuses: all('SELECT * FROM excuses ORDER BY id DESC LIMIT 50'),
    questions: all("SELECT session_id, content, lang, created_at FROM messages WHERE role = 'user' ORDER BY id DESC LIMIT 50"),
  });
});

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
  console.error('[server]', err);
  res.status(500).json({ error: 'server_error' });
});

app.listen(PORT, () => {
  const { model, baseUrl } = llmConfig();
  console.log(`Academy Concierge on :${PORT} · model ${model} via ${baseUrl} · ${kb.length} docs`);
  if (!process.env.ADMIN_KEY) console.log(`Admin key (generated for this run): ${ADMIN_KEY}`);
});
