"use client";

/**
 * The device's identity for an event: a non-extractable ECDSA P-256 key pair kept in IndexedDB.
 * The private key can sign but can never be read out, so the claim can't be copied to another device.
 */

/** Keyed by event slug for guests, `scanner:<slug>` for check-in devices. */
type StoredDevice = { privateKey: CryptoKey; publicJwk: JsonWebKey; code?: string; deviceId?: string };

// Legacy name kept on purpose: renaming it would orphan the keys of devices that already claimed an invite.
const DB_NAME = "wedding-invite";
const STORE = "devices";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function load(key: string): Promise<StoredDevice | undefined> {
  return tx("readonly", (s) => s.get(key) as IDBRequest<StoredDevice | undefined>);
}

async function save(key: string, device: StoredDevice) {
  await tx("readwrite", (s) => s.put(device, key));
}

async function getOrCreateDevice(key: string): Promise<StoredDevice> {
  const existing = await load(key);
  if (existing) return existing;
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
  const { kty, crv, x, y } = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const device = { privateKey: pair.privateKey, publicJwk: { kty, crv, x, y } };
  await save(key, device);
  return device;
}

function toBase64Url(buf: ArrayBuffer): string {
  let s = "";
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function storedCode(slug: string): Promise<string | undefined> {
  try {
    return (await load(slug))?.code;
  } catch {
    return undefined;
  }
}

export type ClaimOutcome = { ok: true; firstClaim: boolean } | { ok: false; error: string; reason?: string };

/** Challenge → sign with the device key → claim. Also used to silently re-authenticate on return visits. */
export async function claimWithDevice(slug: string, code: string): Promise<ClaimOutcome> {
  let device: StoredDevice;
  try {
    device = await getOrCreateDevice(slug);
  } catch {
    return { ok: false, error: "This browser can't store your invite securely. Try a different browser, and avoid private browsing." };
  }

  const challengeRes = await fetch("/api/claim/challenge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, code }),
  });
  const challenge = await challengeRes.json();
  if (!challengeRes.ok) return { ok: false, error: challenge.error ?? "Something went wrong." };

  const normalized = code.toUpperCase().replace(/[\s-]/g, "");
  const message = `wedding-invite-claim|${normalized}|${challenge.nonce}`;
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    device.privateKey,
    new TextEncoder().encode(message),
  );

  const claimRes = await fetch("/api/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, code: normalized, nonce: challenge.nonce, signature: toBase64Url(signature), publicJwk: device.publicJwk }),
  });
  const result = await claimRes.json();
  if (!claimRes.ok) return { ok: false, error: result.error ?? "Something went wrong.", reason: result.reason };

  await save(slug, { ...device, code: normalized });
  return { ok: true, firstClaim: result.firstClaim };
}

const scannerKey = (slug: string) => `scanner:${slug}`;

export async function storedScannerId(slug: string): Promise<string | undefined> {
  try {
    return (await load(scannerKey(slug)))?.deviceId;
  } catch {
    return undefined;
  }
}

export type ScannerOutcome = { ok: true; firstBind: boolean } | { ok: false; error: string; reason?: string };

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

/**
 * Makes this browser a check-in device: challenge → sign with the device key → bind.
 * Pass the pairing link token on first setup, or the stored device id to sign back in.
 */
export async function bindScannerDevice(slug: string, ref: { token: string } | { deviceId: string }): Promise<ScannerOutcome> {
  let device: StoredDevice;
  try {
    device = await getOrCreateDevice(scannerKey(slug));
  } catch {
    return { ok: false, error: "This browser can't store the scanner key securely. Try Chrome or Safari, and avoid private browsing." };
  }

  const challenge = await postJson("/api/scanner/challenge", { slug, ref });
  if (!challenge.ok) return { ok: false, error: challenge.data.error ?? "Something went wrong.", reason: challenge.data.reason };
  const { nonce, deviceId } = challenge.data as { nonce: string; deviceId: string };

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    device.privateKey,
    new TextEncoder().encode(`scanner-bind|${deviceId}|${nonce}`),
  );
  const bind = await postJson("/api/scanner/bind", { slug, ref, nonce, signature: toBase64Url(signature), publicJwk: device.publicJwk });
  if (!bind.ok) return { ok: false, error: bind.data.error ?? "Something went wrong.", reason: bind.data.reason };

  await save(scannerKey(slug), { ...device, deviceId });
  return { ok: true, firstBind: bind.data.firstBind };
}
