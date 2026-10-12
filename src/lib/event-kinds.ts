/** Wording presets per kind of event. Organisers can override the eyebrow and invitation line per event. */
export type EventKindPreset = {
  label: string;
  /** Small script line above the title, e.g. "Together with their families" */
  eyebrow: string;
  /** Sentence under the title on the invitation */
  inviteLine: string;
  calendarTitle: (title: string) => string;
  /** Whether the botanical line art suits this kind of event */
  florals: boolean;
  titlePlaceholder: string;
};

export const EVENT_KINDS = {
  wedding: {
    label: "Wedding",
    eyebrow: "Together with their families",
    inviteLine: "Request the honour of your presence at the celebration of their marriage",
    calendarTitle: (title) => `Wedding of ${title}`,
    florals: true,
    titlePlaceholder: "Ama & Kwame",
  },
  birthday: {
    label: "Birthday",
    eyebrow: "Join us to celebrate",
    inviteLine: "You're warmly invited to a birthday celebration",
    calendarTitle: (title) => title,
    florals: true,
    titlePlaceholder: "Esi's 40th",
  },
  memorial: {
    label: "Memorial / Funeral",
    eyebrow: "In loving memory",
    inviteLine: "Please join us as we celebrate a life well lived",
    calendarTitle: (title) => title,
    florals: false,
    titlePlaceholder: "Nana Yaw Mensah",
  },
  corporate: {
    label: "Corporate",
    eyebrow: "You're invited",
    inviteLine: "We would be delighted to have you join us",
    calendarTitle: (title) => title,
    florals: false,
    titlePlaceholder: "Acme Annual Gala",
  },
  party: {
    label: "Party",
    eyebrow: "You're invited",
    inviteLine: "Come celebrate with us",
    calendarTitle: (title) => title,
    florals: true,
    titlePlaceholder: "Summer Garden Party",
  },
  other: {
    label: "Other",
    eyebrow: "You're invited",
    inviteLine: "We would love for you to join us",
    calendarTitle: (title) => title,
    florals: false,
    titlePlaceholder: "Event title",
  },
} satisfies Record<string, EventKindPreset>;

export type EventKind = keyof typeof EVENT_KINDS;
export const EVENT_KIND_KEYS = Object.keys(EVENT_KINDS) as [EventKind, ...EventKind[]];

export function eventKind(kind: string | null | undefined): EventKindPreset {
  return kind && Object.hasOwn(EVENT_KINDS, kind) ? EVENT_KINDS[kind as EventKind] : EVENT_KINDS.other;
}

export type EventCopySource = { title: string; kind: string; eyebrow?: string | null; inviteLine?: string | null };

/** The wording an event's pages use: per-event overrides win over the kind's preset. */
export function eventCopy(event: EventCopySource) {
  const preset = eventKind(event.kind);
  return {
    label: preset.label,
    eyebrow: event.eyebrow?.trim() || preset.eyebrow,
    inviteLine: event.inviteLine?.trim() || preset.inviteLine,
    calendarTitle: preset.calendarTitle(event.title),
    florals: preset.florals,
  };
}
