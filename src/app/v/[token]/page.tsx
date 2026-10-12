import { redirect } from "next/navigation";
import { Flourish } from "@/components/bloom";
import { db } from "@/lib/db";
import { isStaffFor } from "@/lib/auth";
import { verifyQrToken } from "@/lib/qr-token";

export const dynamic = "force-dynamic";

/** Where a QR pass lands when scanned with a regular phone camera instead of the in-app scanner. */
export default async function QrLanding({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const payload = await verifyQrToken(token);
  const event = payload ? await db.event.findUnique({ where: { id: payload.eventId } }) : null;

  if (!payload || !event) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center px-4 text-center">
        <p className="alert">This is not a valid invitation pass.</p>
      </main>
    );
  }

  if (await isStaffFor(event.id)) redirect(`/${event.slug}/verify?scan=${encodeURIComponent(token)}`);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="eyebrow text-cocoa-ink">Invitation pass</p>
      <h1 className="font-script text-5xl leading-tight text-slate">{event.title}</h1>
      <Flourish width={120} />
      <p className="text-sm text-ink-muted">Please present this pass to an usher at the entrance.</p>
    </main>
  );
}
