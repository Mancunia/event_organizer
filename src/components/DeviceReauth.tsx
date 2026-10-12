"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { claimWithDevice, storedCode } from "@/lib/device-keys.client";

/** Silently re-proves device ownership when the short-lived session cookie has expired. */
export function DeviceReauth({ slug }: { slug: string }) {
  const router = useRouter();
  const [state, setState] = useState<{ kind: "checking" } | { kind: "none" } | { kind: "error"; message: string }>({
    kind: "checking",
  });

  useEffect(() => {
    (async () => {
      const code = await storedCode(slug);
      if (!code) return setState({ kind: "none" });
      const result = await claimWithDevice(slug, code);
      if (result.ok) return router.refresh();
      setState({ kind: "error", message: result.error });
    })();
  }, [slug, router]);

  if (state.kind === "checking") return <p className="text-center text-sm text-ink-muted">Opening your invite…</p>;

  return (
    <div className="card space-y-4 text-center">
      <p className="text-sm text-ink">
        {state.kind === "error" ? state.message : "We couldn't find an invite on this device."}
      </p>
      <Link href={`/${slug}/claim`} className="btn">
        Enter my invite code
      </Link>
    </div>
  );
}
