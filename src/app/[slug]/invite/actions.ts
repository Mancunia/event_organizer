"use server";

import { revalidatePath } from "next/cache";
import { guestSession } from "@/lib/auth";
import { getEventBySlug } from "@/lib/events";
import { rsvpInputSchema } from "@/lib/guest-status";
import { loadGuestInvite, recordRsvp } from "@/lib/invites";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export type RsvpState = { error?: string; message?: string } | null;

export async function submitRsvp(slug: string, _prev: RsvpState, form: FormData): Promise<RsvpState> {
  const event = await getEventBySlug(slug);
  if (!event) return { error: "Event not found." };
  // Only the device the invite is bound to can reply on its behalf.
  const invite = await loadGuestInvite(await guestSession(), event.id);
  if (!invite) return { error: "Please reopen your invite link on the phone it was first opened on." };
  if (event.date.getTime() < Date.now()) return { error: "Replies have closed for this event." };
  if (!(await rateLimit(`rsvp:${invite.id}:${await clientIp()}`, 20, 3600))) return { error: "Too many changes. Try again later." };

  const parsed = rsvpInputSchema.safeParse({ status: form.get("status"), count: form.get("count") || undefined });
  if (!parsed.success) return { error: "Please choose whether you can attend." };

  await recordRsvp(invite.id, parsed.data.status, parsed.data.count);
  revalidatePath(`/${slug}/invite`);
  return { message: parsed.data.status === "attending" ? "Thank you — we can't wait to see you!" : "Thank you for letting us know." };
}
