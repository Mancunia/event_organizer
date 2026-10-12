import { describe, expect, it } from "vitest";
import { EVENT_KINDS, eventCopy, eventKind } from "@/lib/event-kinds";

describe("event kinds", () => {
  it("keeps the original wedding wording", () => {
    const copy = eventCopy({ title: "Ama & Kwame", kind: "wedding" });
    expect(copy.eyebrow).toBe("Together with their families");
    expect(copy.inviteLine).toBe("Request the honour of your presence at the celebration of their marriage");
    expect(copy.calendarTitle).toBe("Wedding of Ama & Kwame");
    expect(copy.florals).toBe(true);
  });

  it("uses the event title as the calendar title for other kinds", () => {
    expect(eventCopy({ title: "Acme Annual Gala", kind: "corporate" }).calendarTitle).toBe("Acme Annual Gala");
  });

  it("lets per-event wording override the preset", () => {
    const copy = eventCopy({ title: "X", kind: "corporate", eyebrow: "Acme Ltd presents", inviteLine: "  " });
    expect(copy.eyebrow).toBe("Acme Ltd presents");
    expect(copy.inviteLine).toBe(EVENT_KINDS.corporate.inviteLine);
  });

  it("falls back to 'other' for unknown kinds", () => {
    expect(eventKind("bar-mitzvah")).toBe(EVENT_KINDS.other);
    expect(eventKind("toString")).toBe(EVENT_KINDS.other);
  });
});
