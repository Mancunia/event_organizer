import Link from "next/link";
import { Flourish, PageDiscs } from "@/components/bloom";

export default function Home() {
  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden px-4 text-center">
      <PageDiscs />
      <div className="relative flex max-w-md flex-col items-center gap-6">
        <p className="eyebrow text-cocoa-ink">Event invitations</p>
        <p className="script-heading text-cocoa">You&apos;re invited</p>
        <Flourish />
        <h1 className="text-xl leading-relaxed font-medium text-ink">Open the link in your invitation message to view your invite.</h1>
        <Link href="/admin" className="link text-sm">
          Organiser sign in
        </Link>
      </div>
    </main>
  );
}
