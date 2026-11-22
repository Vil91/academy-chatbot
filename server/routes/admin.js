import { chatCompletion } from '../llm.js';
import { buildEmailPrompt, parseJsonLoose } from '../prompt.js';
import { todayYerevan } from '../profile.js';
import { LANGS, rateLimit, str, toClientMessage } from '../util.js';

export function registerAdmin(app, { db, kb, adminKey }) {
  const requireAdmin = (req, res, next) =>
    req.get('x-admin-key') === adminKey ? next() : res.status(401).json({ error: 'unauthorized' });
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const one = (sql, ...args) => db.prepare(sql).get(...args);

  app.get('/api/admin/summary', requireAdmin, (_req, res) => {
    res.json({
      counts: {
        users: one('SELECT COUNT(*) AS n FROM users WHERE is_demo = 0').n,
        demoSessions: one('SELECT COUNT(*) AS n FROM users WHERE is_demo = 1').n,
        leads: one('SELECT COUNT(*) AS n FROM leads').n,
        openHandoffs: one("SELECT COUNT(*) AS n FROM handoffs WHERE status = 'open'").n,
        pendingPayments: one("SELECT COUNT(*) AS n FROM payment_proofs WHERE status = 'pending'").n,
        excuses: one('SELECT COUNT(*) AS n FROM excuses').n,
        conversations: one('SELECT COUNT(*) AS n FROM conversations').n,
        questions: one("SELECT COUNT(*) AS n FROM messages WHERE role = 'user'").n,
      },
      paymentProofs: all(
        `SELECT p.*, u.name AS user_name, u.code AS user_code FROM payment_proofs p JOIN users u ON u.id = p.user_id
         ORDER BY (p.status = 'pending') DESC, p.id DESC LIMIT 50`,
      ),
      handoffs: all("SELECT * FROM handoffs ORDER BY (status = 'open') DESC, id DESC LIMIT 50"),
      leads: all('SELECT * FROM leads ORDER BY id DESC LIMIT 50'),
      excuses: all(
        'SELECT e.*, u.name AS user_name, u.code AS user_code FROM excuses e JOIN users u ON u.id = e.user_id ORDER BY e.id DESC LIMIT 50',
      ),
      users: all('SELECT id, name, email, code, program, is_demo, created_at FROM users ORDER BY id DESC LIMIT 50'),
    });
  });

  app.get('/api/admin/conversations/:id', requireAdmin, (req, res) => {
    const conv = one('SELECT id, title, owner, created_at FROM conversations WHERE id = ?', req.params.id);
    if (!conv) return res.status(404).json({ error: 'not_found' });
    const messages = all('SELECT id, role, content, meta, created_at FROM messages WHERE conversation_id = ? ORDER BY id', conv.id).map(
      toClientMessage,
    );
    res.json({ conversation: conv, messages });
  });

  app.post('/api/admin/handoffs/:id', requireAdmin, (req, res) => {
    const status = req.body?.status === 'closed' ? 'closed' : 'open';
    db.prepare('UPDATE handoffs SET status = ? WHERE id = ?').run(status, req.params.id);
    res.json({ ok: true });
  });

  // Approving a receipt marks that month as paid in the student's profile.
  app.post('/api/admin/payment-proofs/:id', requireAdmin, (req, res) => {
    const status = ['approved', 'rejected'].includes(req.body?.status) ? req.body.status : null;
    if (!status) return res.status(400).json({ error: 'invalid_status' });
    const proof = one('SELECT * FROM payment_proofs WHERE id = ?', req.params.id);
    if (!proof) return res.status(404).json({ error: 'not_found' });
    db.prepare("UPDATE payment_proofs SET status = ?, reviewed_at = datetime('now') WHERE id = ?").run(status, proof.id);

    if (status === 'approved' && proof.month) {
      const user = one('SELECT profile FROM users WHERE id = ?', proof.user_id);
      const profile = JSON.parse(user.profile);
      const entry = profile.payments.find((p) => p.month === proof.month);
      const paid = { month: proof.month, status: 'paid', paidOn: proof.paid_date || todayYerevan() };
      if (entry) Object.assign(entry, paid, { dueDate: undefined });
      else profile.payments.push(paid);
      profile.payments.sort((a, b) => a.month.localeCompare(b.month));
      db.prepare('UPDATE users SET profile = ? WHERE id = ?').run(JSON.stringify(profile), proof.user_id);
    }
    res.json({ ok: true });
  });

  // Inbox assistant: draft a reply to a student's email from the knowledge base.
  app.post('/api/admin/email-draft', requireAdmin, rateLimit(20), async (req, res) => {
    const email = str(req.body?.email, 6000);
    if (email.length < 10) return res.status(400).json({ error: 'email_required' });
    try {
      const raw = await chatCompletion(
        [
          { role: 'system', content: buildEmailPrompt({ kb, today: todayYerevan() }) },
          { role: 'user', content: email },
        ],
        { maxTokens: 3000 },
      );
      const d = parseJsonLoose(raw);
      if (!d || typeof d.reply !== 'string') return res.json({ lang: null, subject: '', reply: raw.trim(), sources: [], missing: [] });
      const ids = new Set(kb.map((x) => x.id));
      res.json({
        lang: LANGS.includes(d.lang) ? d.lang : null,
        subject: typeof d.subject === 'string' ? d.subject : '',
        reply: d.reply.trim(),
        sources: Array.isArray(d.sources) ? d.sources.filter((s) => ids.has(s)) : [],
        missing: Array.isArray(d.missing) ? d.missing.filter((s) => typeof s === 'string').slice(0, 10) : [],
      });
    } catch (err) {
      console.error('[email-draft]', err.message);
      res.status(502).json({ error: 'llm_unavailable' });
    }
  });
}
