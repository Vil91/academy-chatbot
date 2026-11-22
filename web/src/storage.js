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

// A guest is recognised by a random id kept in this browser; their chats belong to it
// until they sign in, when the server moves them into the account.
let memoryDeviceId = null;

export function getDeviceId() {
  let id = load('ac_device') || memoryDeviceId;
  if (!id) {
    id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    save('ac_device', id);
    memoryDeviceId = id;
  }
  return id;
}
