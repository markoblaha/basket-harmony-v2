// Odoslanie upozornenia do telefónu (Web Push) bez knižníc – len WebCrypto:
//  - podpis servera VAPID (RFC 8292, ES256),
//  - šifrovanie obsahu aes128gcm (RFC 8291), aby ho push služba (Apple, Google) neprečítala.
// Overené referenčnou knižnicou http_ece (dešifrovanie) – pozri docs/STAV-PROJEKTU.md.

export type PushSubscription = { endpoint: string; p256dh: string; auth: string };
export type Vapid = { publicKey: string; privateJwk: JsonWebKey; subject: string };

const enc = new TextEncoder();
const b64u = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const unb64u = (s: string) => {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};
async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}

/** Podpis VAPID: JWT pre pôvod push služby, platný 12 hodín. */
export async function vapidHeader(endpoint: string, v: Vapid): Promise<string> {
  const aud = new URL(endpoint).origin;
  const header = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: v.subject })));
  const key = await crypto.subtle.importKey("jwk", { ...v.privateJwk, key_ops: ["sign"] }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${header}.${claims}`));
  return `vapid t=${header}.${claims}.${b64u(sig)}, k=${v.publicKey}`;
}

/** Zašifruje obsah pre jeden odber (aes128gcm, jeden záznam). */
export async function encryptPayload(sub: PushSubscription, payload: Uint8Array): Promise<Uint8Array> {
  const uaPublic = unb64u(sub.p256dh);
  const authSecret = unb64u(sub.auth);
  const local = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", local.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, local.privateKey, 256));
  // RFC 8291 3.4: IKM z tajomstva odberu, potom CEK a nonce z náhodnej soli.
  const prkKey = await hmac(authSecret, ecdh);
  const ikm = await hmac(prkKey, concat(enc.encode("WebPush: info\0"), uaPublic, asPublic, new Uint8Array([1])));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, concat(payload, new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 0x10, 0]); // 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, ct);
}

/** Pošle upozornenie. Vráti HTTP stav push služby (201 = doručené; 404/410 = odber už neplatí). */
export async function sendPush(sub: PushSubscription, data: unknown, v: Vapid, opts: { ttl?: number; urgency?: "normal" | "high"; topic?: string } = {}): Promise<number> {
  const body = await encryptPayload(sub, enc.encode(JSON.stringify(data)));
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: await vapidHeader(sub.endpoint, v),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(opts.ttl ?? 3600),
      Urgency: opts.urgency ?? "high",
      ...(opts.topic ? { Topic: opts.topic.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) } : {}),
    },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  await res.body?.cancel().catch(() => undefined);
  return res.status;
}
