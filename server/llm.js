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
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS || 90000),
  };
}

export async function chatCompletion(messages, { maxTokens = 4096 } = {}) {
  const { baseUrl, apiKey, model, timeoutMs } = llmConfig();
  const body = { model, messages, max_tokens: maxTokens };
  if (process.env.REASONING_EFFORT) body.reasoning_effort = process.env.REASONING_EFFORT;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    throw new Error(`LLM HTTP ${res.status}: ${detail}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  const text = Array.isArray(content)
    ? content.map((part) => (typeof part === 'string' ? part : part?.text || '')).join('')
    : content || '';
  if (!text.trim()) throw new Error('LLM returned an empty answer');
  return text;
}
