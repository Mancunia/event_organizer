import { SignJWT, jwtVerify } from "jose";
import { env } from "./env";

export type QrPayload = { inviteId: string; eventId: string };

function key() {
  return new TextEncoder().encode(env.qrSecret);
}

export async function signQrToken(payload: QrPayload): Promise<string> {
  return new SignJWT({ inv: payload.inviteId, evt: payload.eventId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .sign(key());
}

export async function verifyQrToken(token: string): Promise<QrPayload | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (typeof payload.inv !== "string" || typeof payload.evt !== "string") return null;
    return { inviteId: payload.inv, eventId: payload.evt };
  } catch {
    return null;
  }
}

/** Pulls a QR token out of whatever a scanner returned: a full /v/<token> URL or a bare token. */
export function extractQrToken(scanned: string): string | null {
  const text = scanned.trim();
  const match = text.match(/\/v\/([A-Za-z0-9_.-]+)\/?$/);
  if (match) return match[1];
  if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(text)) return text;
  return null;
}

export function qrUrl(token: string): string {
  return `${env.appUrl}/v/${token}`;
}
