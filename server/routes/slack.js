import crypto from 'node:crypto';
import { chatCompletion } from '../llm.js';
import { buildSystemPrompt, detectLang, parseMeta, splitMeta } from '../prompt.js';
import { todayYerevan } from '../profile.js';

function verifySlackSignature(req, signingSecret) {
  const ts = req.get('x-slack-request-timestamp');
  const sig = req.get('x-slack-signature') || '';
  if (!ts || !sig || !req.rawBody) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const base = `v0:${ts}:${req.rawBody}`;
  const expected = `v0=${crypto.createHmac('sha256', signingSecret).update(base).digest('hex')}`;
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function slackPost(token, body) {
  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  return res.json().catch(() => null);
}

export function registerSlack(app, { db, kb }) {
  const token = (process.env.SLACK_BOT_TOKEN || '').trim();
  const signingSecret = (process.env.SLACK_SIGNING_SECRET || '').trim();
  const allowedSources = new Set([...kb.map((d) => d.id), 'student_profile']);

  app.post('/api/slack/events', async (req, res) => {
    if (!token || !signingSecret) return res.status(503).json({ error: 'slack_not_configured' });
    if (!verifySlackSignature(req, signingSecret)) return res.status(401).json({ error: 'invalid_signature' });

    if (req.body?.type === 'url_verification') {
      return res.json({ challenge: req.body.challenge });
    }

    // Acknowledge immediately (Slack requires <3s response).
    res.status(200).end();

    const ev = req.body?.event;
    if (!ev || ev.bot_id || ev.subtype) return;
    if (ev.type !== 'app_mention' && !(ev.type === 'message' && ev.channel_type === 'im')) return;

    const text = String(ev.text || '')
      .replace(/<@[A-Z0-9]+>/g, '')
      .trim()
      .slice(0, 1000);
    if (!text || !ev.channel) return;

    const threadTs = ev.thread_ts || ev.ts;
    const owner = `sl:${ev.channel}:${threadTs}`;

    try {
      let conv = db.prepare('SELECT * FROM conversations WHERE owner = ? ORDER BY updated_at DESC LIMIT 1').get(owner);
      if (!conv) {
        const id = crypto.randomUUID();
        db.prepare('INSERT INTO conversations (id, owner, title) VALUES (?, ?, ?)').run(id, owner, `Slack · ${text.slice(0, 50)}`);
        conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
      }

      const past = db
        .prepare('SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 10')
        .all(conv.id)
        .reverse();
      db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)').run(conv.id, 'user', text);

      const langHint = detectLang(text, 'hy');
      const full = await chatCompletion([
        { role: 'system', content: buildSystemPrompt({ kb, profile: null, uiLang: langHint, langHint, today: todayYerevan() }) },
        ...past.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: text },
      ]);

      const { answer, metaRaw } = splitMeta(full);
      const meta = parseMeta(metaRaw, { fallbackLang: langHint, allowedSources, signedIn: false });
      meta.channel = 'slack';

      db.prepare('INSERT INTO messages (conversation_id, role, content, meta) VALUES (?, ?, ?, ?)').run(
        conv.id,
        'assistant',
        answer || '…',
        JSON.stringify(meta),
      );
      db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(conv.id);

      if (meta.handoff) {
        db.prepare('INSERT INTO handoffs (conversation_id, owner, question, answer, lang) VALUES (?, ?, ?, ?, ?)').run(
          conv.id,
          owner,
          `[Slack] ${text}`,
          answer,
          meta.lang,
        );
      }

      const slackText = (answer || 'Sorry, could not generate a reply.').replace(/\*\*(.+?)\*\*/g, '*$1*');
      await slackPost(token, { channel: ev.channel, thread_ts: threadTs, text: slackText });
    } catch (err) {
      console.error('[slack] error:', err.message);
    }
  });
}
