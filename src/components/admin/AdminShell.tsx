import Link from "next/link";
import { logout } from "@/app/admin/actions";

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-paper">
      <nav className="border-b border-hairline bg-paper-raised">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/admin" className="font-script text-2xl text-slate">
            Invitations
          </Link>
          <form action={logout}>
            <button className="text-sm text-ink-muted hover:text-ink">Sign out</button>
          </form>
        </div>
      </nav>
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">{children}</main>
    </div>
  );
}
