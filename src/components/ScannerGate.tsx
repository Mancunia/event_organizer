"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { bindScannerDevice, storedScannerId } from "@/lib/device-keys.client";

/** Shown on the check-in page when this browser isn't signed in: re-proves a stored scanner key, or explains how to get set up. */
export function ScannerGate({ slug }: { slug: string }) {
  const router = useRouter();
  const [state, setState] = useState<{ kind: "checking" } | { kind: "none" } | { kind: "error"; message: string }>({
    kind: "checking",
  });

  useEffect(() => {
    (async () => {
      const deviceId = await storedScannerId(slug);
      if (!deviceId) return setState({ kind: "none" });
      const result = await bindScannerDevice(slug, { deviceId });
      if (result.ok) return router.refresh();
      setState({ kind: "error", message: result.error });
    })();
  }, [slug, router]);

  if (state.kind === "checking") return <p className="text-center text-sm text-ink-muted">Opening the scanner…</p>;

  return (
    <div className="card space-y-3 text-center">
      <p className="eyebrow text-cocoa-ink">Not set up</p>
      <p className="text-ink">
        {state.kind === "error" ? state.message : "This phone isn’t set up as a check-in scanner for this event."}
      </p>
      {state.kind === "none" && (
        <p className="text-sm text-ink-muted">
          Ask the organiser to send you a scanner link on WhatsApp, then open it on the phone you’ll use at the door.
        </p>
      )}
    </div>
  );
}
