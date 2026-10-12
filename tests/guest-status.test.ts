import { describe, expect, it } from "vitest";
import { inviteStage, matchesFilter, rsvpLabel, summariseGuests, type InviteProgress } from "@/lib/guest-status";

const base: InviteProgress = { sentAt: null, sendStatus: null, claimedAt: null, checkedInAt: null, rsvpStatus: null, rsvpCount: null };
const inv = (over: Partial<InviteProgress>) => ({ ...base, ...over });

describe("inviteStage", () => {
  it("walks the invite lifecycle", () => {
    expect(inviteStage(null).label).toBe("Not sent yet");
    expect(inviteStage(base).label).toBe("Not sent yet");
    expect(inviteStage(inv({ sentAt: new Date(), sendStatus: "sent" })).label).toBe("Sent");
    expect(inviteStage(inv({ sentAt: new Date(), sendStatus: "delivered" })).label).toBe("Delivered");
    expect(inviteStage(inv({ sentAt: new Date(), sendStatus: "read" })).label).toBe("Read");
    expect(inviteStage(inv({ sendStatus: "failed" }))).toEqual({ label: "Couldn't deliver", tone: "declined" });
  });

  it("treats a claimed invite as opened regardless of the delivery receipt", () => {
    expect(inviteStage(inv({ sendStatus: "sent", claimedAt: new Date() })).label).toBe("Opened");
  });
});

describe("rsvpLabel", () => {
  it("shows the attending count for parties", () => {
    expect(rsvpLabel(inv({ rsvpStatus: "attending", rsvpCount: 2 }), 3).label).toBe("Attending (2 of 3)");
    expect(rsvpLabel(inv({ rsvpStatus: "attending", rsvpCount: 1 }), 1).label).toBe("Attending");
  });

  it("covers declined and no reply", () => {
    expect(rsvpLabel(inv({ rsvpStatus: "declined", rsvpCount: 0 }), 2)).toEqual({ label: "Not attending", tone: "declined" });
    expect(rsvpLabel(base, 2).label).toBe("Awaiting reply");
    expect(rsvpLabel(null, 2).label).toBe("Awaiting reply");
  });
});

describe("summariseGuests", () => {
  const guests = [
    { partySize: 3, invite: inv({ rsvpStatus: "attending", rsvpCount: 2, checkedInAt: new Date() }) },
    { partySize: 2, invite: inv({ rsvpStatus: "declined", rsvpCount: 0 }) },
    { partySize: 1, invite: base },
    { partySize: 1, invite: null },
  ];

  it("counts people attending, not just invites", () => {
    expect(summariseGuests(guests)).toEqual({
      guests: 4,
      invitedPeople: 7,
      attendingGuests: 1,
      attendingPeople: 2,
      declined: 1,
      awaiting: 2,
      checkedIn: 1,
    });
  });

  it("filters match the summary buckets", () => {
    expect(guests.filter((g) => matchesFilter(g, "attending"))).toHaveLength(1);
    expect(guests.filter((g) => matchesFilter(g, "declined"))).toHaveLength(1);
    expect(guests.filter((g) => matchesFilter(g, "awaiting"))).toHaveLength(2);
    expect(guests.filter((g) => matchesFilter(g, "checked-in"))).toHaveLength(1);
    expect(guests.filter((g) => matchesFilter(g, undefined))).toHaveLength(4);
  });
});
