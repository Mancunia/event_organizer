"use client";

import { useActionState, useState } from "react";
import type { SafeEvent } from "@/lib/events";
import { createEvent, updateEvent } from "@/app/admin/actions";
import { EVENT_KINDS, eventKind } from "@/lib/event-kinds";
import { BACKDROPS, MAX_PHOTOS, parseTheme } from "@/lib/theme";
import { FormStatus } from "./FormStatus";

function toLocalInput(date: Date) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function EventForm({ event }: { event?: SafeEvent }) {
  const [state, action, pending] = useActionState(event ? updateEvent.bind(null, event.id) : createEvent, null);
  const theme = parseTheme(event?.theme);
  const [kind, setKind] = useState(event?.kind ?? "wedding");
  const preset = eventKind(kind);

  return (
    <form
      action={(form) => {
        // datetime-local has no zone; send an absolute instant from the organiser's browser.
        const local = form.get("dateLocal");
        if (typeof local === "string" && local) form.set("date", new Date(local).toISOString());
        return action(form);
      }}
      className="grid gap-4 sm:grid-cols-2"
    >
      <label className="block sm:col-span-2">
        <span className="label">Event type</span>
        <select name="kind" className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
          {Object.entries(EVENT_KINDS).map(([value, { label }]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <Field label="Title / hosts" name="title" defaultValue={event?.title} placeholder={preset.titlePlaceholder} required />
      <Field label="URL slug" name="slug" defaultValue={event?.slug} placeholder="my-event" required />
      <Field label="Date & time" name="dateLocal" type="datetime-local" defaultValue={event ? toLocalInput(event.date) : undefined} required />
      <Field label="Venue" name="venue" defaultValue={event?.venue} required />
      <Field label="Map link" name="mapUrl" type="url" defaultValue={event?.mapUrl ?? ""} />
      <div className="sm:col-span-2">
        <Field
          label={event?.clientPasswordHash ? "New client password (leave blank to keep)" : "Client password (optional)"}
          name="clientPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
        />
        <span className="mt-1 block text-xs text-ink-muted">
          Lets the hosts see who is coming at /{event?.slug ?? "<slug>"}/guests. Names, party sizes and replies only — no
          phone numbers or codes.
        </span>
        {event?.clientPasswordHash && (
          <label className="mt-2 flex items-center gap-2 text-sm text-ink-muted">
            <input type="checkbox" name="removeClientAccess" /> Remove client access
          </label>
        )}
      </div>
      <Field label="Eyebrow (optional)" name="eyebrow" defaultValue={event?.eyebrow ?? ""} placeholder={preset.eyebrow} maxLength={120} />
      <Field
        label="Invitation line (optional)"
        name="inviteLine"
        defaultValue={event?.inviteLine ?? ""}
        placeholder={preset.inviteLine}
        maxLength={300}
      />
      <label className="sm:col-span-2">
        <span className="label">Message to guests</span>
        <textarea name="message" rows={3} className="input" defaultValue={event?.message ?? ""} />
      </label>
      <Field label="WhatsApp template name" name="messageTemplateName" defaultValue={event?.messageTemplateName ?? "event_invite"} required />
      <Field label="Template language" name="templateLanguage" defaultValue={event?.templateLanguage ?? "en"} required />
      <Field label="Scanner link template" name="scannerTemplateName" defaultValue={event?.scannerTemplateName ?? "scanner_link"} required />
      <div className="grid grid-cols-3 gap-3 sm:col-span-2">
        <Field label="Primary" name="primary" type="color" defaultValue={theme.primary} />
        <Field label="Accent" name="accent" type="color" defaultValue={theme.accent} />
        <Field label="Background" name="background" type="color" defaultValue={theme.background} />
      </div>
      <div className="sm:col-span-2">
        <Field label="Hero image URL" name="heroImageUrl" type="url" defaultValue={theme.heroImageUrl ?? ""} />
      </div>
      <label className="sm:col-span-2">
        <span className="label">Photo links (one per line, up to {MAX_PHOTOS})</span>
        <textarea
          name="photos"
          rows={4}
          className="input font-mono text-sm"
          placeholder={"https://example.com/photo-1.jpg\nhttps://example.com/photo-2.jpg"}
          defaultValue={theme.photos.join("\n")}
        />
        <span className="mt-1 block text-xs text-ink-muted">
          Shown on the guest pages. The first photo fills the portrait when there is no hero image.
        </span>
      </label>
      <label className="sm:col-span-2">
        <span className="label">Background style</span>
        <select name="backdrop" className="input" defaultValue={theme.backdrop}>
          {Object.entries(BACKDROPS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-4 sm:col-span-2">
        <button className="btn" disabled={pending}>
          {pending ? "Saving…" : event ? "Save changes" : "Create event"}
        </button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className={props.type === "color" ? "h-11 w-full cursor-pointer rounded-lg border border-hairline bg-paper-raised" : "input"} {...props} />
    </label>
  );
}
