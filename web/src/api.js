import { getDeviceId } from './storage.js';

async function request(path, { method = 'GET', body, headers = {}, raw } = {}) {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: {
      ...(body !== undefined && !raw ? { 'Content-Type': 'application/json' } : {}),
      'x-device-id': getDeviceId(),
      ...headers,
    },
    body: raw || (body !== undefined ? JSON.stringify(body) : undefined),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const err = new Error(data?.error || `http_${res.status}`);
    err.status = res.status;
    err.code = data?.error || (res.status === 413 ? 'file_too_large' : 'error');
    throw err;
  }
  return data;
}

const admin = (key) => ({ 'x-admin-key': key });

export const api = {
  me: () => request('/api/auth/me'),
  authConfig: () => request('/api/auth/config'),
  signup: (body) => request('/api/auth/signup', { method: 'POST', body }),
  login: (body) => request('/api/auth/login', { method: 'POST', body }),
  googleLogin: (credential, lang) => request('/api/auth/google', { method: 'POST', body: { credential, lang } }),
  demo: (lang) => request('/api/auth/demo', { method: 'POST', body: { lang } }),
  logout: () => request('/api/auth/logout', { method: 'POST', body: {} }),

  conversations: () => request('/api/conversations'),
  conversation: (id) => request(`/api/conversations/${encodeURIComponent(id)}`),
  deleteConversation: (id) => request(`/api/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  upload: (file) =>
    request('/api/attachments', {
      method: 'POST',
      raw: file,
      headers: { 'Content-Type': file.type, 'x-file-name': encodeURIComponent(file.name) },
    }),

  lead: (body) => request('/api/lead', { method: 'POST', body }),
  excuse: (body) => request('/api/excuse', { method: 'POST', body }),
  cabinet: () => request('/api/me/cabinet'),
  paymentProof: (body) => request('/api/payments/proof', { method: 'POST', body }),

  admin: {
    summary: (key) => request('/api/admin/summary', { headers: admin(key) }),
    conversation: (key, id) => request(`/api/admin/conversations/${encodeURIComponent(id)}`, { headers: admin(key) }),
    setProof: (key, id, status) => request(`/api/admin/payment-proofs/${id}`, { method: 'POST', body: { status }, headers: admin(key) }),
    setHandoff: (key, id, status) => request(`/api/admin/handoffs/${id}`, { method: 'POST', body: { status }, headers: admin(key) }),
    emailDraft: (key, email) => request('/api/admin/email-draft', { method: 'POST', body: { email }, headers: admin(key) }),
    saveKnowledge: (key, id, text) =>
      request(`/api/admin/knowledge/${encodeURIComponent(id)}`, { method: 'PUT', body: { text }, headers: admin(key) }),
    exportLeadsCsv: async (key) => {
      const res = await fetch('/api/admin/export/leads.csv', { headers: admin(key) });
      if (!res.ok) throw new Error('export_failed');
      return res.blob();
    },
    attachmentBlob: async (key, id) => {
      const res = await fetch(`/api/attachments/${encodeURIComponent(id)}`, { headers: admin(key) });
      if (!res.ok) throw new Error('not_found');
      return URL.createObjectURL(await res.blob());
    },
  },
};

export const attachmentUrl = (id) => `/api/attachments/${encodeURIComponent(id)}?d=${encodeURIComponent(getDeviceId())}`;

// POST /api/chat answers with server-sent events: start → delta… → done (or error).
export async function streamChat(payload, { onEvent, signal }) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'x-device-id': getDeviceId() },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok || !res.body) {
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    const err = new Error(data?.error || `http_${res.status}`);
    err.status = res.status;
    throw err;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let end;
    while ((end = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      let event = 'message';
      let data = '';
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (!data) continue;
      let parsed;
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }
      onEvent(event, parsed);
    }
  }
}
