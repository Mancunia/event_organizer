import { beforeAll, describe, expect, it } from "vitest";
import { buildIcs, calendarDetails, googleCalendarUrl, toIcsDate } from "@/lib/calendar";

beforeAll(() => {
  process.env.APP_URL = "https://example.com";
});

const event = {
  id: "evt1",
  slug: "ama-and-kofi",
  title: "Ama, Kofi; & Friends",
  kind: "wedding",
  date: new Date("2026-12-12T14:00:00Z"),
  venue: "Grand Hall, Airport City; Accra",
  mapUrl: "https://maps.example.com/hall",
};
const guest = { name: "Esi Mensah", partySize: 2 };

describe("calendar", () => {
  it("formats UTC dates", () => {
    expect(toIcsDate(new Date("2026-12-12T14:00:00.000Z"))).toBe("20261212T140000Z");
  });

  it("builds a valid ICS entry", () => {
    const ics = buildIcs(calendarDetails(event, guest), new Date("2026-10-12T00:00:00Z"));
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics.split("\r\n").every((l) => !l.includes("\n"))).toBe(true);
    expect(ics).toContain("DTSTART:20261212T140000Z");
    expect(ics).toContain("DTEND:20261212T200000Z");
    expect(ics).toContain("UID:evt1@example.com");
    expect(ics).toContain("SUMMARY:Wedding of Ama\\, Kofi\\; & Friends");
    expect(ics).toContain("LOCATION:Grand Hall\\, Airport City\\; Accra");
    expect(ics).toContain("Party of 2");
  });

  it("folds long lines to 75 octets", () => {
    const ics = buildIcs(calendarDetails({ ...event, venue: "x".repeat(200) }, guest));
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(ics.replace(/\r\n /g, "")).toContain(`LOCATION:${"x".repeat(200)}`);
  });

  it("never includes the invite code", () => {
    const details = calendarDetails(event, guest);
    expect(Object.values(details).join(" ")).not.toMatch(/code/i);
  });

  it("builds a Google Calendar link", () => {
    const url = new URL(googleCalendarUrl(calendarDetails(event, guest)));
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("dates")).toBe("20261212T140000Z/20261212T200000Z");
    expect(url.searchParams.get("text")).toBe("Wedding of Ama, Kofi; & Friends");
    expect(url.searchParams.get("location")).toBe(event.venue);
  });

  it("uses the event title for non-wedding events", () => {
    const details = calendarDetails({ ...event, title: "Acme Annual Gala", kind: "corporate" }, guest);
    expect(buildIcs(details)).toContain("SUMMARY:Acme Annual Gala");
  });
});
