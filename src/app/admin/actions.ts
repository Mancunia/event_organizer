"use server";

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import Papa from "papaparse";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { adminSession, checkAdminPassword, requireAdmin } from "@/lib/auth";
import { EVENT_KIND_KEYS } from "@/lib/event-kinds";
import { slugSchema, themeSchema } from "@/lib/events";
import { MAX_PHOTOS } from "@/lib/theme";
import { createInviteForGuest, resetDeviceBinding, sendInvite } from "@/lib/invites";
import { normalizePhone } from "@/lib/phone";
import { createScannerDevice, replaceScanner, revokeScanner, rotateScannerToken, sendScannerLink } from "@/lib/scanners";
import { sealSecret } from "@/lib/secret-box";
import { clientIp, rateLimit } from "@/lib/rate-limit";

type FormState = { error?: string; message?: string } | null;

export async function login(_prev: FormState, form: FormData): Promise<FormState> {
  if (!(await rateLimit(`admin-login:${await clientIp()}`, 10, 900))) return { error: "Too many attempts. Try again later." };
  if (!checkAdminPassword(String(form.get("password") ?? ""))) return { error: "Incorrect password." };
  const session = await adminSession();
  session.admin = true;
  await session.save();
  redirect("/admin");
}

export async function logout() {
  (await adminSession()).destroy();
  redirect("/admin/login");
}

const eventSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(1).max(120),
  kind: z.enum(EVENT_KIND_KEYS),
  eyebrow: z.string().trim().max(120).optional(),
  inviteLine: z.string().trim().max(300).optional(),
  date: z.string().min(1).transform((s, ctx) => {
    const d = new Date(s);
    if (isNaN(d.getTime())) ctx.addIssue({ code: "custom", message: "Invalid date" });
    return d;
  }),
  venue: z.string().trim().min(1).max(200),
  mapUrl: z.string().trim().url().optional().or(z.literal("").transform(() => undefined)),
  message: z.string().trim().max(2000).optional(),
  messageTemplateName: z.string().trim().min(1).max(100),
  templateLanguage: z.string().trim().min(2).max(10),
  scannerTemplateName: z.string().trim().min(1).max(100),
  clientPassword: z
    .string()
    .min(8, "Client password must be at least 8 characters")
    .max(200)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  removeClientAccess: z.literal("on").optional(),
  primary: z.string(),
  accent: z.string(),
  background: z.string(),
  heroImageUrl: z.string().optional(),
  photos: z.string().optional(),
  backdrop: z.string().optional(),
});

function readEventForm(form: FormData) {
  const parsed = eventSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const { primary, accent, background, heroImageUrl, photos, backdrop, clientPassword, removeClientAccess, ...rest } =
    parsed.data;
  const photoList = (photos ?? "").split(/\s+/).filter(Boolean);
  const theme = themeSchema.safeParse({ primary, accent, background, heroImageUrl, photos: photoList, backdrop });
  if (!theme.success) {
    const issue = theme.error.issues[0];
    if (issue.path[0] === "photos" && issue.code === "too_big") return { error: `Add at most ${MAX_PHOTOS} photos.` };
    if (issue.path[0] === "photos" || issue.path[0] === "heroImageUrl") {
      return { error: "Each photo must be a full image link starting with http:// or https://." };
    }
    return { error: "Theme colours must be hex values like #2e3d4e." };
  }
  return {
    data: { ...rest, message: rest.message || null, eyebrow: rest.eyebrow || null, inviteLine: rest.inviteLine || null, mapUrl: rest.mapUrl ?? null, theme: theme.data },
    clientPassword,
    removeClientAccess: removeClientAccess === "on",
  };
}

/** New password wins; otherwise the checkbox clears access; otherwise leave the hash as it is. */
async function clientPasswordUpdate(result: { clientPassword?: string; removeClientAccess: boolean }) {
  if (result.clientPassword) return { clientPasswordHash: await bcrypt.hash(result.clientPassword, 10) };
  if (result.removeClientAccess) return { clientPasswordHash: null };
  return {};
}

function uniqueViolation(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

export async function createEvent(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const result = readEventForm(form);
  if ("error" in result) return { error: result.error };
  let id: string;
  try {
    const event = await db.event.create({
      data: { ...result.data, ...(await clientPasswordUpdate(result)) },
    });
    id = event.id;
  } catch (e) {
    if (uniqueViolation(e)) return { error: "That slug is already in use." };
    throw e;
  }
  await audit("event.created", { eventId: id });
  redirect(`/admin/events/${id}`);
}

export async function updateEvent(eventId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const result = readEventForm(form);
  if ("error" in result) return { error: result.error };
  try {
    await db.event.update({
      where: { id: eventId },
      data: {
        ...result.data,
        ...(await clientPasswordUpdate(result)),
      },
    });
  } catch (e) {
    if (uniqueViolation(e)) return { error: "That slug is already in use." };
    throw e;
  }
  await audit("event.updated", { eventId });
  revalidatePath(`/admin/events/${eventId}`);
  return { message: "Saved." };
}

export async function deleteEvent(eventId: string) {
  await requireAdmin();
  // Guests, invites, nonces and the event's audit logs cascade with it
  const event = await db.event.delete({ where: { id: eventId } });
  // Logged without eventId: the event row (and its logs) no longer exist
  await audit("event.deleted", { meta: { eventId, slug: event.slug, title: event.title } });
  revalidatePath("/admin");
  redirect("/admin");
}

const whatsAppAccountSchema = z.object({
  phoneNumberId: z.string().trim().regex(/^\d{5,30}$/, "Phone number ID is the numeric ID from WhatsApp Manager, not the phone number"),
  accessToken: z.string().trim().max(2000).optional(),
  appSecret: z.string().trim().max(200).optional(),
});

/**
 * Sends this event's invites through the client's own WhatsApp Business account.
 * Token and app secret are write-only: blank fields keep the saved value.
 */
export async function saveWhatsAppAccount(eventId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = whatsAppAccountSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { phoneNumberId, accessToken, appSecret } = parsed.data;
  const event = await db.event.findUniqueOrThrow({ where: { id: eventId }, select: { waAccessTokenEnc: true, waVerifyToken: true } });
  if (!accessToken && !event.waAccessTokenEnc) return { error: "Enter the access token." };
  await db.event.update({
    where: { id: eventId },
    data: {
      waPhoneNumberId: phoneNumberId,
      ...(accessToken ? { waAccessTokenEnc: sealSecret(accessToken) } : {}),
      ...(appSecret ? { waAppSecretEnc: sealSecret(appSecret) } : {}),
      waVerifyToken: event.waVerifyToken ?? randomBytes(18).toString("base64url"),
    },
  });
  await audit("event.whatsapp_account_saved", { eventId, meta: { phoneNumberId } });
  revalidatePath(`/admin/events/${eventId}`);
  return { message: "Saved. Invites for this event now go out from the client's WhatsApp account." };
}

export async function removeWhatsAppAccount(eventId: string) {
  await requireAdmin();
  await db.event.update({
    where: { id: eventId },
    data: { waPhoneNumberId: null, waAccessTokenEnc: null, waAppSecretEnc: null, waVerifyToken: null },
  });
  await audit("event.whatsapp_account_removed", { eventId });
  revalidatePath(`/admin/events/${eventId}`);
}

const guestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(5),
  partySize: z.coerce.number().int().min(1).max(20).default(1),
  notes: z.string().trim().max(500).optional(),
});

async function addGuestRecord(
  eventId: string,
  input: z.infer<typeof guestSchema>,
): Promise<{ inviteId: string; error?: never } | { inviteId?: never; error: string }> {
  const phone = normalizePhone(input.phone);
  if (!phone) return { error: `Invalid phone number "${input.phone}" for ${input.name}` };
  try {
    const guest = await db.guest.create({
      data: { eventId, name: input.name, phone, partySize: input.partySize, notes: input.notes || null },
    });
    const invite = await createInviteForGuest(guest.id);
    return { inviteId: invite.id };
  } catch (e) {
    if (uniqueViolation(e)) return { error: `${input.name} (${phone}) is already on the guest list` };
    throw e;
  }
}

/** Sends in small batches to stay well under WhatsApp's per-second limits. */
async function sendInvites(inviteIds: string[]) {
  let sent = 0;
  const failures: string[] = [];
  for (let i = 0; i < inviteIds.length; i += 5) {
    const results = await Promise.all(inviteIds.slice(i, i + 5).map((id) => sendInvite(id)));
    for (const r of results) {
      if (r.ok) sent++;
      else failures.push(r.error);
    }
  }
  return { sent, failures };
}

export async function addGuest(eventId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = guestSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { error } = await addGuestRecord(eventId, parsed.data);
  if (error) return { error };
  revalidatePath(`/admin/events/${eventId}`);
  return { message: `Added ${parsed.data.name}.` };
}

/**
 * CSV with a header row: name, phone, party_size (optional), notes (optional).
 * With `send` checked, WhatsApp invites go out to the guests created by this upload.
 */
export async function importGuests(eventId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const file = form.get("file");
  const text = file instanceof File && file.size > 0 ? await file.text() : String(form.get("csv") ?? "");
  if (!text.trim()) return { error: "Choose a CSV file or paste CSV text." };

  const { data } = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/[\s-]+/g, "_"),
  });

  const created: string[] = [];
  const problems: string[] = [];
  for (const [i, row] of data.entries()) {
    const parsed = guestSchema.safeParse({
      name: row.name,
      phone: row.phone ?? row.whatsapp ?? row.phone_number,
      partySize: row.party_size || row.party || undefined,
      notes: row.notes,
    });
    if (!parsed.success) {
      problems.push(`Row ${i + 2}: ${parsed.error.issues[0].path.join(".")} ${parsed.error.issues[0].message}`);
      continue;
    }
    const result = await addGuestRecord(eventId, parsed.data);
    if (result.inviteId) created.push(result.inviteId);
    else problems.push(`Row ${i + 2}: ${result.error}`);
  }
  const added = created.length;
  const send = form.get("send") === "on" && added > 0;
  const { sent, failures } = send ? await sendInvites(created) : { sent: 0, failures: [] };
  await audit("guests.imported", { eventId, meta: { added, problems: problems.length, sent, sendFailures: failures.length } });
  revalidatePath(`/admin/events/${eventId}`);

  if (failures.length) problems.unshift(`${failures.length} invite${failures.length === 1 ? "" : "s"} failed to send. First error: ${failures[0]}`);
  return {
    message: `Imported ${added} guest${added === 1 ? "" : "s"}.` + (send ? ` Sent ${sent} of ${added} invites.` : ""),
    error: problems.length ? problems.slice(0, 20).join("\n") : undefined,
  };
}

export async function deleteGuest(eventId: string, guestId: string) {
  await requireAdmin();
  await db.guest.delete({ where: { id: guestId, eventId } });
  await audit("guest.deleted", { eventId, meta: { guestId } });
  revalidatePath(`/admin/events/${eventId}`);
}

export async function resetBinding(eventId: string, inviteId: string) {
  await requireAdmin();
  await resetDeviceBinding(inviteId);
  revalidatePath(`/admin/events/${eventId}`);
}

export async function resendInvite(eventId: string, inviteId: string) {
  await requireAdmin();
  await sendInvite(inviteId);
  revalidatePath(`/admin/events/${eventId}`);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState passes the previous state
export async function sendAllUnsent(eventId: string, _prev: FormState): Promise<FormState> {
  await requireAdmin();
  const invites = await db.invite.findMany({
    where: { guest: { eventId }, sentAt: null },
    select: { id: true },
  });
  const { sent, failures } = await sendInvites(invites.map((inv) => inv.id));
  revalidatePath(`/admin/events/${eventId}`);
  return {
    message: invites.length ? `Sent ${sent} of ${invites.length} invites.` : "Every guest has already been sent an invite.",
    error: failures.length ? `${failures.length} failed. First error: ${failures[0]}` : undefined,
  };
}

const scannerSchema = z.object({
  staffName: z.string().trim().min(1, "Enter the staff member's name").max(120),
  phone: z.string().trim().min(5, "Enter their WhatsApp number"),
  label: z.string().trim().min(1, "Give the device a label, e.g. Gate A").max(60),
});

/** Registers a check-in device and sends the staff member its one-time setup link on WhatsApp. */
export async function addScanner(eventId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = scannerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return { error: `Invalid phone number "${parsed.data.phone}"` };
  const device = await createScannerDevice(eventId, { ...parsed.data, phone });
  const sent = await sendScannerLink(device.id);
  revalidatePath(`/admin/events/${eventId}`);
  return sent.ok
    ? { message: `Sent the ${device.label} setup link to ${device.staffName}.` }
    : { error: `Device added, but the WhatsApp message failed: ${sent.error}` };
}

export async function resendScannerLink(eventId: string, deviceId: string) {
  await requireAdmin();
  if (await rotateScannerToken(deviceId)) await sendScannerLink(deviceId);
  revalidatePath(`/admin/events/${eventId}`);
}

export async function removeScanner(eventId: string, deviceId: string) {
  await requireAdmin();
  await revokeScanner(deviceId);
  revalidatePath(`/admin/events/${eventId}`);
}

export async function replaceScannerDevice(eventId: string, deviceId: string) {
  await requireAdmin();
  const device = await replaceScanner(deviceId);
  await sendScannerLink(device.id);
  revalidatePath(`/admin/events/${eventId}`);
}
