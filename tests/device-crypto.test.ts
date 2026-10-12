import { describe, expect, it } from "vitest";
import { claimMessage, publicJwkSchema, scannerBindMessage, verifyDeviceSignature } from "@/lib/device-crypto";

async function device() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
  const jwk = publicJwkSchema.parse(await crypto.subtle.exportKey("jwk", pair.publicKey));
  const sign = async (msg: string) =>
    Buffer.from(
      await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, new TextEncoder().encode(msg)),
    ).toString("base64url");
  return { jwk, sign };
}

describe("device signatures", () => {
  it("accepts a signature from the bound device", async () => {
    const d = await device();
    const msg = claimMessage("ABCDEFGH", "nonce-1");
    expect(await verifyDeviceSignature(d.jwk, msg, await d.sign(msg))).toBe(true);
  });

  it("rejects a signature made by a different device", async () => {
    const [a, b] = await Promise.all([device(), device()]);
    const msg = claimMessage("ABCDEFGH", "nonce-1");
    expect(await verifyDeviceSignature(a.jwk, msg, await b.sign(msg))).toBe(false);
  });

  it("rejects a signature over a different nonce (no replay)", async () => {
    const d = await device();
    const sig = await d.sign(claimMessage("ABCDEFGH", "nonce-1"));
    expect(await verifyDeviceSignature(d.jwk, claimMessage("ABCDEFGH", "nonce-2"), sig)).toBe(false);
  });

  it("rejects garbage signatures and non-public keys", async () => {
    const d = await device();
    expect(await verifyDeviceSignature(d.jwk, "x", "not-base64!")).toBe(false);
    expect(await verifyDeviceSignature(d.jwk, "x", "AAAA")).toBe(false);
    expect(publicJwkSchema.safeParse({ kty: "RSA", n: "x", e: "AQAB" }).success).toBe(false);
    // a private `d` is stripped, never stored
    expect(publicJwkSchema.parse({ ...d.jwk, d: "secret" })).not.toHaveProperty("d");
  });

  it("never accepts a guest claim signature as a scanner bind, or the other way round", async () => {
    const d = await device();
    const claimSig = await d.sign(claimMessage("ABCDEFGH", "nonce-1"));
    expect(await verifyDeviceSignature(d.jwk, scannerBindMessage("ABCDEFGH", "nonce-1"), claimSig)).toBe(false);
    const bindSig = await d.sign(scannerBindMessage("ABCDEFGH", "nonce-1"));
    expect(await verifyDeviceSignature(d.jwk, claimMessage("ABCDEFGH", "nonce-1"), bindSig)).toBe(false);
  });
});
