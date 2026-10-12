"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { claimWithDevice, storedCode } from "@/lib/device-keys.client";

export function ClaimForm({ slug, initialCode }: { slug: string; initialCode: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [status, setStatus] = useState<"checking" | "idle" | "working">("checking");
  const [error, setError] = useState<string | null>(null);

  // A device that already holds this invite goes straight through.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await storedCode(slug);
      if (saved && (!initialCode || initialCode.toUpperCase().replace(/[\s-]/g, "") === saved)) {
        const result = await claimWithDevice(slug, saved);
        if (result.ok) return router.replace(`/${slug}/invite`);
      }
      if (!cancelled) setStatus("idle");
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, initialCode, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("working");
    setError(null);
    const result = await claimWithDevice(slug, code);
    if (result.ok) return router.replace(`/${slug}/invite${result.firstClaim ? "?welcome=1" : ""}`);
    setError(result.error);
    setStatus("idle");
  }

  if (status === "checking") return <p className="text-center text-sm text-ink-muted">Checking this device…</p>;

  return (
    <form onSubmit={submit} className="card space-y-5">
      <div>
        <label htmlFor="code" className="label">
          Your invite code
        </label>
        <input
          id="code"
          className="input text-center font-mono text-2xl tracking-[0.3em] text-slate uppercase"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="XXXX-XXXX"
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          required
        />
      </div>
      <p className="text-xs leading-relaxed text-ink-muted">
        Your invite will be locked to this phone or browser. You won&apos;t be able to open it on another device, so claim it on
        the one you&apos;ll bring to the event.
      </p>
      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}
      <button className="btn w-full" disabled={status === "working" || !code.trim()}>
        {status === "working" ? "Securing your invite…" : "Claim my invite"}
      </button>
    </form>
  );
}
