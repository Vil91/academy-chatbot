// OpenAI-compatible chat client.
// Locally it talks to OmniRoute (http://127.0.0.1:20128/v1, no key needed from this machine).
// On the hosting it talks to Gemini's OpenAI-compatible endpoint with an API key:
//   LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
//   LLM_API_KEY=<Google AI Studio key>
//   CHAT_MODEL=gemini-flash-latest

export function llmConfig() {
  return {
    baseUrl: (process.env.LLM_BASE_URL || 'http://127.0.0.1:20128/v1').replace(/\/+$/, ''),
    apiKey: process.env.LLM_API_KEY || '',
    model: process.env.CHAT_MODEL || 'antigravity/gemini-3.8-flash-high',
    fallbackModel: (process.env.CHAT_FALLBACK_MODEL || '').trim(),
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS || 90000),
  };
}

const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function candidateModels() {
  const { model, fallbackModel } = llmConfig();
  return fallbackModel && fallbackModel !== model ? [model, fallbackModel] : [model];
}

function request(messages, { maxTokens, stream, model }) {
  const { baseUrl, apiKey, timeoutMs } = llmConfig();
  const body = { model, messages, max_tokens: maxTokens, stream };
  if (process.env.REASONING_EFFORT) body.reasoning_effort = process.env.REASONING_EFFORT;
  return fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

async function fetchWithFallback(messages, { maxTokens, stream }) {
  const models = candidateModels();
  let lastErr = null;
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await request(messages, { maxTokens, stream, model });
        if (res.ok) return res;
        const snippet = (await res.text()).slice(0, 300);
        lastErr = new Error(`LLM HTTP ${res.status} (${model}): ${snippet}`);
        if (!RETRY_STATUSES.has(res.status)) throw lastErr;
      } catch (err) {
        if (err === lastErr) throw err;
        lastErr = new Error(`LLM ${model}: ${err.message}`);
      }
      if (attempt === 0) await sleep(800);
    }
    if (i < models.length - 1) console.warn(`[llm] falling back from ${model} to ${models[i + 1]}: ${lastErr.message}`);
  }
  throw lastErr;
}

const partText = (content) =>
  Array.isArray(content)
    ? content.map((part) => (typeof part === 'string' ? part : part?.text || '')).join('')
    : content || '';

export async function chatCompletion(messages, { maxTokens = 8192 } = {}) {
  const res = await fetchWithFallback(messages, { maxTokens, stream: false });
  const data = await res.json();
  const text = partText(data?.choices?.[0]?.message?.content);
  if (!text.trim()) throw new Error('LLM returned an empty answer');
  return text;
}

// Yields text as it is generated (server-sent events, OpenAI chunk format).
export async function* chatStream(messages, { maxTokens = 8192 } = {}) {
  const res = await fetchWithFallback(messages, { maxTokens, stream: true });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const parseLine = (raw) => {
    const line = raw.trim();
    if (!line.startsWith('data:')) return null;
    const payload = line.slice(5).trim();
    if (payload === '[DONE]') return 'DONE';
    try {
      const chunk = JSON.parse(payload);
      if (chunk.model === 'keepalive') return null; // OmniRoute sends these while it waits
      return partText(chunk?.choices?.[0]?.delta?.content) || null;
    } catch {
      return null;
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      buffer += decoder.decode();
      if (buffer.trim()) {
        const tail = parseLine(buffer);
        if (tail && tail !== 'DONE') yield tail;
      }
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    let newline;
    while ((newline = buffer.indexOf('\n')) !== -1) {
      const resText = parseLine(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 1);
      if (resText === 'DONE') return;
      if (resText) yield resText;
    }
  }
}
