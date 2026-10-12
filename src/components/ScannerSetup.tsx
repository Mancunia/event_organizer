"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { bindScannerDevice, storedScannerId } from "@/lib/device-keys.client";
import { ScannerTips } from "@/components/ScannerTips";

type Props = {
  slug: string;
  token: string;
  deviceId: string;
  /** Bound to some device already (maybe this one, maybe not). */
  alreadyBound: boolean;
  title: string;
  label: string;
  staffName: string;
  when: string;
  venue: string;
};

const STEPS = ["Welcome", "Set up", "Camera", "How to scan", "Ready"] as const;

type BindState = { kind: "idle" } | { kind: "busy" } | { kind: "error"; message: string };
type CameraState = { kind: "idle" } | { kind: "busy" } | { kind: "ok" } | { kind: "denied" } | { kind: "unavailable" };

/** Walks a staff member through turning their phone into this event's check-in scanner. */
export function ScannerSetup(props: Props) {
  const { slug, token, deviceId, alreadyBound } = props;
  const [step, setStep] = useState(0);
  const [checking, setChecking] = useState(alreadyBound);
  const [bind, setBind] = useState<BindState>({ kind: "idle" });
  const [camera, setCamera] = useState<CameraState>({ kind: "idle" });

  // Reopening the link on the phone that was set up: sign straight back in and skip ahead.
  useEffect(() => {
    if (!alreadyBound) return;
    (async () => {
      if ((await storedScannerId(slug)) === deviceId) {
        const result = await bindScannerDevice(slug, { token });
        if (result.ok) setStep(3);
        else setBind({ kind: "error", message: result.error });
      } else {
        setBind({
          kind: "error",
          message: "This link has already been used to set up another phone. Ask the organiser to send you a new one.",
        });
      }
      setChecking(false);
    })();
  }, [alreadyBound, slug, token, deviceId]);

  async function setUp() {
    setBind({ kind: "busy" });
    const result = await bindScannerDevice(slug, { token });
    if (!result.ok) return setBind({ kind: "error", message: result.error });
    setBind({ kind: "idle" });
    setStep(2);
  }

  async function allowCamera() {
    if (!navigator.mediaDevices?.getUserMedia) return setCamera({ kind: "unavailable" });
    setCamera({ kind: "busy" });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      stream.getTracks().forEach((t) => t.stop());
      setCamera({ kind: "ok" });
    } catch (e) {
      setCamera({ kind: e instanceof DOMException && e.name === "NotAllowedError" ? "denied" : "unavailable" });
    }
  }

  if (checking) return <p className="text-center text-sm text-ink-muted">Checking this phone…</p>;

  if (bind.kind === "error" && step <= 1) {
    return (
      <div className="card space-y-3 text-center">
        <p className="eyebrow text-cocoa-ink">Can’t set up this phone</p>
        <p role="alert" className="text-ink">
          {bind.message}
        </p>
        {step === 1 && (
          <button className="btn-ghost w-full" onClick={() => setBind({ kind: "idle" })}>
            Try again
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Progress step={step} />

      {step === 0 && (
        <section className="card space-y-4 text-center">
          <p className="eyebrow text-cocoa-ink">Hi {props.staffName}</p>
          <p className="text-lg text-ink">
            This phone will be the guest check-in scanner for <b>{props.title}</b>.
          </p>
          <dl className="space-y-1 rounded-[14px] bg-petal px-4 py-3 text-sm">
            <div>
              <dt className="inline text-ink-muted">Your post: </dt>
              <dd className="inline font-medium text-ink">{props.label}</dd>
            </div>
            <div>
              <dt className="inline text-ink-muted">When: </dt>
              <dd className="inline text-ink">{props.when}</dd>
            </div>
            <div>
              <dt className="inline text-ink-muted">Where: </dt>
              <dd className="inline text-ink">{props.venue}</dd>
            </div>
          </dl>
          <p className="text-sm text-ink-muted">Setup takes about a minute. Use the phone you’ll have with you at the door.</p>
          <button className="btn w-full" onClick={() => setStep(1)}>
            Get started
          </button>
        </section>
      )}

      {step === 1 && (
        <section className="card space-y-4 text-center">
          <h2 className="text-xl font-semibold text-ink">Link this phone</h2>
          <p className="text-sm text-ink-muted">
            This link works on <b>one phone only</b>. Once you tap the button, this phone becomes the “{props.label}” scanner and the link
            won’t work anywhere else.
          </p>
          <p className="text-sm text-ink-muted">Keep using this browser. Private or incognito mode won’t remember the setup.</p>
          <button className="btn w-full" onClick={setUp} disabled={bind.kind === "busy"}>
            {bind.kind === "busy" ? "Linking…" : "Link this phone"}
          </button>
        </section>
      )}

      {step === 2 && (
        <section className="card space-y-4 text-center">
          <h2 className="text-xl font-semibold text-ink">Allow the camera</h2>
          <p className="text-sm text-ink-muted">The scanner uses the back camera to read guests’ QR passes. Nothing is recorded or saved.</p>
          {camera.kind === "ok" ? (
            <p className="rounded-[14px] bg-petal px-4 py-3 text-sm text-sage-ink">Camera ready ✓</p>
          ) : (
            <button className="btn w-full" onClick={allowCamera} disabled={camera.kind === "busy"}>
              {camera.kind === "busy" ? "Waiting for permission…" : "Allow camera"}
            </button>
          )}
          {camera.kind === "denied" && (
            <div role="alert" className="space-y-2 rounded-[14px] bg-petal px-4 py-3 text-left text-sm text-ink">
              <p className="font-medium">Camera access was blocked.</p>
              <p>
                <b>iPhone:</b> Settings → Safari → Camera → Allow, then come back and try again.
              </p>
              <p>
                <b>Android:</b> tap the icon left of the address bar → Permissions → Camera → Allow.
              </p>
            </div>
          )}
          {camera.kind === "unavailable" && (
            <p role="alert" className="alert text-left">
              We couldn’t open a camera on this device. You can still check guests in by typing their codes.
            </p>
          )}
          <button className={camera.kind === "ok" ? "btn w-full" : "btn-ghost w-full"} onClick={() => setStep(3)}>
            {camera.kind === "ok" ? "Continue" : "Skip for now"}
          </button>
        </section>
      )}

      {step === 3 && (
        <section className="card space-y-5">
          <h2 className="text-center text-xl font-semibold text-ink">How to check guests in</h2>
          <ScannerTips />
          <button className="btn w-full" onClick={() => setStep(4)}>
            Got it
          </button>
        </section>
      )}

      {step === 4 && (
        <section className="card space-y-4 text-center">
          <h2 className="text-xl font-semibold text-ink">You’re all set</h2>
          <p className="text-sm text-ink-muted">
            This phone is now the <b>{props.label}</b> scanner. Add the scanner to your home screen so it’s one tap away on the day:
          </p>
          <ul className="space-y-1 rounded-[14px] bg-petal px-4 py-3 text-left text-sm text-ink">
            <li>
              <b>iPhone:</b> Share button → Add to Home Screen
            </li>
            <li>
              <b>Android:</b> ⋮ menu → Add to Home screen
            </li>
          </ul>
          <Link href={`/${slug}/verify`} className="btn w-full">
            Open the scanner
          </Link>
          <button className="link text-sm" onClick={() => setStep(3)}>
            See the tips again
          </button>
        </section>
      )}
    </div>
  );
}

function Progress({ step }: { step: number }) {
  return (
    <div className="space-y-2" aria-label={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}>
      <div className="flex gap-1.5">
        {STEPS.map((name, i) => (
          <span key={name} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-slate" : "bg-hairline"}`} />
        ))}
      </div>
      <p className="text-center text-xs text-ink-muted">
        Step {step + 1} of {STEPS.length} · {STEPS[step]}
      </p>
    </div>
  );
}
