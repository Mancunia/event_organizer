import { env } from "./env";
import { eventCopy } from "./event-kinds";

/** Events only store a start time; calendar entries assume this length. */
export const DEFAULT_EVENT_HOURS = 6;

export type CalendarEvent = {
  id: string;
  slug: string;
  title: string;
  kind: string;
  date: Date;
  venue: string;
  mapUrl: string | null;
};
export type CalendarGuest = { name: string; partySize: number };

export type CalendarDetails = {
  uid: string;
  title: string;
  start: Date;
  end: Date;
  location: string;
  description: string;
  url: string;
};

/**
 * What goes into a guest's calendar entry. Deliberately leaves out the invite code and QR token:
 * calendars get synced and shared, and the invite page is device-bound anyway.
 */
export function calendarDetails(event: CalendarEvent, guest: CalendarGuest): CalendarDetails {
  const url = `${env.appUrl}/${event.slug}/invite`;
  const description = [
    `Guest: ${guest.name}`,
    guest.partySize > 1 && `Party of ${guest.partySize}`,
    event.mapUrl && `Directions: ${event.mapUrl}`,
    `Show your QR pass at the entrance: ${url}`,
  ]
    .filter(Boolean)
    .join("\n");
  return {
    uid: `${event.id}@${new URL(env.appUrl).host}`,
    title: eventCopy(event).calendarTitle,
    start: event.date,
    end: new Date(event.date.getTime() + DEFAULT_EVENT_HOURS * 60 * 60 * 1000),
    location: event.venue,
    description,
    url,
  };
}

/** UTC basic format, e.g. 20261212T140000Z — used by both ICS and Google Calendar. */
export function toIcsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** RFC 5545 §3.1: lines longer than 75 octets continue on the next line, prefixed by a space. */
function fold(line: string) {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  for (const char of line) {
    const limit = parts.length === 0 ? 75 : 74;
    if (encoder.encode(current + char).length > limit) {
      parts.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function buildIcs(details: CalendarDetails, now = new Date()) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Event Invitations//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${details.uid}`,
    `DTSTAMP:${toIcsDate(now)}`,
    `DTSTART:${toIcsDate(details.start)}`,
    `DTEND:${toIcsDate(details.end)}`,
    `SUMMARY:${escapeText(details.title)}`,
    `LOCATION:${escapeText(details.location)}`,
    `DESCRIPTION:${escapeText(details.description)}`,
    `URL:${details.url}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(details.title)}`,
    "TRIGGER:-P1D",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function googleCalendarUrl(details: CalendarDetails) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: details.title,
    dates: `${toIcsDate(details.start)}/${toIcsDate(details.end)}`,
    details: details.description,
    location: details.location,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
