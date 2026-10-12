import { notFound } from "next/navigation";
import { EventHeader } from "@/components/EventHeader";
import { ClaimForm } from "@/components/ClaimForm";
import { getEventBySlug } from "@/lib/events";

export default async function ClaimPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ code?: string }>;
}) {
  const { slug } = await params;
  const { code } = await searchParams;
  const event = await getEventBySlug(slug);
  if (!event) notFound();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-10 px-4 py-16">
      <EventHeader event={event} compact />
      <ClaimForm slug={slug} initialCode={code ?? ""} />
    </main>
  );
}
