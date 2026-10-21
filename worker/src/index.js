// Sends the Luz Diária reminders. Each phone registers its push subscription, time zone and the
// morning/evening times it wants; a cron run every 5 minutes sends whatever is due.
import { generateVapidKeys, vapidPublicKeyB64, sendPush } from "./webpush.js";

const SUBJECT = "https://realizacred.github.io/Biblia-/";
const ALLOWED_ORIGINS = ["https://realizacred.github.io", "http://127.0.0.1:8767", "http://localhost:8767"];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

async function getVapid(env) {
  let vapid = await env.SUBS.get("vapid", "json");
  if (!vapid) {
    vapid = await generateVapidKeys();
    await env.SUBS.put("vapid", JSON.stringify(vapid));
  }
  return vapid;
}

async function subKey(endpoint) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return "sub:" + [...new Uint8Array(hash)].slice(0, 16).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Local date (YYYY-MM-DD) and minutes since midnight in the phone's time zone.
function localNow(tz, now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now).map(p => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: +parts.hour * 60 + +parts.minute };
}

const toMinutes = t => +t.slice(0, 2) * 60 + +t.slice(3);

function validTz(tz) {
  try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch { return false; }
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

async function handle(request, env) {
  const reqOrigin = request.headers.get("Origin") || "";
  const origin = ALLOWED_ORIGINS.includes(reqOrigin) ? reqOrigin : ALLOWED_ORIGINS[0];
  const path = new URL(request.url).pathname;
  if (request.method === "OPTIONS") return json({}, 204, origin);

  if (request.method === "GET" && path === "/vapid") {
    return json({ key: vapidPublicKeyB64((await getVapid(env)).publicKey) }, 200, origin);
  }
  if (request.method !== "POST") return json({ error: "not found" }, 404, origin);

  const body = await request.json().catch(() => null);
  const sub = body && body.subscription;
  if (!sub || typeof sub.endpoint !== "string" || !/^https:\/\//.test(sub.endpoint) || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
    return json({ error: "inscrição inválida" }, 400, origin);
  }
  const key = await subKey(sub.endpoint);

  if (path === "/subscribe") {
    const { tz, morning, evening } = body;
    if (!validTz(tz) || (morning && !TIME.test(morning)) || (evening && !TIME.test(evening))) {
      return json({ error: "horário inválido" }, 400, origin);
    }
    const old = (await env.SUBS.get(key, "json")) || {};
    // Changing a time today should still fire today, so the "already sent" marker is cleared for it.
    const last = { m: old.morning === morning ? old.last?.m : null, e: old.evening === evening ? old.last?.e : null };
    await env.SUBS.put(key, JSON.stringify({
      subscription: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
      tz, morning: morning || null, evening: evening || null, last,
    }));
    return json({ ok: true }, 200, origin);
  }
  if (path === "/unsubscribe") {
    await env.SUBS.delete(key);
    return json({ ok: true }, 200, origin);
  }
  if (path === "/test") {
    const status = await sendPush(sub, JSON.stringify({ test: true }), await getVapid(env), SUBJECT);
    return json({ ok: status < 300, status }, status < 300 ? 200 : 502, origin);
  }
  return json({ error: "not found" }, 404, origin);
}

async function sendDue(env, now = new Date()) {
  const vapid = await getVapid(env);
  let cursor;
  do {
    const page = await env.SUBS.list({ prefix: "sub:", cursor });
    for (const { name } of page.keys) {
      const rec = await env.SUBS.get(name, "json");
      if (!rec) continue;
      const { date, minutes } = localNow(rec.tz, now);
      let changed = false;
      for (const [per, time] of [["m", rec.morning], ["e", rec.evening]]) {
        if (!time || rec.last?.[per] === date) continue;
        const late = minutes - toMinutes(time);
        if (late < 0 || late > 60) continue; // only send within the hour after the chosen time
        const status = await sendPush(rec.subscription, JSON.stringify({ per }), vapid, SUBJECT).catch(() => 0);
        if (status === 404 || status === 410) { await env.SUBS.delete(name); changed = false; break; }
        if (status >= 200 && status < 300) { rec.last = { ...rec.last, [per]: date }; changed = true; }
      }
      if (changed) await env.SUBS.put(name, JSON.stringify(rec));
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
}

export default {
  fetch: (request, env) => handle(request, env).catch(e => json({ error: String(e) }, 500, ALLOWED_ORIGINS[0])),
  scheduled: (event, env, ctx) => ctx.waitUntil(sendDue(env, new Date(event.scheduledTime))),
};
export { localNow, sendDue, handle };
