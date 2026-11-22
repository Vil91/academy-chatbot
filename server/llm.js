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
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS || 120000),
  };
}

function request(messages, { maxTokens, stream }) {
  const { baseUrl, apiKey, model, timeoutMs } = llmConfig();
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

const partText = (content) =>
  Array.isArray(content)
    ? content.map((part) => (typeof part === 'string' ? part : part?.text || '')).join('')
    : content || '';

export async function chatCompletion(messages, { maxTokens = 4096 } = {}) {
  const res = await request(messages, { maxTokens, stream: false });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = partText(data?.choices?.[0]?.message?.content);
  if (!text.trim()) throw new Error('LLM returned an empty answer');
  return text;
}

// Yields text as it is generated (server-sent events, OpenAI chunk format).
export async function* chatStream(messages, { maxTokens = 4096 } = {}) {
  const res = await request(messages, { maxTokens, stream: true });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline;
    while ((newline = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') return;
      let chunk;
      try {
        chunk = JSON.parse(payload);
      } catch {
        continue;
      }
      if (chunk.model === 'keepalive') continue; // OmniRoute sends these while it waits
      const text = partText(chunk?.choices?.[0]?.delta?.content);
      if (text) yield text;
    }
  }
}
