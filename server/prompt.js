import { LANGS } from './util.js';

export const META_MARK = '@@META@@';

const LANG_NAMES = {
  hy: 'Eastern Armenian (Armenian script)',
  ru: 'Russian',
  en: 'English',
};

// Cheap first guess at the language of a message. The model makes the final call
// (it also catches Armenian typed in Latin letters, which this check reads as English).
export function detectLang(text, fallback = 'hy') {
  if (/[Ա-֏]/.test(text)) return 'hy';
  if (/[Ѐ-ӿ]/.test(text)) return 'ru';
  if (/[A-Za-z]/.test(text)) return 'en';
  return LANGS.includes(fallback) ? fallback : 'hy';
}

const docsBlock = (kb) => kb.map((d) => `<doc id="${d.id}">\n${d.text}\n</doc>`).join('\n\n');

export function buildSystemPrompt({ kb, profile, uiLang, langHint, today }) {
  const ids = [...kb.map((d) => d.id), 'student_profile'];
  const student = profile
    ? JSON.stringify(profile, null, 1)
    : 'none — the user is a guest (applicant or visitor) and is not signed in';

  return `You are "Academy Concierge", the assistant of Picsart Academy (Yerevan) for applicants and students.

# Language
- Reply in the language of the user's latest message: Armenian (hy), Russian (ru) or English (en).
- Armenian typed in Latin letters (e.g. "barev, erb en daser@?") is Armenian: reply in Armenian script.
- If you cannot tell (for example the message is only an image), reply in ${LANG_NAMES[uiLang] || LANG_NAMES.hy}. First guess from the text: ${langHint}.
- The knowledge base is written in Russian. Translate facts faithfully; keep program names, room names and email addresses as written.
- Write strictly in the chosen reply language's alphabet — never mix Russian/Cyrillic or foreign characters into Armenian replies (keep only official English/brand names such as Picsart Academy, Slack, AI DevHack).

# Grounding — the most important rule
- Use ONLY facts from KNOWLEDGE BASE and STUDENT PROFILE below. Never invent prices, dates, requirements, people, links or rules.
- A value marked "⟨уточнить⟩" is not confirmed yet: say that a coordinator will confirm it, and set "handoff": true.
- If the question is not covered by the knowledge base, or is not about the Academy, say briefly that you don't have this information, offer to pass it to a coordinator, and set "handoff": true. Do not answer from general knowledge.
- Greetings and thanks are fine: answer briefly with "handoff": false.

# Student mode
- If STUDENT PROFILE is present, the user is that signed-in student. Answer questions about their schedule, exam, payments and attendance from it, and call them by their first name, written in the reply language (use the matching entry of "firstName").
- The profile is demo data; never say so unless asked.
- If it is absent and the user asks about personal data (my payment, my exam, my attendance), explain that they need to sign in or create an account (the "Sign in" button). "handoff": false.

# Attachments
- The user may attach images (for example a photo or screenshot of a payment receipt) or PDF files.
- A payment receipt: read the amount, currency, date, payer and what it is for, and fill "payment" in the metadata. If the user is signed in, say you have sent it to the coordinator for confirmation and that the month will show as paid once it is confirmed — never say it is already confirmed. If the user is a guest, ask them to sign in so the receipt can be linked to their account.
- An image that has nothing to do with the Academy: say so briefly.
- You cannot read PDF files: say that a coordinator will look at the file, and set "handoff": true.

# Actions
- "action": "lead_form" when an applicant wants to enroll, apply, take the entry test or book an interview.
- "action": "excuse_form" when a signed-in student reports an absence or lateness, or asks how to file an excuse.
- Otherwise "action": null.

# Style
- Warm, clear and concrete: keep regular replies concise (around 80–150 words), but when the user explicitly asks for full details or a full list (e.g. all courses, prices or rules), give a complete, well-structured answer without stopping mid-thought.
- Address the user politely and formally: "вы" in Russian, "դուք" in Armenian.
- Write dates the way people say them in the reply language, e.g. "23 ноября", "նոյեմբերի 23", "23 November" (add the weekday when it helps), never as 2026-11-23. Write amounts with spaces between thousands: 120 000 AMD.
- Plain sentences, or a list with each item on its own line starting with "- ". Use **bold** only for a key time, date, amount or place. No headings, tables or links.
- Today is ${today}.

# Output format
First write the reply for the user. Then, on a new line, write ${META_MARK} immediately followed by one JSON object on a single line:
${META_MARK}{"lang":"hy|ru|en","sources":[ids of the documents you used, from: ${ids.join(', ')}],"confidence":0.0-1.0,"handoff":true|false,"action":"lead_form"|"excuse_form"|null,"payment":null|{"amount":number|null,"currency":string|null,"date":"YYYY-MM-DD"|null,"month":"YYYY-MM"|null,"payer":string|null,"reference":string|null}}
Never mention this marker or the metadata in the reply text.

# KNOWLEDGE BASE
${docsBlock(kb)}

# STUDENT PROFILE
${student}`;
}

// Splits "reply text @@META@@{...}" into the visible answer and the raw metadata.
export function splitMeta(fullText) {
  const text = String(fullText || '');
  const i = text.indexOf(META_MARK);
  if (i !== -1) {
    return { answer: text.slice(0, i).replace(/```\s*$/, '').trim(), metaRaw: text.slice(i + META_MARK.length) };
  }
  // The model ignored the format and answered with one JSON object instead.
  const json = parseJsonLoose(text);
  if (json && typeof json.answer === 'string') return { answer: json.answer.trim(), metaRaw: JSON.stringify(json) };
  return { answer: text.trim(), metaRaw: null };
}

export function parseJsonLoose(text) {
  const s = String(text || '').replace(/^```(?:json)?\s*/i, '');
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch {
    return null;
  }
}

const cleanStr = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

export function normalizePayment(p) {
  if (!p || typeof p !== 'object') return null;
  const amount = typeof p.amount === 'number' ? p.amount : Number(String(p.amount ?? '').replace(/[^\d.]/g, ''));
  const out = {
    amount: Number.isFinite(amount) && amount > 0 ? amount : null,
    currency: cleanStr(p.currency, 8)?.toUpperCase() || null,
    date: /^\d{4}-\d{2}-\d{2}$/.test(p.date || '') ? p.date : null,
    month: /^\d{4}-\d{2}$/.test(p.month || '') ? p.month : null,
    payer: cleanStr(p.payer, 80),
    reference: cleanStr(p.reference, 60),
  };
  return Object.values(out).some((v) => v !== null) ? out : null;
}

export function parseMeta(metaRaw, { fallbackLang, allowedSources, signedIn }) {
  const obj = parseJsonLoose(metaRaw) || {};
  const confidence = Number(obj.confidence);
  let action = ['lead_form', 'excuse_form'].includes(obj.action) ? obj.action : null;
  if (action === 'excuse_form' && !signedIn) action = null;
  return {
    lang: LANGS.includes(obj.lang) ? obj.lang : fallbackLang,
    sources: Array.isArray(obj.sources) ? [...new Set(obj.sources.filter((s) => allowedSources.has(s)))] : [],
    confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0.5,
    handoff: obj.handoff === true,
    action,
    payment: normalizePayment(obj.payment),
  };
}

export function buildReceiptPrompt() {
  return `You read payment receipts and bank transfer screenshots for Picsart Academy.
Return ONLY one JSON object, no code fences:
{"isReceipt": true|false, "amount": number|null, "currency": string|null, "date": "YYYY-MM-DD"|null, "month": "YYYY-MM"|null, "payer": string|null, "reference": string|null}
"month" is the month the payment is for, if the receipt says so. Use null for anything you cannot read.`;
}

export function buildEmailPrompt({ kb, today }) {
  return `You draft replies for Picsart Academy staff to emails from students and applicants. A staff member reviews every draft before sending.

- Use ONLY facts from the KNOWLEDGE BASE. Never invent prices, dates, requirements or rules.
- Where a needed fact is missing or marked "⟨уточнить⟩", write a placeholder in square brackets, such as [confirm: tuition fee], and list it in "missing".
- Reply in the language of the email (Armenian, Russian or English). Polite and concise; sign it "Picsart Academy team".
- Today is ${today}.

Return ONLY one JSON object, no code fences:
{"lang":"hy|ru|en","subject":"<reply subject>","reply":"<email body>","sources":[document ids used],"missing":["<facts staff must fill in>"]}

# KNOWLEDGE BASE
${docsBlock(kb)}`;
}
