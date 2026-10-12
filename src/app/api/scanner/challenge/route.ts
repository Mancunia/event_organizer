import { NextResponse } from "next/server";
import { z } from "zod";
import { getEventBySlug } from "@/lib/events";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { scannerMessages, scannerRefSchema } from "@/lib/scanner-api";
import { issueScannerChallenge } from "@/lib/scanners";

const body = z.object({ slug: z.string(), ref: scannerRefSchema });

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: scannerMessages.not_found, reason: "not_found" }, { status: 400 });

  if (!(await rateLimit(`scanner-challenge:ip:${await clientIp()}`, 20, 600))) {
    return NextResponse.json({ error: "Too many attempts. Please wait a few minutes." }, { status: 429 });
  }

  const event = await getEventBySlug(parsed.data.slug);
  const result = event ? await issueScannerChallenge(event.id, parsed.data.ref) : ({ ok: false, reason: "not_found" } as const);
  if (!result.ok) {
    return NextResponse.json({ error: scannerMessages[result.reason], reason: result.reason }, { status: result.reason === "not_found" ? 404 : 410 });
  }
  return NextResponse.json({ nonce: result.nonce, deviceId: result.deviceId });
}
