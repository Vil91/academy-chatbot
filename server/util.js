export const LANGS = ['hy', 'ru', 'en'];

export const normLang = (value) => (LANGS.includes(value) ? value : 'hy');

export const str = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

export function rateLimit(max, windowMs = 60_000) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const list = (hits.get(req.ip) || []).filter((t) => now - t < windowMs);
    if (list.length >= max) return res.status(429).json({ error: 'too_many_requests' });
    list.push(now);
    hits.set(req.ip, list);
    if (hits.size > 5000) hits.clear();
    next();
  };
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.is_demo ? null : user.email,
    code: user.code,
    program: user.program,
    lang: user.lang,
    isDemo: Boolean(user.is_demo),
    profile: JSON.parse(user.profile),
  };
}

export function toClientMessage(row) {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    meta: row.meta ? JSON.parse(row.meta) : null,
    createdAt: row.created_at,
  };
}
