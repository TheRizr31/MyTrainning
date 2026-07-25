// API minimale reproduisant l'interface window.storage (get/set/delete/list)
// sur une base D1, avec une table clé/valeur unique. Auth par token partagé
// (secret API_TOKEN), CORS ouvert pour être appelé depuis le front hébergé
// ailleurs (GitHub Pages, etc).

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization,Content-Type",
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    const auth = request.headers.get("Authorization") || "";
    if (auth !== `Bearer ${env.API_TOKEN}`) {
      return json({ error: "Unauthorized" }, 401);
    }

    const url = new URL(request.url);

    if (url.pathname === "/kv" && request.method === "GET") {
      const prefix = url.searchParams.get("prefix") || "";
      const { results } = await env.DB.prepare(
        "SELECT key FROM kv WHERE key LIKE ? ESCAPE '\\' ORDER BY key"
      )
        .bind(prefix.replace(/[\\%_]/g, "\\$&") + "%")
        .all();
      return json({ keys: results.map((r) => r.key) });
    }

    const m = url.pathname.match(/^\/kv\/(.+)$/);
    if (m) {
      const key = decodeURIComponent(m[1]);

      if (request.method === "GET") {
        const row = await env.DB.prepare("SELECT value FROM kv WHERE key = ?").bind(key).first();
        if (!row) return json({ error: "Not found" }, 404);
        return json({ key, value: row.value });
      }

      if (request.method === "PUT") {
        const value = await request.text();
        await env.DB.prepare(
          "INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
        )
          .bind(key, value)
          .run();
        return json({ key, value });
      }

      if (request.method === "DELETE") {
        await env.DB.prepare("DELETE FROM kv WHERE key = ?").bind(key).run();
        return json({ key, deleted: true });
      }
    }

    return json({ error: "Not found" }, 404);
  },
};
