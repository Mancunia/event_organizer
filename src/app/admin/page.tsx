import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth";
import { eventKind } from "@/lib/event-kinds";
import { formatEventDate } from "@/lib/events";
import { AdminShell } from "@/components/admin/AdminShell";
import { EventForm } from "@/components/admin/EventForm";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  if (!(await isAdmin())) redirect("/admin/login");
  const events = await db.event.findMany({ orderBy: { date: "asc" }, include: { _count: { select: { guests: true } } } });

  return (
    <AdminShell>
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Events</h1>
        {events.length === 0 && <p className="text-sm text-ink-muted">No events yet. Create the first one below.</p>}
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => (
            <li key={e.id}>
              <Link href={`/admin/events/${e.id}`} className="card block transition hover:-translate-y-0.5 hover:border-cocoa">
                <p className="font-script text-3xl leading-tight text-slate">{e.title}</p>
                <p className="mt-1 text-sm text-ink-muted">
                  {eventKind(e.kind).label} · {formatEventDate(e.date)}
                </p>
                <p className="mt-3 text-sm">
                  {e._count.guests} guest{e._count.guests === 1 ? "" : "s"} · /{e.slug}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="card space-y-4">
        <h2 className="text-xl font-semibold">New event</h2>
        <EventForm />
      </section>
    </AdminShell>
  );
}
