// storage.js
// ---------------------------------------------------------------------------
// Dans l'environnement Claude (artifacts), un objet global `window.storage`
// fournit un stockage clé/valeur persistant et asynchrone. Hors de Claude,
// cet objet n'existe pas. Cet adaptateur reproduit EXACTEMENT la même
// interface, mais en s'appuyant sur localStorage, pour que le composant
// fonctionne à l'identique sans modifier ses appels.
//
// Interface reproduite :
//   await storage.get(key)          -> { key, value } | null
//   await storage.set(key, value)   -> { key, value }
//   await storage.delete(key)       -> { key, deleted: true }
//   await storage.list(prefix)      -> { keys: string[] }
//
// Remarques :
// - Toutes les méthodes renvoient une Promise (comme l'API Claude).
// - Les valeurs sont des chaînes (le composant y stocke déjà du JSON).
// - Un préfixe interne évite les collisions avec d'autres données du domaine.
// ---------------------------------------------------------------------------

const NS = "suivi-muscu:"; // namespace pour éviter les collisions dans localStorage

function safeParseKey(fullKey) {
  return fullKey.startsWith(NS) ? fullKey.slice(NS.length) : null;
}

export const storage = {
  async get(key) {
    try {
      const raw = localStorage.getItem(NS + key);
      if (raw === null) return null;
      return { key, value: raw };
    } catch {
      return null;
    }
  },

  async set(key, value) {
    // value est déjà une chaîne (JSON.stringify côté composant)
    localStorage.setItem(NS + key, String(value));
    return { key, value: String(value) };
  },

  async delete(key) {
    localStorage.removeItem(NS + key);
    return { key, deleted: true };
  },

  async list(prefix = "") {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const full = localStorage.key(i);
      const short = safeParseKey(full);
      if (short !== null && short.startsWith(prefix)) keys.push(short);
    }
    return { keys };
  },
};

// Installe l'adaptateur sur window.storage s'il n'existe pas déjà.
// (Dans Claude, window.storage existe : on ne l'écrase pas.)
export function installStorage() {
  if (typeof window !== "undefined" && !window.storage) {
    window.storage = storage;
  }
}
