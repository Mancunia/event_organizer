import { z } from "zod";

/** Public half of the device's ECDSA P-256 key. Anything else (notably a private `d`) is rejected. */
export const publicJwkSchema = z
  .object({
    kty: z.literal("EC"),
    crv: z.literal("P-256"),
    x: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    y: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  })
  .strip();

export type DevicePublicJwk = z.infer<typeof publicJwkSchema>;

/**
 * The exact bytes the device signs. Shared with the browser so both sides agree.
 * The "wedding-" prefix is a legacy protocol identifier from before events were generalised; keep it stable.
 */
export function claimMessage(code: string, nonce: string): string {
  return `wedding-invite-claim|${code}|${nonce}`;
}

/** What a scanner device signs to bind or re-authenticate. A distinct prefix so a guest claim signature can't be replayed here. */
export function scannerBindMessage(deviceId: string, nonce: string): string {
  return `scanner-bind|${deviceId}|${nonce}`;
}

export function sameKey(a: DevicePublicJwk, b: DevicePublicJwk): boolean {
  return a.x === b.x && a.y === b.y;
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  return new Uint8Array(Buffer.from(value, "base64url"));
}

/** Verifies a WebCrypto ECDSA (P-256, SHA-256, IEEE-P1363 r||s) signature. */
export async function verifyDeviceSignature(
  jwk: DevicePublicJwk,
  message: string,
  signatureB64Url: string,
): Promise<boolean> {
  const signature = base64UrlToBytes(signatureB64Url);
  if (!signature || signature.length !== 64) return false;
  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y, ext: true },
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      signature,
      new TextEncoder().encode(message),
    );
  } catch {
    return false;
  }
}
