"use client";

import { useActionState, useState } from "react";
import { addGuest, importGuests, sendAllUnsent } from "@/app/admin/actions";
import { FormStatus } from "./FormStatus";

export function AddGuestForm({ eventId }: { eventId: string }) {
  const [state, action, pending] = useActionState(addGuest.bind(null, eventId), null);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[2fr_2fr_1fr]">
        <input name="name" className="input" placeholder="Guest name" required aria-label="Guest name" />
        <input name="phone" className="input" placeholder="WhatsApp number" required aria-label="WhatsApp number" />
        <input name="partySize" type="number" min={1} max={20} defaultValue={1} className="input" aria-label="Party size" />
      </div>
      <input name="notes" className="input" placeholder="Notes for ushers (optional, e.g. table 4)" aria-label="Notes" />
      <div className="flex items-center gap-4">
        <button className="btn" disabled={pending}>
          Add guest
        </button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}

export function ImportGuestsForm({ eventId }: { eventId: string }) {
  const [state, action, pending] = useActionState(importGuests.bind(null, eventId), null);
  const [send, setSend] = useState(false);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (send && !confirm("Import these guests and send each new guest their WhatsApp invite now?")) e.preventDefault();
      }}
      className="space-y-3"
    >
      <p className="text-sm text-ink-muted">
        CSV with a header row: <code>name, phone, party_size, notes</code>. Local numbers use the default country code.
      </p>
      <input type="file" name="file" accept=".csv,text/csv" className="block text-sm" />
      <textarea name="csv" rows={4} className="input font-mono text-sm" placeholder={"name,phone,party_size\nAma Mensah,0241234567,2"} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="send" checked={send} onChange={(e) => setSend(e.target.checked)} />
        Send WhatsApp invites to the imported guests
      </label>
      <div className="flex items-center gap-4">
        <button className="btn" disabled={pending}>
          {pending ? (send ? "Importing & sending…" : "Importing…") : send ? "Import & send" : "Import"}
        </button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}

export function SendAllButton({ eventId, unsent }: { eventId: string; unsent: number }) {
  const [state, action, pending] = useActionState(sendAllUnsent.bind(null, eventId), null);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Send WhatsApp invites to ${unsent} guest${unsent === 1 ? "" : "s"}?`)) e.preventDefault();
      }}
      className="flex flex-wrap items-center gap-4"
    >
      <button className="btn" disabled={pending || unsent === 0}>
        {pending ? "Sending…" : `Send ${unsent} unsent invite${unsent === 1 ? "" : "s"}`}
      </button>
      <FormStatus state={state} />
    </form>
  );
}

export function ConfirmButton({
  action,
  label,
  confirmText,
  className = "btn-ghost btn-sm",
}: {
  action: () => Promise<void>;
  label: string;
  confirmText: string;
  className?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
    >
      <button className={className}>{label}</button>
    </form>
  );
}
