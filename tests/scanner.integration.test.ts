import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { publicJwkSchema, scannerBindMessage } from "@/lib/device-crypto";

if (existsSync(".env")) process.loadEnvFile(".env");
const run = process.env.DATABASE_URL ? describe : describe.skip;

async function device() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
  const publicJwk = publicJwkSchema.parse(await crypto.subtle.exportKey("jwk", pair.publicKey));
  const sign = async (msg: string) =>
    Buffer.from(
      await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, new TextEncoder().encode(msg)),
    ).toString("base64url");
  return { publicJwk, sign };
}

run("pairing scanner devices (database)", { timeout: 60_000 }, async () => {
  const { db } = await import("@/lib/db");
  const scanners = await import("@/lib/scanners");
  type Ref = Parameters<typeof scanners.bindScanner>[0]["ref"];
  let eventId: string;

  beforeAll(async () => {
    const event = await db.event.create({
      data: { slug: `scanner-test-${Date.now()}`, title: "Scanner test", date: new Date(), venue: "Test venue" },
    });
    eventId = event.id;
  });

  afterAll(async () => {
    await db.event.delete({ where: { id: eventId } });
    await db.$disconnect();
  });

  const newScanner = () => scanners.createScannerDevice(eventId, { label: "Gate A", staffName: "Kofi", phone: "+233241234567" });

  async function attempt(d: Awaited<ReturnType<typeof device>>, ref: Ref) {
    const challenge = await scanners.issueScannerChallenge(eventId, ref);
    if (!challenge.ok) return challenge;
    return scanners.bindScanner({
      eventId,
      ref,
      nonce: challenge.nonce,
      signature: await d.sign(scannerBindMessage(challenge.deviceId, challenge.nonce)),
      publicJwk: d.publicJwk,
    });
  }

  it("binds to the first device that opens the link and refuses every other device", async () => {
    const scanner = await newScanner();
    const [a, b] = await Promise.all([device(), device()]);

    expect(await attempt(a, { token: scanner.token })).toMatchObject({ ok: true, firstBind: true, deviceId: scanner.id });
    expect(await attempt(b, { token: scanner.token })).toEqual({ ok: false, reason: "claimed_elsewhere" });
    // the bound phone can sign back in, by link or by stored id
    expect(await attempt(a, { token: scanner.token })).toMatchObject({ ok: true, firstBind: false });
    expect(await attempt(a, { deviceId: scanner.id })).toMatchObject({ ok: true, firstBind: false });
    expect(await attempt(b, { deviceId: scanner.id })).toEqual({ ok: false, reason: "claimed_elsewhere" });
  });

  it("lets exactly one of several racing devices win", async () => {
    const scanner = await newScanner();
    const devices = await Promise.all(Array.from({ length: 5 }, device));
    const results = await Promise.all(devices.map((d) => attempt(d, { token: scanner.token })));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.reason === "claimed_elsewhere")).toHaveLength(4);
  });

  it("refuses re-auth by id before the device is bound, and a replayed nonce", async () => {
    const scanner = await newScanner();
    const a = await device();
    expect(await attempt(a, { deviceId: scanner.id })).toEqual({ ok: false, reason: "not_found" });

    const challenge = await scanners.issueScannerChallenge(eventId, { token: scanner.token });
    if (!challenge.ok) throw new Error("expected a challenge");
    const input = {
      eventId,
      ref: { token: scanner.token },
      nonce: challenge.nonce,
      signature: await a.sign(scannerBindMessage(scanner.id, challenge.nonce)),
      publicJwk: a.publicJwk,
    };
    expect((await scanners.bindScanner(input)).ok).toBe(true);
    expect(await scanners.bindScanner(input)).toEqual({ ok: false, reason: "invalid" });
  });

  it("refuses an expired link, but a resent link works", async () => {
    const scanner = await newScanner();
    await db.scannerDevice.update({ where: { id: scanner.id }, data: { tokenExpiresAt: new Date(Date.now() - 1000) } });
    const a = await device();
    expect(await attempt(a, { token: scanner.token })).toEqual({ ok: false, reason: "expired" });

    expect(await scanners.rotateScannerToken(scanner.id)).toBe(true);
    const fresh = await db.scannerDevice.findUniqueOrThrow({ where: { id: scanner.id } });
    expect(fresh.token).not.toBe(scanner.token);
    expect(await attempt(a, { token: scanner.token })).toEqual({ ok: false, reason: "not_found" });
    expect(await attempt(a, { token: fresh.token })).toMatchObject({ ok: true, firstBind: true });
    // once bound, the link can't be rotated out from under the phone
    expect(await scanners.rotateScannerToken(scanner.id)).toBe(false);
  });

  it("cuts off a removed device immediately, and replacing issues a working new link", async () => {
    const scanner = await newScanner();
    const a = await device();
    const bound = await attempt(a, { token: scanner.token });
    if (!bound.ok) throw new Error("expected bind");
    expect(await scanners.loadScanner({ deviceId: scanner.id, keyX: bound.keyX }, eventId)).not.toBeNull();

    const replacement = await scanners.replaceScanner(scanner.id);
    expect(await scanners.loadScanner({ deviceId: scanner.id, keyX: bound.keyX }, eventId)).toBeNull();
    expect(await attempt(a, { deviceId: scanner.id })).toEqual({ ok: false, reason: "revoked" });

    expect(replacement).toMatchObject({ label: "Gate A", staffName: "Kofi", boundAt: null });
    const b = await device();
    expect(await attempt(b, { token: replacement.token })).toMatchObject({ ok: true, firstBind: true, deviceId: replacement.id });
  });

  it("rejects a session entry whose key no longer matches the binding", async () => {
    const scanner = await newScanner();
    await attempt(await device(), { token: scanner.token });
    expect(await scanners.loadScanner({ deviceId: scanner.id, keyX: "someone-elses-key" }, eventId)).toBeNull();
  });
});
