// Minimal Web Push (RFC 8291 aes128gcm payload encryption + RFC 8292 VAPID) using WebCrypto only.
const enc = new TextEncoder();

export const b64u = {
  encode(buf) {
    const bytes = new Uint8Array(buf);
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  },
  decode(str) {
    const s = atob(str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4));
    return Uint8Array.from(s, c => c.charCodeAt(0));
  },
};

const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) { out.set(p, i); i += p.length; }
  return out;
};

async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8));
}

// Generates a VAPID key pair; both halves are returned as JWK so they can be stored as JSON.
export async function generateVapidKeys() {
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  return {
    publicKey: await crypto.subtle.exportKey("jwk", kp.publicKey),
    privateKey: await crypto.subtle.exportKey("jwk", kp.privateKey),
  };
}

// The browser wants the uncompressed P-256 point (0x04 || x || y) as base64url.
export function vapidPublicKeyB64(publicJwk) {
  return b64u.encode(concat(new Uint8Array([4]), b64u.decode(publicJwk.x), b64u.decode(publicJwk.y)));
}

async function vapidHeader(endpoint, vapid, subject) {
  const aud = new URL(endpoint).origin;
  const header = b64u.encode(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64u.encode(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const key = await crypto.subtle.importKey("jwk", vapid.privateKey, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${header}.${claims}`));
  return `vapid t=${header}.${claims}.${b64u.encode(sig)}, k=${vapidPublicKeyB64(vapid.publicKey)}`;
}

export async function encryptPayload(subscription, payload) {
  const uaPublic = b64u.decode(subscription.keys.p256dh);
  const authSecret = b64u.decode(subscription.keys.auth);
  const asKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", asKeys.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, asKeys.privateKey, 256));

  const ikm = await hkdf(authSecret, shared, concat(enc.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const plain = concat(enc.encode(payload), new Uint8Array([2])); // 0x02 marks the last (only) record
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, plain));

  const rs = new Uint8Array([0, 0, 16, 0]); // record size 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

// Returns the push service's HTTP status (201 = sent, 404/410 = subscription is gone).
export async function sendPush(subscription, payload, vapid, subject) {
  const body = await encryptPayload(subscription, payload);
  const res = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: await vapidHeader(subscription.endpoint, vapid, subject),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "3600",
      Urgency: "normal",
    },
    body,
  });
  return res.status;
}
