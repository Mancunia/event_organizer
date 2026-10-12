import { notFound } from "next/navigation";
import { EventHeader } from "@/components/EventHeader";
import { Pill } from "@/components/bloom";
import { DeviceReauth } from "@/components/DeviceReauth";
import { RsvpForm } from "@/components/RsvpForm";
import { guestSession } from "@/lib/auth";
import { calendarDetails, googleCalendarUrl } from "@/lib/calendar";
import { formatCode } from "@/lib/codes";
import { getEventBySlug } from "@/lib/events";
import { loadGuestInvite } from "@/lib/invites";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { slug } = await params;
  const { welcome } = await searchParams;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const invite = await loadGuestInvite(await guestSession(), event.id);
  if (!invite) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-10 px-4 py-16">
        <EventHeader event={event} compact />
        <DeviceReauth slug={slug} />
      </main>
    );
  }

  const qrSrc = `/api/invites/me/qr?slug=${encodeURIComponent(slug)}`;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-8 px-4 py-12 print:py-0">
      {welcome && (
        <p className="mx-auto print:hidden">
          <Pill tone="attending">
          Your invite is now secured to this device</Pill>
        </p>
      )}
      <article className="card isolate space-y-6 overflow-hidden text-center print:border-0 print:shadow-none">
        <span aria-hidden="true" className="absolute -top-8 -right-8 -z-10 size-24 rounded-full bg-petal" />
        <EventHeader event={event} compact />
        <div>
          <p className="eyebrow text-cocoa-ink">Admit</p>
          <p className="mt-2 text-xl font-semibold text-ink">{invite.guest.name}</p>
          {invite.guest.partySize > 1 && <p className="text-sm text-ink-muted">Party of {invite.guest.partySize}</p>}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${qrSrc}&format=svg`} alt="Your entry QR code" className="mx-auto aspect-square w-60 rounded-[14px] bg-white p-3" />
        <div>
          <p className="label">Invite code</p>
          <p className="font-mono text-xl tracking-[0.25em] text-slate">{formatCode(invite.code)}</p>
        </div>
        {invite.checkedInAt && (
          <div className="space-y-1">
            <Pill tone="attending">Checked in</Pill>
            <p className="script-accent text-cocoa">enjoy the celebration!</p>
          </div>
        )}
      </article>
      <div className="print:hidden">
        <RsvpForm
          slug={slug}
          partySize={invite.guest.partySize}
          current={{ status: invite.rsvpStatus, count: invite.rsvpCount }}
          closed={event.date.getTime() < Date.now()}
        />
      </div>
      <div className="flex flex-col gap-3 print:hidden">
        <a href={`${qrSrc}&download=1`} className="btn">
          Download QR code
        </a>
        <a href={googleCalendarUrl(calendarDetails(event, invite.guest))} target="_blank" rel="noreferrer" className="btn-soft">
          Add to Google Calendar
        </a>
        <a href={`/api/invites/me/calendar?slug=${encodeURIComponent(slug)}`} className="btn-soft">
          Add to Apple / Outlook calendar
        </a>
        {event.mapUrl && (
          <a href={event.mapUrl} target="_blank" rel="noreferrer" className="btn-soft">
            Get directions
          </a>
        )}
        <p className="text-center text-xs text-ink-muted">
          Show this QR code, or tell the usher your invite code, when you arrive.
        </p>
      </div>
    </main>
  );
}
