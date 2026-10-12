"use client";

import { useActionState, useState } from "react";
import { submitRsvp, type RsvpState } from "@/app/[slug]/invite/actions";
import { Pill } from "@/components/bloom";

export function RsvpForm({
  slug,
  partySize,
  current,
  closed,
}: {
  slug: string;
  partySize: number;
  current: { status: string | null; count: number | null };
  closed: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(async (prev: RsvpState, form: FormData) => {
    const result = await submitRsvp(slug, prev, form);
    if (result?.message) setEditing(false);
    return result;
  }, null);
  const answered = current.status === "attending" || current.status === "declined";

  if ((answered && !editing) || closed) {
    return (
      <section className="card space-y-3 text-center">
        <p className="eyebrow text-cocoa-ink">Your reply</p>
        {current.status === "attending" ? (
          <Pill tone="attending">
            Attending{partySize > 1 ? ` · ${current.count ?? partySize} of ${partySize}` : ""}
          </Pill>
        ) : current.status === "declined" ? (
          <Pill tone="declined">Not attending</Pill>
        ) : (
          <p className="text-sm text-ink-muted">Replies have closed.</p>
        )}
        {state?.message && <p className="text-sm text-sage-ink">{state.message}</p>}
        {!closed && (
          <button type="button" className="btn-ghost btn-sm" onClick={() => setEditing(true)}>
            Change reply
          </button>
        )}
      </section>
    );
  }

  return (
    <form
      action={action}
      className="card space-y-4 text-center"
    >
      <p className="eyebrow text-cocoa-ink">Will you be joining us?</p>
      {partySize > 1 && (
        <label className="block text-left">
          <span className="label">How many of your party of {partySize} are coming?</span>
          <select name="count" className="input" defaultValue={current.count || partySize}>
            {Array.from({ length: partySize }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="grid grid-cols-2 gap-3">
        <button name="status" value="attending" className="btn" disabled={pending}>
          Joyfully accept
        </button>
        <button name="status" value="declined" className="btn-soft" disabled={pending}>
          Regretfully decline
        </button>
      </div>
      {state?.error && (
        <p role="alert" className="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
