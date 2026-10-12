import { NextResponse } from "next/server";
import { z } from "zod";
import { currentScanner, isAdmin } from "@/lib/auth";
import { normalizeCode } from "@/lib/codes";
import { getEventBySlug } from "@/lib/events";
import { staffLookup } from "@/lib/invites";
import { extractQrToken, verifyQrToken } from "@/lib/qr-token";
import { touchScanner } from "@/lib/scanners";

const body = z.object({ slug: z.string(), scanned: z.string().max(2000) });

/** Accepts either a scanned QR (URL or token) or a manually typed invite code. */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const event = await getEventBySlug(parsed.data.slug);
  const scanner = event ? await currentScanner(event.id) : null;
  if (!event || (!scanner && !(await isAdmin()))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (scanner) await touchScanner(scanner.id);

  const token = extractQrToken(parsed.data.scanned);
  if (token) {
    const payload = await verifyQrToken(token);
    if (!payload) return NextResponse.json({ valid: false, error: "This QR code is not a genuine invite." });
    if (payload.eventId !== event.id) return NextResponse.json({ valid: false, error: "This QR code is for a different event." });
    const guest = await staffLookup({ inviteId: payload.inviteId }, event.id);
    if (!guest) return NextResponse.json({ valid: false, error: "This invite has been removed." });
    return NextResponse.json({ valid: true, method: "qr", guest });
  }

  const code = normalizeCode(parsed.data.scanned);
  const guest = code ? await staffLookup({ code }, event.id) : null;
  if (!guest) return NextResponse.json({ valid: false, error: "No invite found for that code." });
  return NextResponse.json({ valid: true, method: "code", guest });
}
