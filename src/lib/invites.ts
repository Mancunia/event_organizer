import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { audit } from "./audit";
import { env } from "./env";
import { generateCode, formatCode } from "./codes";
import { claimMessage, publicJwkSchema, sameKey, verifyDeviceSignature, type DevicePublicJwk } from "./device-crypto";
import { whatsapp } from "./whatsapp";
import type { RsvpStatus } from "./guest-status";

const NONCE_TTL_MS = 2 * 60 * 1000;

export async function issueChallenge(eventId: string, code: string) {
  const invite = await db.invite.findFirst({ where: { code, guest: { eventId } }, select: { id: true } });
  if (!invite) return null;
  const nonce = await db.nonce.create({
    data: { inviteId: invite.id, value: randomBytes(24).toString("base64url"), expiresAt: new Date(Date.now() + NONCE_TTL_MS) },
  });
  return nonce.value;
}

export type ClaimResult =
  | { ok: true; inviteId: string; eventId: string; keyX: string; firstClaim: boolean }
  | { ok: false; reason: "invalid" | "bad_signature" | "claimed_elsewhere" };

/**
 * Binds the invite to the device that signed the challenge, or re-authenticates the device that
 * already holds it. The first device to claim wins; every other key is refused from then on.
 */
export async function claimInvite(input: {
  eventId: string;
  code: string;
  nonce: string;
  signature: string;
  publicJwk: unknown;
  userAgent?: string;
}): Promise<ClaimResult> {
  const parsed = publicJwkSchema.safeParse(input.publicJwk);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const jwk = parsed.data;

  const invite = await db.invite.findFirst({
    where: { code: input.code, guest: { eventId: input.eventId } },
    select: { id: true, devicePublicKey: true },
  });
  if (!invite) return { ok: false, reason: "invalid" };

  // Single use: only the first request presenting this nonce gets to use it.
  const consumed = await db.nonce.updateMany({
    where: { value: input.nonce, inviteId: invite.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (consumed.count !== 1) return { ok: false, reason: "invalid" };

  if (!(await verifyDeviceSignature(jwk, claimMessage(input.code, input.nonce), input.signature))) {
    return { ok: false, reason: "bad_signature" };
  }

  const success = (firstClaim: boolean): ClaimResult => ({
    ok: true,
    inviteId: invite.id,
    eventId: input.eventId,
    keyX: jwk.x,
    firstClaim,
  });

  if (invite.devicePublicKey) {
    return sameKey(invite.devicePublicKey as DevicePublicJwk, jwk) ? success(false) : { ok: false, reason: "claimed_elsewhere" };
  }

  // Guarded update: if another device bound the invite since we read it, this matches zero rows.
  const bound = await db.invite.updateMany({
    where: { id: invite.id, claimedAt: null },
    data: { devicePublicKey: jwk, claimedAt: new Date(), claimUserAgent: input.userAgent?.slice(0, 300) },
  });
  if (bound.count !== 1) {
    const current = await db.invite.findUnique({ where: { id: invite.id }, select: { devicePublicKey: true } });
    return current?.devicePublicKey && sameKey(current.devicePublicKey as DevicePublicJwk, jwk)
      ? success(false)
      : { ok: false, reason: "claimed_elsewhere" };
  }

  await audit("invite.claimed", { eventId: input.eventId, inviteId: invite.id });
  return success(true);
}

/** Session is only valid while the invite is still bound to the same key it was issued for. */
export async function loadGuestInvite(session: { inviteId?: string; eventId?: string; keyX?: string }, eventId: string) {
  if (!session.inviteId || session.eventId !== eventId || !session.keyX) return null;
  const invite = await db.invite.findUnique({ where: { id: session.inviteId }, include: { guest: true } });
  const key = invite?.devicePublicKey as DevicePublicJwk | null | undefined;
  if (!invite || !key || key.x !== session.keyX) return null;
  return invite;
}

export async function resetDeviceBinding(inviteId: string) {
  const invite = await db.invite.update({
    where: { id: inviteId },
    data: { devicePublicKey: Prisma.DbNull, claimedAt: null, claimUserAgent: null },
    include: { guest: true },
  });
  await audit("invite.binding_reset", { eventId: invite.guest.eventId, inviteId });
}

/** Saves the guest's reply. Attending counts are clamped to the party size; declining records 0. */
export async function recordRsvp(inviteId: string, status: RsvpStatus, count?: number) {
  const invite = await db.invite.findUniqueOrThrow({ where: { id: inviteId }, include: { guest: true } });
  const { partySize, eventId } = invite.guest;
  const rsvpCount = status === "declined" ? 0 : Math.min(Math.max(count ?? partySize, 1), partySize);
  const updated = await db.invite.update({
    where: { id: inviteId },
    data: { rsvpStatus: status, rsvpCount, rsvpAt: new Date() },
  });
  await audit("invite.rsvp", { eventId, inviteId, meta: { status, count: rsvpCount } });
  return updated;
}

export async function createInviteForGuest(guestId: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await db.invite.create({ data: { guestId, code: generateCode() } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && attempt < 4) continue;
      throw e;
    }
  }
  throw new Error("unreachable");
}

export function claimUrl(eventSlug: string, code: string) {
  return `${env.appUrl}/${eventSlug}/claim?code=${code}`;
}

export async function sendInvite(inviteId: string) {
  const invite = await db.invite.findUniqueOrThrow({
    where: { id: inviteId },
    include: { guest: { include: { event: { omit: { waAccessTokenEnc: false } } } } },
  });
  const { guest } = invite;
  const { event } = guest;
  try {
    const { messageId } = await whatsapp(event).sendInvite({
      to: guest.phone,
      guestName: guest.name,
      title: event.title,
      code: formatCode(invite.code),
      claimUrl: claimUrl(event.slug, invite.code),
      templateName: event.messageTemplateName,
      language: event.templateLanguage,
    });
    await db.invite.update({
      where: { id: inviteId },
      data: { sentAt: new Date(), sendStatus: "sent", sendError: null, waMessageId: messageId },
    });
    await audit("invite.sent", { eventId: event.id, inviteId });
    return { ok: true as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.invite.update({ where: { id: inviteId }, data: { sendStatus: "failed", sendError: message.slice(0, 500) } });
    return { ok: false as const, error: message };
  }
}

export type StaffView = {
  inviteId: string;
  guestName: string;
  partySize: number;
  code: string;
  claimed: boolean;
  checkedInAt: string | null;
  notes: string | null;
};

export async function staffLookup(where: { inviteId: string } | { code: string }, eventId: string): Promise<StaffView | null> {
  const invite = await db.invite.findFirst({
    where: { ...("inviteId" in where ? { id: where.inviteId } : { code: where.code }), guest: { eventId } },
    include: { guest: true },
  });
  if (!invite) return null;
  return {
    inviteId: invite.id,
    guestName: invite.guest.name,
    partySize: invite.guest.partySize,
    code: formatCode(invite.code),
    claimed: invite.claimedAt !== null,
    checkedInAt: invite.checkedInAt?.toISOString() ?? null,
    notes: invite.guest.notes,
  };
}
