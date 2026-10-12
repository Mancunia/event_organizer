import { notFound } from "next/navigation";
import { Scanner } from "@/components/Scanner";
import { ScannerGate } from "@/components/ScannerGate";
import { isStaffFor } from "@/lib/auth";
import { getEventBySlug } from "@/lib/events";

export const dynamic = "force-dynamic";

export default async function VerifyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ scan?: string }>;
}) {
  const { slug } = await params;
  const { scan } = await searchParams;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-8">
      <header className="text-center">
        <p className="eyebrow text-cocoa-ink">Guest check-in</p>
        <h1 className="mt-2 font-script text-4xl leading-tight text-slate">{event.title}</h1>
      </header>
      {(await isStaffFor(event.id)) ? <Scanner slug={slug} initialScan={scan} /> : <ScannerGate slug={slug} />}
    </main>
  );
}
