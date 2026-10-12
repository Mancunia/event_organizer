import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { currentScanner, isAdmin } from "@/lib/auth";
import { getEventBySlug } from "@/lib/events";
import { staffLookup } from "@/lib/invites";
import { touchScanner } from "@/lib/scanners";

const body = z.object({ slug: z.string(), inviteId: z.string() });

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const event = await getEventBySlug(parsed.data.slug);
  const scanner = event ? await currentScanner(event.id) : null;
  if (!event || (!scanner && !(await isAdmin()))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const updated = await db.invite.updateMany({
    where: { id: parsed.data.inviteId, checkedInAt: null, guest: { eventId: event.id } },
    data: { checkedInAt: new Date(), checkedInById: scanner?.id ?? null },
  });
  if (updated.count === 1) {
    await audit("invite.checked_in", { eventId: event.id, inviteId: parsed.data.inviteId, meta: { deviceId: scanner?.id ?? "admin" } });
  }
  if (scanner) await touchScanner(scanner.id);

  const guest = await staffLookup({ inviteId: parsed.data.inviteId }, event.id);
  if (!guest) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ guest, alreadyCheckedIn: updated.count === 0 });
}
