"use client";

import { useActionState } from "react";
import { addScanner } from "@/app/admin/actions";
import { FormStatus } from "./FormStatus";

export function AddScannerForm({ eventId }: { eventId: string }) {
  const [state, action, pending] = useActionState(addScanner.bind(null, eventId), null);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <input name="staffName" className="input" placeholder="Staff name" required aria-label="Staff name" />
        <input name="phone" className="input" placeholder="WhatsApp number" required aria-label="WhatsApp number" />
        <input name="label" className="input" placeholder="Label, e.g. Gate A" required aria-label="Device label" />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button className="btn" disabled={pending}>
          {pending ? "Sending…" : "Send setup link"}
        </button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}
