async function request(path, { method = 'GET', body, headers } = {}) {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
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
    throw err;
  }
  return data;
}

export const api = {
  chat: (payload) => request('/api/chat', { method: 'POST', body: payload }),
  login: (code) => request('/api/student/login', { method: 'POST', body: { code } }),
  lead: (payload) => request('/api/lead', { method: 'POST', body: payload }),
  excuse: (payload) => request('/api/excuse', { method: 'POST', body: payload }),
  admin: (key) => request('/api/admin/summary', { headers: { 'x-admin-key': key } }),
};
