import crypto from 'node:crypto';
import {
  clearSessionCookie,
  createSession,
  deleteSession,
  hashPassword,
  setSessionCookie,
  verifyPassword,
} from '../auth.js';
import { PROGRAMS, demoProfile, makeProfile } from '../profile.js';
import { normLang, publicUser, rateLimit, str } from '../util.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function newCode(db, prefix) {
  for (;;) {
    const code = `${prefix}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    if (!db.prepare('SELECT 1 FROM users WHERE code = ?').get(code)) return code;
  }
}

export function registerAuth(app, { db }) {
  // Sign the user in and move what they did as a guest (chats, uploads) into their account.
  function signIn(req, res, user) {
    setSessionCookie(req, res, createSession(db, user.id));
    if (req.deviceId) {
      const from = `g:${req.deviceId}`;
      const to = `u:${user.id}`;
      db.prepare('UPDATE conversations SET owner = ? WHERE owner = ?').run(to, from);
      db.prepare('UPDATE attachments SET owner = ? WHERE owner = ?').run(to, from);
    }
  }

  app.get('/api/auth/me', (req, res) => res.json({ user: publicUser(req.user) }));

  app.get('/api/auth/config', (_req, res) => {
    res.json({ googleClientId: (process.env.GOOGLE_CLIENT_ID || '').trim() || null });
  });

  // Google Identity Services sign-in: verifies the ID token with Google's tokeninfo endpoint.
  app.post('/api/auth/google', rateLimit(15), async (req, res) => {
    const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
    if (!clientId) return res.status(503).json({ error: 'google_not_configured' });
    const credential = typeof req.body?.credential === 'string' ? req.body.credential.trim() : '';
    if (!credential || credential.length > 4096) return res.status(400).json({ error: 'invalid_credential' });

    let payload;
    try {
      const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) return res.status(401).json({ error: 'invalid_google_token' });
      payload = await r.json();
    } catch {
      return res.status(502).json({ error: 'google_verify_failed' });
    }

    if (payload.aud !== clientId || payload.email_verified !== 'true' || !payload.email) {
      return res.status(401).json({ error: 'invalid_google_token' });
    }

    const email = String(payload.email).toLowerCase().slice(0, 120);
    const name = str(payload.name || email.split('@')[0], 80) || 'Student';
    let user = db.prepare('SELECT * FROM users WHERE email = ? AND is_demo = 0').get(email);
    if (!user) {
      const code = newCode(db, 'PA');
      const program = PROGRAMS[0];
      const info = db
        .prepare('INSERT INTO users (email, name, code, program, lang, profile) VALUES (?, ?, ?, ?, ?, ?)')
        .run(email, name, code, program, normLang(req.body?.lang), JSON.stringify(makeProfile({ name, program, code })));
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    }
    signIn(req, res, user);
    res.json({ user: publicUser(user) });
  });

  app.post('/api/auth/signup', rateLimit(5, 10 * 60_000), async (req, res) => {
    const name = str(req.body?.name, 80);
    const email = str(req.body?.email, 120).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const program = PROGRAMS.includes(req.body?.program) ? req.body.program : PROGRAMS[0];
    if (name.length < 2) return res.status(400).json({ error: 'name_required' });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'invalid_email' });
    if (password.length < 8 || password.length > 200) return res.status(400).json({ error: 'weak_password' });
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return res.status(409).json({ error: 'email_taken' });

    const code = newCode(db, 'PA');
    const info = db
      .prepare('INSERT INTO users (email, password_hash, name, code, program, lang, profile) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(email, await hashPassword(password), name, code, program, normLang(req.body?.lang), JSON.stringify(makeProfile({ name, program, code })));
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    signIn(req, res, user);
    res.status(201).json({ user: publicUser(user) });
  });

  app.post('/api/auth/login', rateLimit(10), async (req, res) => {
    const email = str(req.body?.email, 120).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND is_demo = 0').get(email);
    const ok = user ? await verifyPassword(password, user.password_hash) : false;
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' });
    signIn(req, res, user);
    res.json({ user: publicUser(user) });
  });

  // Every visitor gets their own copy of the demo student, so nobody sees anyone else's chats.
  app.post('/api/auth/demo', rateLimit(10), (req, res) => {
    const code = newCode(db, 'DEMO');
    const info = db
      .prepare('INSERT INTO users (email, name, code, program, lang, profile, is_demo) VALUES (?, ?, ?, ?, ?, ?, 1)')
      .run(`${code.toLowerCase()}@demo.local`, 'Aram Petrosyan', code, PROGRAMS[0], normLang(req.body?.lang), JSON.stringify(demoProfile(code)));
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    signIn(req, res, user);
    res.status(201).json({ user: publicUser(user) });
  });

  app.post('/api/auth/logout', (req, res) => {
    deleteSession(db, req.sessionToken);
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });
}
