// Browser storage can be missing or blocked (private mode, previews): never let it break the app.
export function load(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function sessionGet(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function sessionSet(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

let memorySessionId = null;

export function getSessionId(reset = false) {
  let id = reset ? null : sessionGet('ac_session') || memorySessionId;
  if (!id) {
    id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    sessionSet('ac_session', id);
    memorySessionId = id;
  }
  return id;
}
