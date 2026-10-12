import { notFound } from "next/navigation";
import { ScannerSetup } from "@/components/ScannerSetup";
import { db } from "@/lib/db";
import { formatEventDate, getEventBySlug } from "@/lib/events";
import { scannerMessages } from "@/lib/scanner-api";

export const dynamic = "force-dynamic";

/** Landing page for the pairing link sent to a staff member over WhatsApp. */
export default async function ScannerSetupPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { slug } = await params;
  const { t } = await searchParams;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const device = t ? await db.scannerDevice.findFirst({ where: { token: t, eventId: event.id } }) : null;
  const problem = !device
    ? scannerMessages.not_found
    : device.revokedAt
      ? scannerMessages.revoked
      : !device.boundAt && device.tokenExpiresAt <= new Date()
        ? scannerMessages.expired
        : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-8">
      <header className="text-center">
        <p className="eyebrow text-cocoa-ink">Check-in scanner setup</p>
        <h1 className="mt-2 font-script text-4xl leading-tight text-slate">{event.title}</h1>
      </header>
      {problem || !device || !t ? (
        <div className="card text-center">
          <p role="alert" className="text-ink">
            {problem}
          </p>
        </div>
      ) : (
        <ScannerSetup
          slug={slug}
          token={t}
          deviceId={device.id}
          alreadyBound={device.boundAt !== null}
          title={event.title}
          label={device.label}
          staffName={device.staffName}
          when={formatEventDate(event.date)}
          venue={event.venue}
        />
      )}
    </main>
  );
}
