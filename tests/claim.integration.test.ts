import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { claimMessage, publicJwkSchema } from "@/lib/device-crypto";

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

run("claiming an invite (database)", { timeout: 60_000 }, async () => {
  const { db } = await import("@/lib/db");
  const { claimInvite, createInviteForGuest, issueChallenge, recordRsvp, resetDeviceBinding } = await import("@/lib/invites");
  let eventId: string;

  beforeAll(async () => {
    const event = await db.event.create({
      data: {
        slug: `test-${Date.now()}`,
        title: "Test & Test",
        date: new Date(),
        venue: "Test venue",
      },
    });
    eventId = event.id;
  });

  afterAll(async () => {
    await db.event.delete({ where: { id: eventId } });
    await db.$disconnect();
  });

  let phoneSeq = 0;
  async function newInvite(partySize = 1) {
    const phone = `+2332${(Date.now() % 1e7) * 10 + (phoneSeq++ % 10)}`;
    const guest = await db.guest.create({ data: { eventId, name: "Guest", phone, partySize } });
    return createInviteForGuest(guest.id);
  }

  async function attempt(d: Awaited<ReturnType<typeof device>>, code: string) {
    const nonce = (await issueChallenge(eventId, code))!;
    return claimInvite({ eventId, code, nonce, signature: await d.sign(claimMessage(code, nonce)), publicJwk: d.publicJwk });
  }

  it("binds to the first device and refuses every other device", async () => {
    const invite = await newInvite();
    const [a, b] = await Promise.all([device(), device()]);

    expect(await attempt(a, invite.code)).toMatchObject({ ok: true, firstClaim: true });
    expect(await attempt(b, invite.code)).toEqual({ ok: false, reason: "claimed_elsewhere" });
    // the original device can keep coming back
    expect(await attempt(a, invite.code)).toMatchObject({ ok: true, firstClaim: false });
  });

  it("lets exactly one of several racing devices win", async () => {
    const invite = await newInvite();
    const devices = await Promise.all(Array.from({ length: 5 }, device));
    const results = await Promise.all(devices.map((d) => attempt(d, invite.code)));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.reason === "claimed_elsewhere")).toHaveLength(4);
  });

  it("refuses a replayed nonce and a forged signature", async () => {
    const invite = await newInvite();
    const [a, b] = await Promise.all([device(), device()]);
    const nonce = (await issueChallenge(eventId, invite.code))!;
    const signature = await a.sign(claimMessage(invite.code, nonce));
    const first = await claimInvite({ eventId, code: invite.code, nonce, signature, publicJwk: a.publicJwk });
    expect(first.ok).toBe(true);
    const replay = await claimInvite({ eventId, code: invite.code, nonce, signature, publicJwk: a.publicJwk });
    expect(replay).toEqual({ ok: false, reason: "invalid" });

    const other = await newInvite();
    const n2 = (await issueChallenge(eventId, other.code))!;
    const forged = await claimInvite({
      eventId,
      code: other.code,
      nonce: n2,
      signature: await b.sign(claimMessage(other.code, n2)),
      publicJwk: a.publicJwk,
    });
    expect(forged).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("allows a new device after the organiser resets the binding", async () => {
    const invite = await newInvite();
    const [a, b] = await Promise.all([device(), device()]);
    expect((await attempt(a, invite.code)).ok).toBe(true);
    await resetDeviceBinding(invite.id);
    expect(await attempt(b, invite.code)).toMatchObject({ ok: true, firstClaim: true });
    expect(await attempt(a, invite.code)).toEqual({ ok: false, reason: "claimed_elsewhere" });
  });

  it("records RSVPs, clamping the attending count to the party size", async () => {
    const invite = await newInvite(3);
    expect(await recordRsvp(invite.id, "attending", 10)).toMatchObject({ rsvpStatus: "attending", rsvpCount: 3 });
    expect(await recordRsvp(invite.id, "attending", 2)).toMatchObject({ rsvpStatus: "attending", rsvpCount: 2 });
    expect(await recordRsvp(invite.id, "attending")).toMatchObject({ rsvpCount: 3 });
    const declined = await recordRsvp(invite.id, "declined", 2);
    expect(declined).toMatchObject({ rsvpStatus: "declined", rsvpCount: 0 });
    expect(declined.rsvpAt).toBeInstanceOf(Date);
  });
});
