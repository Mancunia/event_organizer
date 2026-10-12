import { NextResponse } from "next/server";
import { z } from "zod";
import { guestSession } from "@/lib/auth";
import { normalizeCode } from "@/lib/codes";
import { getEventBySlug } from "@/lib/events";
import { claimInvite } from "@/lib/invites";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const body = z.object({
  slug: z.string(),
  code: z.string(),
  nonce: z.string().max(100),
  signature: z.string().max(200),
  publicJwk: z.unknown(),
});

const messages = {
  invalid: "This request expired or the code is wrong. Please try again.",
  bad_signature: "We couldn't verify this device. Please try again.",
  claimed_elsewhere: "This invite has already been claimed on another device. If that wasn't you, contact the organiser.",
} as const;

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  const code = parsed.success ? normalizeCode(parsed.data.code) : null;
  if (!parsed.success || !code) return NextResponse.json({ error: messages.invalid }, { status: 400 });

  const ip = await clientIp();
  if (!(await rateLimit(`claim:ip:${ip}`, 20, 600)) || !(await rateLimit(`claim:code:${code}`, 10, 600))) {
    return NextResponse.json({ error: "Too many attempts. Please wait a few minutes." }, { status: 429 });
  }

  const event = await getEventBySlug(parsed.data.slug);
  if (!event) return NextResponse.json({ error: messages.invalid }, { status: 404 });

  const result = await claimInvite({
    eventId: event.id,
    code,
    nonce: parsed.data.nonce,
    signature: parsed.data.signature,
    publicJwk: parsed.data.publicJwk,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  if (!result.ok) {
    const status = result.reason === "claimed_elsewhere" ? 409 : result.reason === "bad_signature" ? 401 : 400;
    return NextResponse.json({ error: messages[result.reason], reason: result.reason }, { status });
  }

  const session = await guestSession();
  session.inviteId = result.inviteId;
  session.eventId = result.eventId;
  session.keyX = result.keyX;
  await session.save();
  return NextResponse.json({ ok: true, firstClaim: result.firstClaim });
}
