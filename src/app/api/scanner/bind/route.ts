import { NextResponse } from "next/server";
import { z } from "zod";
import { staffSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getEventBySlug } from "@/lib/events";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { refKey, scannerMessages, scannerRefSchema } from "@/lib/scanner-api";
import { bindScanner } from "@/lib/scanners";

const body = z.object({
  slug: z.string(),
  ref: scannerRefSchema,
  nonce: z.string().max(100),
  signature: z.string().max(200),
  publicJwk: z.unknown(),
});

const statusFor = { claimed_elsewhere: 409, bad_signature: 401, invalid: 400, not_found: 404, revoked: 410, expired: 410 } as const;

/** Binds this browser's key to the scanner (first visit) or proves it still holds it (re-auth), then signs it in. */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: scannerMessages.invalid, reason: "invalid" }, { status: 400 });

  const ip = await clientIp();
  if (!(await rateLimit(`scanner-bind:ip:${ip}`, 20, 600)) || !(await rateLimit(`scanner-bind:${refKey(parsed.data.ref)}`, 10, 600))) {
    return NextResponse.json({ error: "Too many attempts. Please wait a few minutes." }, { status: 429 });
  }

  const event = await getEventBySlug(parsed.data.slug);
  if (!event) return NextResponse.json({ error: scannerMessages.not_found, reason: "not_found" }, { status: 404 });

  const result = await bindScanner({
    eventId: event.id,
    ref: parsed.data.ref,
    nonce: parsed.data.nonce,
    signature: parsed.data.signature,
    publicJwk: parsed.data.publicJwk,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!result.ok) return NextResponse.json({ error: scannerMessages[result.reason], reason: result.reason }, { status: statusFor[result.reason] });

  const session = await staffSession();
  const others = (session.scanners ?? []).filter((s) => s.eventId !== event.id);
  session.scanners = [...others, { eventId: event.id, deviceId: result.deviceId, keyX: result.keyX }];
  await session.save();
  if (!result.firstBind) await audit("scanner.reauth", { eventId: event.id, meta: { deviceId: result.deviceId } });
  return NextResponse.json({ ok: true, deviceId: result.deviceId, firstBind: result.firstBind });
}
