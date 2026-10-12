import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientLoginForm } from "@/components/ClientLoginForm";
import { Pill } from "@/components/bloom";
import { clientLogout } from "@/app/[slug]/guests/actions";
import { isClientFor } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEventBySlug } from "@/lib/events";
import { inviteStage, matchesFilter, rsvpLabel, summariseGuests, type GuestFilter } from "@/lib/guest-status";

export const dynamic = "force-dynamic";

const FILTERS: { value?: GuestFilter; label: string }[] = [
  { label: "Everyone" },
  { value: "attending", label: "Attending" },
  { value: "declined", label: "Not attending" },
  { value: "awaiting", label: "Awaiting reply" },
  { value: "checked-in", label: "Checked in" },
];

const plural = (n: number, one: string, many = `${one}s`, withCount = true) =>
  `${withCount ? `${n} ` : ""}${n === 1 ? one : many}`;

const time = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: process.env.EVENT_TIMEZONE ?? "Africa/Accra",
  }).format(d);

export default async function ClientGuestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  if (!(await isClientFor(event.id))) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-8">
        <header className="text-center">
          <p className="eyebrow text-cocoa-ink">Your guest list</p>
          <h1 className="mt-2 font-script text-4xl leading-tight text-slate">{event.title}</h1>
        </header>
        <ClientLoginForm slug={slug} />
      </main>
    );
  }

  const { filter: rawFilter } = await searchParams;
  const filter = FILTERS.find((f) => f.value === rawFilter)?.value;

  // Explicit select: phone numbers, invite codes and organiser notes never reach this page.
  const guests = await db.guest.findMany({
    where: { eventId: event.id },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      partySize: true,
      invite: {
        select: { sentAt: true, sendStatus: true, claimedAt: true, checkedInAt: true, rsvpStatus: true, rsvpCount: true },
      },
    },
  });
  const summary = summariseGuests(guests);
  const shown = guests.filter((g) => matchesFilter(g, filter));

  const stats = [
    ["Invites", summary.guests, plural(summary.invitedPeople, "person", "people")],
    ["Attending", summary.attendingPeople, `people · ${plural(summary.attendingGuests, "invite")}`],
    ["Not attending", summary.declined, plural(summary.declined, "invite", "invites", false)],
    ["Awaiting reply", summary.awaiting, plural(summary.awaiting, "invite", "invites", false)],
    ["Checked in", summary.checkedIn, plural(summary.checkedIn, "invite", "invites", false)],
  ] as const;

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-cocoa-ink">Your guest list</p>
          <h1 className="mt-1 font-script text-4xl leading-tight text-slate">{event.title}</h1>
        </div>
        <form action={clientLogout.bind(null, slug)}>
          <button className="text-sm text-ink-muted hover:text-ink">Sign out</button>
        </form>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map(([label, value, sub]) => (
          <div key={label} className="card p-4">
            <dt className="label">{label}</dt>
            <dd className="text-3xl font-semibold text-slate">{value}</dd>
            <dd className="text-xs text-ink-muted">{sub}</dd>
          </div>
        ))}
      </dl>

      <nav aria-label="Filter guests" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.label}
            href={f.value ? `/${slug}/guests?filter=${f.value}` : `/${slug}/guests`}
            aria-current={f.value === filter ? "page" : undefined}
            className={`btn-sm ${f.value === filter ? "btn" : "btn-ghost"}`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      <section className="card p-0!">
        <ul className="divide-y divide-hairline">
          {shown.map((guest) => {
            const stage = inviteStage(guest.invite);
            const rsvp = rsvpLabel(guest.invite, guest.partySize);
            return (
              <li key={guest.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-ink">{guest.name}</p>
                  <p className="text-xs text-ink-muted">
                    Party of {guest.partySize}
                    {guest.invite?.checkedInAt && ` · checked in at ${time(guest.invite.checkedInAt)}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Pill tone={stage.tone}>Invite: {stage.label}</Pill>
                  <Pill tone={rsvp.tone}>{rsvp.label}</Pill>
                </div>
              </li>
            );
          })}
        </ul>
        {shown.length === 0 && (
          <p className="p-6 text-center text-sm text-ink-muted">{guests.length ? "No guests match this filter." : "No guests yet."}</p>
        )}
      </section>
    </main>
  );
}
