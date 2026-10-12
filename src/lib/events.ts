import { cache } from "react";
import type { Event } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";

export { themeSchema, parseTheme, themeOverrideCss, eventPhotos, type Theme } from "./theme";

/** An event as the db client returns it by default: encrypted WhatsApp credentials omitted (see db.ts). */
export type SafeEvent = Omit<Event, "waAccessTokenEnc" | "waAppSecretEnc">;

export const RESERVED_SLUGS = new Set(["admin", "api", "v", "_next", "favicon.ico"]);
export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes")
  .max(60)
  .refine((s) => !RESERVED_SLUGS.has(s), "That slug is reserved");

export const getEventBySlug = cache(async (slug: string) => db.event.findUnique({ where: { slug } }));

export function formatEventDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: process.env.EVENT_TIMEZONE ?? "Africa/Accra",
  }).format(date);
}
