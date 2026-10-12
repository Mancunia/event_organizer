import { guestSession } from "@/lib/auth";
import { buildIcs, calendarDetails } from "@/lib/calendar";
import { getEventBySlug } from "@/lib/events";
import { loadGuestInvite } from "@/lib/invites";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const event = await getEventBySlug(url.searchParams.get("slug") ?? "");
  const invite = event ? await loadGuestInvite(await guestSession(), event.id) : null;
  if (!event || !invite) return new Response("Not found", { status: 404 });

  const ics = buildIcs(calendarDetails(event, invite.guest));
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
