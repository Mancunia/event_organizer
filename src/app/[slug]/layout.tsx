import { notFound } from "next/navigation";
import { Backdrop } from "@/components/backdrop";
import { eventKind } from "@/lib/event-kinds";
import { getEventBySlug, parseTheme, themeOverrideCss } from "@/lib/events";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const event = await getEventBySlug((await params).slug);
  return { title: event ? `${event.title} — ${eventKind(event.kind).label}` : "Invitation" };
}

export default async function EventLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const event = await getEventBySlug((await params).slug);
  if (!event) notFound();
  const theme = parseTheme(event.theme);
  const css = themeOverrideCss(theme);
  return (
    <div className="event-theme relative isolate min-h-dvh overflow-x-clip bg-paper">
      {css && <style>{css}</style>}
      <Backdrop theme={theme} />
      <div className="relative">{children}</div>
    </div>
  );
}
