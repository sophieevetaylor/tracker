// Stores the 2027 plan so it syncs between your phone and laptop.
// Set SYNC_KEY in Netlify (Site configuration > Environment variables). Requests without it are refused.
import { getStore } from "@netlify/blobs";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export default async (req) => {
  const secret = (globalThis.Netlify && Netlify.env.get("SYNC_KEY")) || process.env.SYNC_KEY;
  if (!secret) return json({ error: "SYNC_KEY is not set" }, 503);
  if (req.headers.get("x-sync-key") !== secret) return json({ error: "Wrong sync key" }, 401);

  const store = getStore({ name: "plan2027", consistency: "strong" });

  if (req.method === "GET") {
    const data = await store.get("state", { type: "json" });
    return json(data ?? null);
  }

  if (req.method === "PUT") {
    const text = await req.text();
    if (text.length > 2_000_000) return json({ error: "Too large" }, 413);
    let data;
    try { data = JSON.parse(text); } catch { return json({ error: "Not JSON" }, 400); }
    if (!data || typeof data !== "object" || Array.isArray(data)) return json({ error: "Not a plan" }, 400);
    await store.setJSON("state", data);
    // One snapshot per day, so a bad edit can always be rolled back.
    await store.setJSON("backup-" + new Date().toISOString().slice(0, 10), data);
    return json({ ok: true, updatedAt: data.updatedAt || null });
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config = { path: "/api/plan" };
