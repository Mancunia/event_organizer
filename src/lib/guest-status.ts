import { z } from "zod";

export const RSVP_STATUSES = ["attending", "declined"] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];

export const rsvpInputSchema = z.object({
  status: z.enum(RSVP_STATUSES),
  count: z.coerce.number().int().min(1).max(20).optional(),
});

type Tone = "pending" | "attending" | "declined";

/** The fields needed to describe an invite's progress. Deliberately excludes phone, code and notes. */
export type InviteProgress = {
  sentAt: Date | null;
  sendStatus: string | null;
  claimedAt: Date | null;
  checkedInAt: Date | null;
  rsvpStatus: string | null;
  rsvpCount: number | null;
};

export type GuestProgress = { partySize: number; invite: InviteProgress | null };

/** Furthest point the invite has reached, in words a host would use. */
export function inviteStage(invite: InviteProgress | null): { label: string; tone: Tone } {
  if (!invite) return { label: "Not sent yet", tone: "pending" };
  if (invite.claimedAt) return { label: "Opened", tone: "attending" };
  switch (invite.sendStatus) {
    case "failed":
      return { label: "Couldn't deliver", tone: "declined" };
    case "read":
      return { label: "Read", tone: "attending" };
    case "delivered":
      return { label: "Delivered", tone: "attending" };
    case "sent":
      return { label: "Sent", tone: "pending" };
  }
  return invite.sentAt ? { label: "Sent", tone: "pending" } : { label: "Not sent yet", tone: "pending" };
}

export function rsvpLabel(invite: InviteProgress | null, partySize: number): { label: string; tone: Tone } {
  if (invite?.rsvpStatus === "attending") {
    const count = invite.rsvpCount ?? partySize;
    return { label: partySize > 1 ? `Attending (${count} of ${partySize})` : "Attending", tone: "attending" };
  }
  if (invite?.rsvpStatus === "declined") return { label: "Not attending", tone: "declined" };
  return { label: "Awaiting reply", tone: "pending" };
}

export type GuestFilter = "attending" | "declined" | "awaiting" | "checked-in";

export function matchesFilter(guest: GuestProgress, filter: GuestFilter | undefined): boolean {
  const status = guest.invite?.rsvpStatus;
  switch (filter) {
    case "attending":
      return status === "attending";
    case "declined":
      return status === "declined";
    case "awaiting":
      return status !== "attending" && status !== "declined";
    case "checked-in":
      return guest.invite?.checkedInAt != null;
    default:
      return true;
  }
}

export function summariseGuests(guests: GuestProgress[]) {
  const summary = {
    guests: guests.length,
    invitedPeople: 0,
    attendingGuests: 0,
    attendingPeople: 0,
    declined: 0,
    awaiting: 0,
    checkedIn: 0,
  };
  for (const g of guests) {
    summary.invitedPeople += g.partySize;
    if (g.invite?.rsvpStatus === "attending") {
      summary.attendingGuests++;
      summary.attendingPeople += g.invite.rsvpCount ?? g.partySize;
    } else if (g.invite?.rsvpStatus === "declined") summary.declined++;
    else summary.awaiting++;
    if (g.invite?.checkedInAt) summary.checkedIn++;
  }
  return summary;
}
