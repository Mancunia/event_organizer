"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { clientSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getEventBySlug } from "@/lib/events";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function clientLogin(slug: string, _prev: string | null, form: FormData): Promise<string | null> {
  const event = await getEventBySlug(slug);
  if (!event) return "Event not found.";
  if (!event.clientPasswordHash) return "Guest list access isn't set up yet. Ask your organiser.";
  if (!(await rateLimit(`client-pw:${event.id}:${await clientIp()}`, 10, 900))) return "Too many attempts. Try again later.";

  const password = String(form.get("password") ?? "");
  if (!(await bcrypt.compare(password, event.clientPasswordHash))) return "Incorrect password.";

  const session = await clientSession();
  session.eventIds = Array.from(new Set([...(session.eventIds ?? []), event.id]));
  await session.save();
  await audit("client.login", { eventId: event.id });
  redirect(`/${slug}/guests`);
}

export async function clientLogout(slug: string) {
  (await clientSession()).destroy();
  redirect(`/${slug}/guests`);
}
