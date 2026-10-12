import Link from "next/link";
import { notFound } from "next/navigation";
import { EventHeader } from "@/components/EventHeader";
import { PhotoStrip } from "@/components/backdrop";
import { eventPhotos, getEventBySlug, parseTheme } from "@/lib/events";

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-10 px-4 py-16">
      <EventHeader event={event} />
      {/* The first photo is already in the arch portrait. */}
      <PhotoStrip photos={eventPhotos(parseTheme(event.theme)).slice(1)} title={event.title} />
      {event.message && <p className="mx-auto max-w-[46ch] whitespace-pre-line text-center leading-relaxed text-ink">{event.message}</p>}
      <div className="flex flex-col items-center gap-3">
        <Link href={`/${slug}/claim`} className="btn">
          <span className="btn-dot" aria-hidden="true" />
          I have an invite code
        </Link>
        <Link href={`/${slug}/invite`} className="btn-ghost">
          View my invite
        </Link>
        <p className="script-accent mt-4 text-cocoa">see you there!</p>
      </div>
    </main>
  );
}
