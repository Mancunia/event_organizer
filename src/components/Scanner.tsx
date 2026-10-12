"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pill } from "@/components/bloom";
import { ScannerTips } from "@/components/ScannerTips";

type Guest = {
  inviteId: string;
  guestName: string;
  partySize: number;
  code: string;
  claimed: boolean;
  checkedInAt: string | null;
  notes: string | null;
};

type Result =
  | { kind: "valid"; method: "qr" | "code"; guest: Guest; justCheckedIn?: boolean }
  | { kind: "invalid"; error: string };

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export function Scanner({ slug, initialScan }: { slug: string; initialScan?: string }) {
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState("");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const lastScan = useRef<{ text: string; at: number } | null>(null);
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);

  const verify = useCallback(
    async (scanned: string) => {
      setBusy(true);
      try {
        const res = await fetch("/api/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, scanned }),
        });
        const data = await res.json();
        if (res.status === 401) return location.reload();
        setResult(data.valid ? { kind: "valid", method: data.method, guest: data.guest } : { kind: "invalid", error: data.error });
      } catch {
        setResult({ kind: "invalid", error: "Network error. Try again." });
      } finally {
        setBusy(false);
      }
    },
    [slug],
  );

  useEffect(() => {
    if (initialScan) verify(initialScan);
  }, [initialScan, verify]);

  async function startCamera() {
    setCameraError(null);
    const { Html5Qrcode } = await import("html5-qrcode");
    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (text) => {
          const now = Date.now();
          if (lastScan.current && lastScan.current.text === text && now - lastScan.current.at < 4000) return;
          lastScan.current = { text, at: now };
          navigator.vibrate?.(80);
          verify(text);
        },
        () => {},
      );
      setScanning(true);
    } catch (e) {
      setCameraError(e instanceof Error ? e.message : "Couldn't open the camera. You can type the code instead.");
    }
  }

  async function stopCamera() {
    await scannerRef.current?.stop().catch(() => {});
    scannerRef.current?.clear();
    scannerRef.current = null;
    setScanning(false);
  }

  useEffect(() => () => void scannerRef.current?.stop().catch(() => {}), []);

  async function checkIn(inviteId: string) {
    setBusy(true);
    const res = await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, inviteId }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok && result?.kind === "valid") setResult({ ...result, guest: data.guest, justCheckedIn: !data.alreadyCheckedIn });
  }

  return (
    <div className="space-y-5">
      <div className="card space-y-3 p-4">
        <div id="qr-reader" className="overflow-hidden rounded-[14px] [&_video]:rounded-[14px]" />
        {cameraError && <p className="alert">{cameraError}</p>}
        <button type="button" onClick={scanning ? stopCamera : startCamera} className={scanning ? "btn-ghost w-full" : "btn w-full"}>
          {scanning ? "Stop camera" : "Scan QR code"}
        </button>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (manual.trim()) verify(manual);
        }}
      >
        <input
          className="input font-mono tracking-widest uppercase"
          placeholder="Or type invite code"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          autoCapitalize="characters"
          spellCheck={false}
          aria-label="Invite code"
        />
        <button className="btn shrink-0" disabled={busy || !manual.trim()}>
          Check
        </button>
      </form>

      {result && <ResultCard result={result} busy={busy} onCheckIn={checkIn} onClear={() => setResult(null)} />}

      <div className="text-center">
        <button type="button" className="link text-sm" onClick={() => setShowHelp((v) => !v)} aria-expanded={showHelp}>
          {showHelp ? "Hide help" : "How to use the scanner"}
        </button>
      </div>
      {showHelp && (
        <div className="card">
          <ScannerTips />
        </div>
      )}
    </div>
  );
}

function ResultCard({
  result,
  busy,
  onCheckIn,
  onClear,
}: {
  result: Result;
  busy: boolean;
  onCheckIn: (inviteId: string) => void;
  onClear: () => void;
}) {
  if (result.kind === "invalid") {
    return (
      <div role="alert" className="rounded-[14px] border-2 border-terracotta bg-petal p-5 text-center">
        <p className="eyebrow text-cocoa-ink">Not valid</p>
        <p className="mt-2 text-lg font-semibold text-ink">{result.error}</p>
        <button onClick={onClear} className="link mt-4 text-sm">
          Clear
        </button>
      </div>
    );
  }

  const { guest } = result;
  const already = guest.checkedInAt && !result.justCheckedIn;
  const tone = already ? "border-blush-deep" : "border-sage";
  return (
    <div role="status" className={`rounded-[14px] border-2 bg-paper-raised p-5 text-center shadow-card ${tone}`}>
      <p className="eyebrow text-cocoa-ink">
        {result.method === "qr" ? "Verified QR pass" : "Verified by code"}
      </p>
      <p className="mt-2 text-2xl font-semibold text-ink">{guest.guestName}</p>
      <p className="text-sm text-ink-muted">
        Party of {guest.partySize} · <span className="font-mono">{guest.code}</span>
      </p>
      {!guest.claimed && <p className="mt-1 text-xs text-ink-muted">Invite not yet claimed on a device</p>}
      {guest.notes && <p className="mt-3 rounded-[14px] bg-petal px-3 py-2 text-sm text-ink">{guest.notes}</p>}
      {already ? (
        <p className="mt-4">
          <Pill tone="declined">Already checked in at {time(guest.checkedInAt!)}</Pill>
        </p>
      ) : guest.checkedInAt ? (
        <p className="mt-4">
          <Pill tone="attending">Checked in</Pill>
        </p>
      ) : (
        <button onClick={() => onCheckIn(guest.inviteId)} className="btn mt-4 w-full" disabled={busy}>
          Check in
        </button>
      )}
      <button onClick={onClear} className="btn-ghost mt-3 w-full">
        Next guest
      </button>
    </div>
  );
}
