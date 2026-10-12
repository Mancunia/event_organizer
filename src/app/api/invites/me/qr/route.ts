import QRCode from "qrcode";
import { guestSession } from "@/lib/auth";
import { getEventBySlug } from "@/lib/events";
import { loadGuestInvite } from "@/lib/invites";
import { qrUrl, signQrToken } from "@/lib/qr-token";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const event = await getEventBySlug(url.searchParams.get("slug") ?? "");
  const invite = event ? await loadGuestInvite(await guestSession(), event.id) : null;
  if (!event || !invite) return new Response("Not found", { status: 404 });

  const content = qrUrl(await signQrToken({ inviteId: invite.id, eventId: event.id }));
  const download = url.searchParams.get("download") === "1";
  const headers: Record<string, string> = { "Cache-Control": "private, no-store" };
  if (download) {
    const name = `${event.slug}-${invite.guest.name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    headers["Content-Disposition"] = `attachment; filename="${name}-invite-qr.png"`;
  }

  if (url.searchParams.get("format") === "svg" && !download) {
    const svg = await QRCode.toString(content, { type: "svg", margin: 2, errorCorrectionLevel: "M" });
    return new Response(svg, { headers: { ...headers, "Content-Type": "image/svg+xml" } });
  }
  const png = await QRCode.toBuffer(content, { type: "png", width: 1024, margin: 2, errorCorrectionLevel: "M" });
  return new Response(new Uint8Array(png), { headers: { ...headers, "Content-Type": "image/png" } });
}
