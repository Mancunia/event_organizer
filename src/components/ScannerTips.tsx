/** The short "how to check guests in" guide, shown during setup and behind the scanner's help button. */
export function ScannerTips() {
  return (
    <ol className="space-y-4 text-sm text-ink">
      <li className="flex gap-3">
        <StepNo n={1} />
        <div>
          <p className="font-medium">Tap “Scan QR code” and point at the guest’s pass</p>
          <p className="text-ink-muted">Hold the phone about a hand’s length away. It reads the code by itself and buzzes.</p>
        </div>
      </li>
      <li className="flex gap-3">
        <StepNo n={2} />
        <div>
          <p className="font-medium">Read the result card</p>
          <ul className="mt-2 space-y-1.5 text-ink-muted">
            <li className="flex items-center gap-2">
              <span className="size-3 shrink-0 rounded-full border-2 border-sage" /> <span>Green border: genuine invite, tap <b>Check in</b></span>
            </li>
            <li className="flex items-center gap-2">
              <span className="size-3 shrink-0 rounded-full border-2 border-blush-deep" /> <span>Pink border: already checked in (shows the time)</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="size-3 shrink-0 rounded-full border-2 border-terracotta" /> <span>Red “Not valid”: don’t admit, call the organiser</span>
            </li>
          </ul>
        </div>
      </li>
      <li className="flex gap-3">
        <StepNo n={3} />
        <div>
          <p className="font-medium">No QR? Type the code</p>
          <p className="text-ink-muted">
            Every invite has an 8-character code like <span className="font-mono">ABCD-EFGH</span>. Type it in the box under the camera.
          </p>
        </div>
      </li>
      <li className="flex gap-3">
        <StepNo n={4} />
        <div>
          <p className="font-medium">Tap “Next guest” and repeat</p>
          <p className="text-ink-muted">Check notes on the card (e.g. table numbers) before sending guests on.</p>
        </div>
      </li>
    </ol>
  );
}

function StepNo({ n }: { n: number }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-petal text-xs font-semibold text-cocoa-ink">{n}</span>
  );
}
