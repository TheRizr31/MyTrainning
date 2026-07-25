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

// Une réponse non-ok (401, 500...) doit ÉCHOUER bruyamment — sinon un
// mauvais token ou une panne du Worker passe totalement inaperçu : set()
// paraît réussir, get() paraît juste "vide", et les données semblent
// disparaître au prochain chargement sans qu'aucune erreur n'ait jamais été
// visible nulle part.
async function failIfNotOk(res, label) {
  if (!res.ok) {
    let detail = "";
    try { detail = await res.text(); } catch {}
    throw new Error(`${label} a échoué (HTTP ${res.status})${detail ? " — " + detail : ""}`);
  }
  return res;
}

export const cloudflareStorage = {
  async get(key) {
    const res = await request(`/kv/${encodeURIComponent(key)}`);
    if (res.status === 404) return null;
    await failIfNotOk(res, `Lecture de "${key}"`);
    return res.json();
  },

  async set(key, value) {
    const res = await request(`/kv/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: { "Content-Type": "text/plain" },
      body: String(value),
    });
    await failIfNotOk(res, `Sauvegarde de "${key}"`);
    return res.json();
  },

  async delete(key) {
    const res = await request(`/kv/${encodeURIComponent(key)}`, { method: "DELETE" });
    await failIfNotOk(res, `Suppression de "${key}"`);
    return res.json();
  },

  async list(prefix = "") {
    const res = await request(`/kv?prefix=${encodeURIComponent(prefix)}`);
    await failIfNotOk(res, `Liste "${prefix}"`);
    return res.json();
  },
};

// N'installe que si une API est configurée (sinon storage.js prendra le relais).
export function installCloudflareStorage() {
  if (typeof window !== "undefined" && !window.storage && BASE) {
    window.storage = cloudflareStorage;
  }
}
