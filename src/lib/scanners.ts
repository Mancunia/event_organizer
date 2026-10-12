import { randomBytes } from "node:crypto";
import { db } from "./db";
import { audit } from "./audit";
import { env } from "./env";
import { publicJwkSchema, sameKey, scannerBindMessage, verifyDeviceSignature, type DevicePublicJwk } from "./device-crypto";
import { whatsapp } from "./whatsapp";

const NONCE_TTL_MS = 2 * 60 * 1000;
/** How long an unopened pairing link stays usable. */
export const PAIRING_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** A scanner is addressed by the secret in its pairing link (first visit) or by id (re-auth from the stored key). */
export type ScannerRef = { token: string } | { deviceId: string };

const newToken = () => randomBytes(24).toString("base64url");

export function scannerPairUrl(eventSlug: string, token: string) {
  return `${env.appUrl}/${eventSlug}/scanner?t=${token}`;
}

export async function createScannerDevice(eventId: string, input: { label: string; staffName: string; phone: string }) {
  const device = await db.scannerDevice.create({
    data: { eventId, ...input, token: newToken(), tokenExpiresAt: new Date(Date.now() + PAIRING_TTL_MS) },
  });
  await audit("scanner.created", { eventId, meta: { deviceId: device.id, label: device.label } });
  return device;
}

export async function sendScannerLink(deviceId: string) {
  const device = await db.scannerDevice.findUniqueOrThrow({
    where: { id: deviceId },
    include: { event: { omit: { waAccessTokenEnc: false } } },
  });
  const { event } = device;
  try {
    const { messageId } = await whatsapp(event).sendScannerLink({
      to: device.phone,
      staffName: device.staffName,
      title: event.title,
      label: device.label,
      url: scannerPairUrl(event.slug, device.token),
      templateName: event.scannerTemplateName,
      language: event.templateLanguage,
    });
    await db.scannerDevice.update({
      where: { id: deviceId },
      data: { sentAt: new Date(), sendStatus: "sent", sendError: null, waMessageId: messageId },
    });
    await audit("scanner.link_sent", { eventId: event.id, meta: { deviceId } });
    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.scannerDevice.update({ where: { id: deviceId }, data: { sendStatus: "failed", sendError: message.slice(0, 500) } });
    return { ok: false as const, error: message };
  }
}

/** Fresh link and expiry for a device that hasn't been set up yet; the old link stops working. */
export async function rotateScannerToken(deviceId: string) {
  const rotated = await db.scannerDevice.updateMany({
    where: { id: deviceId, boundAt: null, revokedAt: null },
    data: { token: newToken(), tokenExpiresAt: new Date(Date.now() + PAIRING_TTL_MS) },
  });
  return rotated.count === 1;
}

export async function revokeScanner(deviceId: string) {
  const device = await db.scannerDevice.update({ where: { id: deviceId }, data: { revokedAt: new Date() } });
  await audit("scanner.revoked", { eventId: device.eventId, meta: { deviceId } });
  return device;
}

/** Revokes the device and issues a new, unbound one for the same person and label. */
export async function replaceScanner(deviceId: string) {
  const old = await revokeScanner(deviceId);
  return createScannerDevice(old.eventId, { label: old.label, staffName: old.staffName, phone: old.phone });
}

export type ScannerProblem = "not_found" | "revoked" | "expired";

/** Whether this device may start (or repeat) the bind handshake. */
function usable(
  device: { revokedAt: Date | null; boundAt: Date | null; tokenExpiresAt: Date } | null,
  ref: ScannerRef,
): ScannerProblem | null {
  if (!device) return "not_found";
  if (device.revokedAt) return "revoked";
  if ("deviceId" in ref && !device.boundAt) return "not_found";
  if (!device.boundAt && device.tokenExpiresAt <= new Date()) return "expired";
  return null;
}

function findDevice(eventId: string, ref: ScannerRef) {
  return db.scannerDevice.findFirst({ where: { eventId, ...("token" in ref ? { token: ref.token } : { id: ref.deviceId }) } });
}

export async function issueScannerChallenge(
  eventId: string,
  ref: ScannerRef,
): Promise<{ ok: true; nonce: string; deviceId: string } | { ok: false; reason: ScannerProblem }> {
  const device = await findDevice(eventId, ref);
  const problem = usable(device, ref);
  if (problem || !device) return { ok: false, reason: problem ?? "not_found" };
  const nonce = await db.scannerNonce.create({
    data: { deviceId: device.id, value: randomBytes(24).toString("base64url"), expiresAt: new Date(Date.now() + NONCE_TTL_MS) },
  });
  return { ok: true, nonce: nonce.value, deviceId: device.id };
}

export type BindScannerResult =
  | { ok: true; deviceId: string; keyX: string; firstBind: boolean }
  | { ok: false; reason: ScannerProblem | "invalid" | "bad_signature" | "claimed_elsewhere" };

/**
 * Binds the scanner to the device that signed the challenge, or re-authenticates the device that already
 * holds it. Same rules as guest invites: the first device wins and every other key is refused.
 */
export async function bindScanner(input: {
  eventId: string;
  ref: ScannerRef;
  nonce: string;
  signature: string;
  publicJwk: unknown;
  userAgent?: string;
}): Promise<BindScannerResult> {
  const parsed = publicJwkSchema.safeParse(input.publicJwk);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const jwk = parsed.data;

  const device = await findDevice(input.eventId, input.ref);
  const problem = usable(device, input.ref);
  if (problem || !device) return { ok: false, reason: problem ?? "not_found" };

  const consumed = await db.scannerNonce.updateMany({
    where: { value: input.nonce, deviceId: device.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (consumed.count !== 1) return { ok: false, reason: "invalid" };

  if (!(await verifyDeviceSignature(jwk, scannerBindMessage(device.id, input.nonce), input.signature))) {
    return { ok: false, reason: "bad_signature" };
  }

  const success = (firstBind: boolean): BindScannerResult => ({ ok: true, deviceId: device.id, keyX: jwk.x, firstBind });

  if (device.devicePublicKey) {
    return sameKey(device.devicePublicKey as DevicePublicJwk, jwk) ? success(false) : { ok: false, reason: "claimed_elsewhere" };
  }

  // Guarded update: if another device bound the scanner since we read it, this matches zero rows.
  const bound = await db.scannerDevice.updateMany({
    where: { id: device.id, boundAt: null, revokedAt: null },
    data: { devicePublicKey: jwk, boundAt: new Date(), boundUserAgent: input.userAgent?.slice(0, 300) },
  });
  if (bound.count !== 1) {
    const current = await db.scannerDevice.findUnique({ where: { id: device.id }, select: { devicePublicKey: true } });
    return current?.devicePublicKey && sameKey(current.devicePublicKey as DevicePublicJwk, jwk)
      ? success(false)
      : { ok: false, reason: "claimed_elsewhere" };
  }

  await audit("scanner.bound", { eventId: input.eventId, meta: { deviceId: device.id } });
  return success(true);
}

/** A session entry is only valid while the device is unrevoked and still bound to the key it was issued for. */
export async function loadScanner(entry: { deviceId: string; keyX: string } | undefined, eventId: string) {
  if (!entry) return null;
  const device = await db.scannerDevice.findFirst({ where: { id: entry.deviceId, eventId, revokedAt: null } });
  const key = device?.devicePublicKey as DevicePublicJwk | null | undefined;
  if (!device || !key || key.x !== entry.keyX) return null;
  return device;
}

/** Records activity for the admin's device list, at most once a minute per device. */
export async function touchScanner(deviceId: string) {
  const now = new Date();
  await db.scannerDevice.updateMany({
    where: { id: deviceId, OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: new Date(now.getTime() - 60_000) } }] },
    data: { lastSeenAt: now },
  });
}
