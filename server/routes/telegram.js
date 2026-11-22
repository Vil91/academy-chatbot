import crypto from 'node:crypto';
import { chatCompletion } from '../llm.js';
import { buildSystemPrompt, detectLang, parseMeta, splitMeta } from '../prompt.js';
import { todayYerevan } from '../profile.js';

const TG_API = (token, method) => `https://api.telegram.org/bot${token}/${method}`;

async function tgCall(token, method, body) {
  const res = await fetch(TG_API(token, method), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  return res.json().catch(() => null);
}

const WELCOME =
  '👋 Barev! Привет! Hello!\n\n' +
  'Я **Academy Concierge** — официальный AI-ассистент Picsart Academy.\n' +
  'Отвечаю на армянском (и транслитом), русском и английском строго по утверждённым материалам академии: курсы, цены, расписание, библиотека, Fellowship Program и правила кампуса.\n\n' +
  'Просто напишите свой вопрос!';

export function registerTelegram(app, { db, kb }) {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const secret = (process.env.TELEGRAM_WEBHOOK_SECRET || (token ? crypto.createHash('sha256').update(token).digest('hex').slice(0, 24) : '')).trim();
  const allowedSources = new Set([...kb.map((d) => d.id), 'student_profile']);

  app.post('/api/telegram/webhook', async (req, res) => {
    if (!token) return res.status(503).json({ error: 'telegram_not_configured' });
    const headerSecret = req.get('x-telegram-bot-api-secret-token') || '';
    if (secret && headerSecret !== secret) return res.status(401).json({ error: 'unauthorized' });

    // Acknowledge immediately so Telegram never retries slow LLM turns.
    res.json({ ok: true });

    const msg = req.body?.message;
    const chatId = msg?.chat?.id;
    const text = typeof msg?.text === 'string' ? msg.text.trim().slice(0, 1000) : '';
    if (!chatId || !text) return;

    try {
      if (text === '/start' || text === '/help') {
        await tgCall(token, 'sendMessage', { chat_id: chatId, text: WELCOME.replace(/\*\*/g, '') });
        return;
      }

      await tgCall(token, 'sendChatAction', { chat_id: chatId, action: 'typing' });

      const owner = `tg:${chatId}`;
      let conv = db.prepare('SELECT * FROM conversations WHERE owner = ? ORDER BY updated_at DESC LIMIT 1').get(owner);
      if (!conv) {
        const id = crypto.randomUUID();
        const who = [msg.from?.first_name, msg.from?.username ? `@${msg.from.username}` : ''].filter(Boolean).join(' ') || `Telegram ${chatId}`;
        db.prepare('INSERT INTO conversations (id, owner, title) VALUES (?, ?, ?)').run(id, owner, `TG · ${who}`.slice(0, 60));
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
      meta.channel = 'telegram';

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
          `[Telegram] ${text}`,
          answer,
          meta.lang,
        );
      }

      const replyText = (answer || 'Извините, не удалось сформировать ответ.').replace(/\*\*(.+?)\*\*/g, '$1');
      await tgCall(token, 'sendMessage', { chat_id: chatId, text: replyText });
    } catch (err) {
      console.error('[telegram] error:', err.message);
      await tgCall(token, 'sendMessage', {
        chat_id: chatId,
        text: 'Временная ошибка сервиса. Попробуйте ещё раз через несколько секунд.',
      }).catch(() => {});
    }
  });

  // Auto-register webhook on Render (when RENDER_EXTERNAL_URL or PUBLIC_URL is provided).
  const publicUrl = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/+$/, '');
  if (token && publicUrl) {
    tgCall(token, 'setWebhook', {
      url: `${publicUrl}/api/telegram/webhook`,
      secret_token: secret,
      allowed_updates: ['message'],
    })
      .then((r) => console.log('[telegram] webhook:', r?.ok ? 'active' : r?.description || 'failed'))
      .catch((err) => console.warn('[telegram] webhook setup skipped:', err.message));
  }
}
