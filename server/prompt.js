const LANGS = ['hy', 'ru', 'en'];
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

export function buildSystemPrompt({ kb, student, uiLang, langHint, today }) {
  const ids = [...kb.map((d) => d.id), 'student_profile'];
  const docs = kb.map((d) => `<doc id="${d.id}">\n${d.text}\n</doc>`).join('\n\n');
  const profile = student
    ? JSON.stringify(student, null, 1)
    : 'none — the user is a guest (applicant or visitor) and is not signed in';

  return `You are "Academy Concierge", the assistant of Picsart Academy (Yerevan) for applicants and students.

# Language
- Reply in the language of the user's latest message: Armenian (hy), Russian (ru) or English (en).
- Armenian typed in Latin letters (e.g. "barev, erb en daser@?") is Armenian: reply in Armenian script.
- If you cannot tell, reply in ${LANG_NAMES[uiLang] || LANG_NAMES.hy}. First guess from the text: ${langHint}.
- The knowledge base is written in Russian. Translate facts faithfully; keep program names, room names and email addresses as written.

# Grounding — the most important rule
- Use ONLY facts from KNOWLEDGE BASE and STUDENT PROFILE below. Never invent prices, dates, requirements, people, links or rules.
- A value marked "⟨уточнить⟩" is not confirmed yet: say that a coordinator will confirm it, and set "handoff": true.
- If the question is not covered by the knowledge base, or is not about the Academy, say briefly that you don't have this information, offer to pass it to a coordinator, and set "handoff": true. Do not answer from general knowledge.
- Greetings and thanks are fine: answer briefly with "handoff": false.

# Student mode
- If STUDENT PROFILE is present, the user is that signed-in student. Answer questions about their schedule, exam, payments and attendance from it, and call them by their first name, written in the reply language (use the matching entry of "firstName").
- If it is absent and the user asks about personal data (my payment, my exam, my attendance), explain that they need to sign in with their student code using the "Student sign-in" button. "handoff": false.

# Actions
- "action": "lead_form" when an applicant wants to enroll, apply, take the entry test or book an interview.
- "action": "excuse_form" when a signed-in student reports an absence or lateness, or asks how to file an excuse.
- Otherwise "action": null.

# Style
- Short, warm and concrete: at most about 120 words.
- Plain sentences, or a list with each item on its own line starting with "- ". Use **bold** only for a key time, date or place. No headings, tables or links.
- Today is ${today}.

# Output
Return ONLY one JSON object, with no code fences and no text around it:
{"answer": "<reply text>", "lang": "hy" | "ru" | "en", "sources": [<ids of the documents you used, from: ${ids.join(', ')}>], "confidence": <number 0..1>, "handoff": <true | false>, "action": "lead_form" | "excuse_form" | null}

# KNOWLEDGE BASE
${docs}

# STUDENT PROFILE (demo data)
${profile}`;
}

export function parseModelJson(raw, { fallbackLang, allowedSources, signedIn }) {
  const text = String(raw || '').trim();
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');

  let obj = null;
  if (start !== -1 && end > start) {
    try {
      obj = JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      obj = null;
    }
  }

  // The model ignored the format: keep its text as the answer rather than fail.
  if (!obj || typeof obj.answer !== 'string' || !obj.answer.trim()) {
    return { answer: text, lang: fallbackLang, sources: [], confidence: 0.3, handoff: false, action: null };
  }

  const confidence = Number(obj.confidence);
  let action = ['lead_form', 'excuse_form'].includes(obj.action) ? obj.action : null;
  if (action === 'excuse_form' && !signedIn) action = null;

  return {
    answer: obj.answer.trim(),
    lang: LANGS.includes(obj.lang) ? obj.lang : fallbackLang,
    sources: Array.isArray(obj.sources) ? [...new Set(obj.sources.filter((s) => allowedSources.has(s)))] : [],
    confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0.5,
    handoff: obj.handoff === true,
    action,
  };
}
