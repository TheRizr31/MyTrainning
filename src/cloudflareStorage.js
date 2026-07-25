// cloudflareStorage.js
// ---------------------------------------------------------------------------
// Implémente la même interface que storage.js (get/set/delete/list), mais en
// appelant l'API Worker (worker/) adossée à D1, plutôt que localStorage.
// Activée uniquement si VITE_API_URL est définie (voir .env.example).
// ---------------------------------------------------------------------------

const BASE = import.meta.env.VITE_API_URL;
const TOKEN = import.meta.env.VITE_API_TOKEN;

async function request(path, opts = {}) {
  return fetch(BASE + path, {
    ...opts,
    headers: { Authorization: `Bearer ${TOKEN}`, ...(opts.headers || {}) },
  });
}

export const cloudflareStorage = {
  async get(key) {
    const res = await request(`/kv/${encodeURIComponent(key)}`);
    if (!res.ok) return null;
    return res.json();
  },

  async set(key, value) {
    const res = await request(`/kv/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: { "Content-Type": "text/plain" },
      body: String(value),
    });
    return res.json();
  },

  async delete(key) {
    const res = await request(`/kv/${encodeURIComponent(key)}`, { method: "DELETE" });
    return res.json();
  },

  async list(prefix = "") {
    const res = await request(`/kv?prefix=${encodeURIComponent(prefix)}`);
    if (!res.ok) return { keys: [] };
    return res.json();
  },
};

// N'installe que si une API est configurée (sinon storage.js prendra le relais).
export function installCloudflareStorage() {
  if (typeof window !== "undefined" && !window.storage && BASE) {
    window.storage = cloudflareStorage;
  }
}
