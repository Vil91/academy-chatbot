import crypto from 'node:crypto';
import { clearSessionCookie, createSession, deleteSession, setSessionCookie } from '../auth.js';
import { PROGRAMS, makeProfile } from '../profile.js';
import { normLang, publicUser, rateLimit, str } from '../util.js';

function newCode(db, prefix) {
  for (;;) {
    const code = `${prefix}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    if (!db.prepare('SELECT 1 FROM users WHERE code = ?').get(code)) return code;
  }
}

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function publicOrigin(req) {
  const env = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/+$/, '');
  if (env) return env;
  const proto = req.get('x-forwarded-proto')?.split(',')[0]?.trim() || req.protocol;
  return `${proto}://${req.get('host')}`;
}

export function registerAuth(app, { db }) {
  function findOrCreateOAuthUser({ email, name, lang }) {
    const cleanEmail = String(email).toLowerCase().slice(0, 120);
    const cleanName = str(name || cleanEmail.split('@')[0], 80) || 'Student';
    let user = db.prepare('SELECT * FROM users WHERE email = ? AND is_demo = 0').get(cleanEmail);
    if (!user) {
      const code = newCode(db, 'PA');
      const program = PROGRAMS[0];
      const info = db
        .prepare('INSERT INTO users (email, name, code, program, lang, profile) VALUES (?, ?, ?, ?, ?, ?)')
        .run(cleanEmail, cleanName, code, program, normLang(lang), JSON.stringify(makeProfile({ name: cleanName, program, code })));
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    }
    return user;
  }

  app.get('/api/auth/me', (req, res) => res.json({ user: publicUser(req.user) }));

  app.get('/api/auth/config', (_req, res) => {
    res.json({
      googleClientId: (process.env.GOOGLE_CLIENT_ID || '').trim() || null,
      githubEnabled: Boolean((process.env.GITHUB_CLIENT_ID || '').trim() && (process.env.GITHUB_CLIENT_SECRET || '').trim()),
    });
  });

  // Google Identity Services sign-in (verifies ID token with Google tokeninfo).
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

    const user = findOrCreateOAuthUser({ email: payload.email, name: payload.name, lang: req.body?.lang });
    setSessionCookie(req, res, createSession(db, user.id));
    res.json({ user: publicUser(user) });
  });

  // GitHub OAuth 2.0 Authorization Code flow.
  app.get('/api/auth/github', rateLimit(20), (req, res) => {
    const clientId = (process.env.GITHUB_CLIENT_ID || '').trim();
    const clientSecret = (process.env.GITHUB_CLIENT_SECRET || '').trim();
    if (!clientId || !clientSecret) return res.redirect('/?auth_error=github_not_configured');

    const state = crypto.randomBytes(16).toString('hex');
    const secure = req.secure || req.get('x-forwarded-proto') === 'https';
    res.setHeader(
      'Set-Cookie',
      `ac_gh_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${secure ? '; Secure' : ''}`,
    );

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${publicOrigin(req)}/api/auth/github/callback`,
      scope: 'read:user user:email',
      state,
    });
    res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
  });

  app.get('/api/auth/github/callback', rateLimit(20), async (req, res) => {
    const clientId = (process.env.GITHUB_CLIENT_ID || '').trim();
    const clientSecret = (process.env.GITHUB_CLIENT_SECRET || '').trim();
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const savedState = readCookie(req, 'ac_gh_state') || '';

    const secure = req.secure || req.get('x-forwarded-proto') === 'https';
    res.setHeader('Set-Cookie', `ac_gh_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`);

    const stateOk =
      state.length > 0 &&
      state.length === savedState.length &&
      crypto.timingSafeEqual(Buffer.from(state), Buffer.from(savedState));
    if (!clientId || !clientSecret || !code || !stateOk) {
      return res.redirect('/?auth_error=github_failed');
    }

    try {
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: `${publicOrigin(req)}/api/auth/github/callback`,
        }),
        signal: AbortSignal.timeout(10000),
      });
      const tokenData = await tokenRes.json();
      if (!tokenData?.access_token) return res.redirect('/?auth_error=github_failed');

      const ghHeaders = {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Academy-Concierge',
      };
      const profileRes = await fetch('https://api.github.com/user', { headers: ghHeaders, signal: AbortSignal.timeout(8000) });
      const ghUser = await profileRes.json();
      if (!ghUser?.id) return res.redirect('/?auth_error=github_failed');

      let email = ghUser.email;
      if (!email) {
        const emailsRes = await fetch('https://api.github.com/user/emails', { headers: ghHeaders, signal: AbortSignal.timeout(8000) });
        const emails = await emailsRes.json().catch(() => []);
        const primary = Array.isArray(emails)
          ? emails.find((e) => e.primary && e.verified) || emails.find((e) => e.verified)
          : null;
        email = primary?.email || `${ghUser.login || ghUser.id}@users.noreply.github.com`;
      }

      const user = findOrCreateOAuthUser({ email, name: ghUser.name || ghUser.login, lang: 'hy' });
      setSessionCookie(req, res, createSession(db, user.id));
      res.redirect('/');
    } catch (err) {
      console.error('[github-auth]', err.message);
      res.redirect('/?auth_error=github_failed');
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    deleteSession(db, req.sessionToken);
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });
}
