import type { SafeEvent } from "@/lib/events";
import { ArchFrame, BloomStem, Flourish, Pill, initials } from "@/components/bloom";
import { eventCopy } from "@/lib/event-kinds";
import { eventPhotos, formatEventDate, parseTheme } from "@/lib/events";

export function EventHeader({ event, compact = false }: { event: SafeEvent; compact?: boolean }) {
  const theme = parseTheme(event.theme);
  const copy = eventCopy(event);
  const venue = event.mapUrl ? (
    <a href={event.mapUrl} target="_blank" rel="noreferrer" className="link">
      {event.venue}
    </a>
  ) : (
    event.venue
  );

  if (compact) {
    return (
      <header className="text-center">
        <p className="script-accent text-cocoa">{copy.eyebrow}</p>
        <h1 className="mt-1 font-script text-5xl leading-tight text-slate">{event.title}</h1>
        <Flourish width={120} className="my-4" />
        <p className="text-sm text-ink-muted">{formatEventDate(event.date)}</p>
        <p className="text-sm text-ink-muted">{venue}</p>
      </header>
    );
  }

  return (
    <header className="flex flex-col items-center text-center">
      <p className="script-heading text-cocoa">{copy.eyebrow}</p>
      <Flourish width={180} className="mt-3 mb-8" />
      <div className="relative">
        {copy.florals && <BloomStem width={96} className="absolute -bottom-2 -left-14 z-20 -rotate-12" />}
        <ArchFrame src={eventPhotos(theme)[0]} alt={`${event.title}`} initials={initials(event.title)} />
      </div>
      <h1 className="names mt-10 text-slate max-sm:text-5xl">{event.title}</h1>
      <p className="mt-6 max-w-[46ch] leading-relaxed text-ink-muted">
        {copy.inviteLine}
      </p>
      <div className="mt-8 flex flex-col items-center gap-2">
        <Pill tone="stamp">Save the date</Pill>
        <p className="mt-2 font-medium text-ink">{formatEventDate(event.date)}</p>
        <p className="text-ink-muted">{venue}</p>
      </div>
    </header>
  );
}
