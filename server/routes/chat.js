import crypto from 'node:crypto';
import express from 'express';
import { chatCompletion, chatStream } from '../llm.js';
import {
  META_MARK,
  buildReceiptPrompt,
  buildSystemPrompt,
  detectLang,
  normalizePayment,
  parseJsonLoose,
  parseMeta,
  splitMeta,
} from '../prompt.js';
import { monthKey, todayYerevan } from '../profile.js';
import { normLang, publicUser, rateLimit, str, toClientMessage } from '../util.js';

const FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const dataUrl = (a) => `data:${a.mime};base64,${Buffer.from(a.data).toString('base64')}`;

// The current message goes to the model with its images; earlier ones carry only a note.
function userContent(text, attachments) {
  const body = text || '(The user sent an attachment without a message.)';
  if (!attachments.length) return body;
  const parts = [{ type: 'text', text: body }];
  for (const a of attachments) {
    if (a.mime.startsWith('image/')) parts.push({ type: 'image_url', image_url: { url: dataUrl(a) } });
    else parts.push({ type: 'text', text: `[Attached file: ${a.name} (${a.mime}) — you cannot read its contents]` });
  }
  return parts;
}

function withAttachmentNote(content, metaJson) {
  const names = metaJson ? JSON.parse(metaJson)?.attachments?.map((a) => a.name) : null;
  return names?.length ? `${content}\n[Attached: ${names.join(', ')}]` : content;
}

export function registerChat(app, { db, kb, adminKey }) {
  const allowedSources = new Set([...kb.map((d) => d.id), 'student_profile']);

  const requireOwner = (req, res, next) => (req.owner ? next() : res.status(400).json({ error: 'device_id_required' }));
  const requireUser = (req, res, next) => (req.user ? next() : res.status(401).json({ error: 'sign_in_required' }));
  const getConversation = (id, owner) => db.prepare('SELECT * FROM conversations WHERE id = ? AND owner = ?').get(id, owner);

  // ---- conversations --------------------------------------------------

  app.get('/api/conversations', requireOwner, (req, res) => {
    const rows = db
      .prepare(
        `SELECT c.id, c.title, c.updated_at,
           (SELECT content FROM messages m WHERE m.conversation_id = c.id AND m.role = 'assistant' ORDER BY m.id DESC LIMIT 1) AS last
         FROM conversations c WHERE c.owner = ? ORDER BY c.updated_at DESC LIMIT 100`,
      )
      .all(req.owner);
    res.json({
      conversations: rows.map((r) => ({ id: r.id, title: r.title, updatedAt: r.updated_at, preview: (r.last || '').slice(0, 100) })),
    });
  });

  app.get('/api/conversations/:id', requireOwner, (req, res) => {
    const conv = getConversation(req.params.id, req.owner);
    if (!conv) return res.status(404).json({ error: 'not_found' });
    const messages = db
      .prepare('SELECT id, role, content, meta, created_at FROM messages WHERE conversation_id = ? ORDER BY id')
      .all(conv.id)
      .map(toClientMessage);
    res.json({ conversation: { id: conv.id, title: conv.title }, messages });
  });

  app.delete('/api/conversations/:id', requireOwner, (req, res) => {
    const info = db.prepare('DELETE FROM conversations WHERE id = ? AND owner = ?').run(req.params.id, req.owner);
    res.json({ ok: info.changes > 0 });
  });

  // ---- attachments ----------------------------------------------------

  app.post(
    '/api/attachments',
    requireOwner,
    rateLimit(30),
    express.raw({ type: FILE_TYPES, limit: '6mb' }),
    (req, res) => {
      const mime = (req.get('content-type') || '').split(';')[0].trim();
      if (!FILE_TYPES.includes(mime) || !Buffer.isBuffer(req.body) || !req.body.length) {
        return res.status(400).json({ error: 'unsupported_file' });
      }
      let name = 'file';
      try {
        name = decodeURIComponent(req.get('x-file-name') || 'file');
      } catch {
        /* keep default */
      }
      name = name.replace(/[\r\n"\\/]/g, '').slice(0, 120) || 'file';
      const id = crypto.randomUUID();
      db.prepare('INSERT INTO attachments (id, owner, name, mime, size, data) VALUES (?, ?, ?, ?, ?, ?)').run(
        id,
        req.owner,
        name,
        mime,
        req.body.length,
        req.body,
      );
      res.status(201).json({ id, name, mime, size: req.body.length });
    },
  );

  app.get('/api/attachments/:id', (req, res) => {
    const a = db.prepare('SELECT * FROM attachments WHERE id = ?').get(req.params.id);
    const isAdmin = adminKey && req.get('x-admin-key') === adminKey;
    if (!a || (!isAdmin && a.owner !== req.owner)) return res.status(404).end();
    res.set('Content-Type', a.mime);
    res.set('Cache-Control', 'private, max-age=86400');
    res.set('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(a.name)}`);
    res.send(Buffer.from(a.data));
  });

  // ---- chat (streamed) ------------------------------------------------

  app.post('/api/chat', requireOwner, rateLimit(20), async (req, res) => {
    const text = str(req.body?.message, 1001);
    if (text.length > 1000) return res.status(400).json({ error: 'message_too_long' });
    const ids = Array.isArray(req.body?.attachmentIds) ? req.body.attachmentIds.filter((x) => typeof x === 'string').slice(0, 4) : [];
    const attachments = ids
      .map((id) => db.prepare('SELECT id, name, mime, size, data FROM attachments WHERE id = ? AND owner = ?').get(id, req.owner))
      .filter(Boolean);
    if (!text && !attachments.length) return res.status(400).json({ error: 'message_required' });

    let conv = null;
    if (req.body?.conversationId) {
      conv = getConversation(String(req.body.conversationId), req.owner);
      if (!conv) return res.status(404).json({ error: 'conversation_not_found' });
    }
    const isNew = !conv;
    if (isNew) {
      const id = crypto.randomUUID();
      const title = (text || attachments[0].name).replace(/\s+/g, ' ').slice(0, 60);
      db.prepare('INSERT INTO conversations (id, owner, title) VALUES (?, ?, ?)').run(id, req.owner, title);
      conv = getConversation(id, req.owner);
    }

    const past = db
      .prepare('SELECT role, content, meta FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 12')
      .all(conv.id)
      .reverse();
    const userMeta = attachments.length ? { attachments: attachments.map(({ id, name, mime }) => ({ id, name, mime })) } : null;
    const userRow = db
      .prepare('INSERT INTO messages (conversation_id, role, content, meta) VALUES (?, ?, ?, ?)')
      .run(conv.id, 'user', text, userMeta ? JSON.stringify(userMeta) : null);

    const uiLang = normLang(req.body?.uiLang);
    const langHint = detectLang(text, uiLang);
    const profile = req.user ? JSON.parse(req.user.profile) : null;
    const llmMessages = [
      { role: 'system', content: buildSystemPrompt({ kb, profile, uiLang, langHint, today: todayYerevan() }) },
      ...past.map((m) => ({ role: m.role, content: m.role === 'user' ? withAttachmentNote(m.content, m.meta) : m.content })),
      { role: 'user', content: userContent(text, attachments) },
    ];

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    send('start', {
      conversation: { id: conv.id, title: conv.title, isNew },
      userMessage: { id: Number(userRow.lastInsertRowid), role: 'user', content: text, meta: userMeta },
    });
    const ping = setInterval(() => res.write(': ping\n\n'), 10_000);

    let full = '';
    let sent = 0;
    let holdBack = null; // true when the model starts with JSON: show nothing until it is parsed
    try {
      try {
        for await (const delta of chatStream(llmMessages)) {
          full += delta;
          if (holdBack === null && full.trim()) holdBack = /^\s*(\{|```)/.test(full);
          if (holdBack) continue;
          const mark = full.indexOf(META_MARK);
          const visible = mark !== -1 ? mark : Math.max(sent, full.length - META_MARK.length);
          if (visible > sent) {
            send('delta', { t: full.slice(sent, visible) });
            sent = visible;
          }
        }
      } catch (err) {
        if (full) throw err;
        console.warn('[chat] stream failed, retrying without streaming:', err.message);
        full = await chatCompletion(llmMessages);
      }
      if (!full.trim()) throw new Error('empty answer');

      const { answer, metaRaw } = splitMeta(full);
      const meta = parseMeta(metaRaw, { fallbackLang: langHint, allowedSources, signedIn: Boolean(req.user) });

      // A readable receipt from a signed-in student becomes a payment to confirm.
      const image = attachments.find((a) => a.mime.startsWith('image/'));
      if (meta.payment && image && req.user) {
        const p = meta.payment;
        const info = db
          .prepare(
            'INSERT INTO payment_proofs (user_id, attachment_id, conversation_id, month, amount, currency, paid_date, payer, reference) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          )
          .run(req.user.id, image.id, conv.id, p.month || monthKey(todayYerevan()), p.amount, p.currency, p.date, p.payer, p.reference);
        meta.paymentProofId = Number(info.lastInsertRowid);
      }

      const row = db
        .prepare('INSERT INTO messages (conversation_id, role, content, meta) VALUES (?, ?, ?, ?)')
        .run(conv.id, 'assistant', answer || '…', JSON.stringify(meta));
      db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(conv.id);

      if (meta.handoff) {
        db.prepare('INSERT INTO handoffs (conversation_id, owner, question, answer, lang) VALUES (?, ?, ?, ?, ?)').run(
          conv.id,
          req.owner,
          text || `[${attachments.map((a) => a.name).join(', ')}]`,
          answer,
          meta.lang,
        );
      }

      send('done', {
        message: { id: Number(row.lastInsertRowid), role: 'assistant', content: answer || '…', meta },
        conversation: { id: conv.id, title: conv.title },
      });
    } catch (err) {
      console.error('[chat] LLM error:', err.message);
      db.prepare('DELETE FROM messages WHERE id = ?').run(userRow.lastInsertRowid);
      if (isNew) db.prepare('DELETE FROM conversations WHERE id = ?').run(conv.id);
      send('error', { error: 'llm_unavailable', conversationRemoved: isNew });
    } finally {
      clearInterval(ping);
      res.end();
    }
  });

  // ---- forms ----------------------------------------------------------

  app.post('/api/lead', rateLimit(10), (req, res) => {
    const name = str(req.body?.name, 120);
    const contact = str(req.body?.contact, 120);
    if (name.length < 2 || contact.length < 3) return res.status(400).json({ error: 'name_and_contact_required' });
    const info = db
      .prepare('INSERT INTO leads (conversation_id, name, contact, interest, preferred_time, lang) VALUES (?, ?, ?, ?, ?, ?)')
      .run(str(req.body?.conversationId, 64) || null, name, contact, str(req.body?.interest, 80), str(req.body?.preferredTime, 80), normLang(req.body?.lang));
    res.status(201).json({ ok: true, id: Number(info.lastInsertRowid) });
  });

  app.post('/api/excuse', requireUser, rateLimit(10), (req, res) => {
    const date = str(req.body?.date, 10);
    const reason = str(req.body?.reason, 500);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || reason.length < 3) return res.status(400).json({ error: 'date_and_reason_required' });
    const info = db.prepare('INSERT INTO excuses (user_id, date, reason) VALUES (?, ?, ?)').run(req.user.id, date, reason);
    res.status(201).json({ ok: true, id: Number(info.lastInsertRowid) });
  });

  // ---- personal cabinet -----------------------------------------------

  app.get('/api/me/cabinet', requireUser, (req, res) => {
    const uid = req.user.id;
    res.json({
      user: publicUser(req.user),
      excuses: db.prepare('SELECT id, date, reason, status, created_at FROM excuses WHERE user_id = ? ORDER BY id DESC').all(uid),
      paymentProofs: db
        .prepare(
          'SELECT id, attachment_id, month, amount, currency, paid_date, reference, status, created_at FROM payment_proofs WHERE user_id = ? ORDER BY id DESC',
        )
        .all(uid),
      chats: db.prepare('SELECT COUNT(*) AS n FROM conversations WHERE owner = ?').get(`u:${uid}`).n,
    });
  });

  // Upload a receipt from the cabinet: the model reads it, a coordinator confirms it.
  app.post('/api/payments/proof', requireUser, rateLimit(10), async (req, res) => {
    const a = db
      .prepare('SELECT id, name, mime, data FROM attachments WHERE id = ? AND owner = ?')
      .get(str(req.body?.attachmentId, 64), `u:${req.user.id}`);
    if (!a || !a.mime.startsWith('image/')) return res.status(400).json({ error: 'image_required' });
    const month = /^\d{4}-\d{2}$/.test(req.body?.month || '') ? req.body.month : monthKey(todayYerevan());

    let read = null;
    try {
      read = parseJsonLoose(
        await chatCompletion(
          [
            { role: 'system', content: buildReceiptPrompt() },
            { role: 'user', content: [{ type: 'text', text: 'Read this receipt.' }, { type: 'image_url', image_url: { url: dataUrl(a) } }] },
          ],
          { maxTokens: 1024 },
        ),
      );
    } catch (err) {
      console.warn('[receipt] could not read:', err.message); // a coordinator will still see the image
    }
    const p = normalizePayment(read) || {};
    const info = db
      .prepare(
        'INSERT INTO payment_proofs (user_id, attachment_id, month, amount, currency, paid_date, payer, reference) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(req.user.id, a.id, month, p.amount ?? null, p.currency ?? null, p.date ?? null, p.payer ?? null, p.reference ?? null);
    res.status(201).json({
      proof: db.prepare('SELECT * FROM payment_proofs WHERE id = ?').get(info.lastInsertRowid),
      isReceipt: read ? read.isReceipt !== false : null,
    });
  });
}
