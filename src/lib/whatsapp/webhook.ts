import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "../db";

/** Meta webhook subscription handshake. */
export function verifySubscription(req: Request, verifyToken: string | null | undefined) {
  const params = new URL(req.url).searchParams;
  if (verifyToken && params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === verifyToken) {
    return new Response(params.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export function validSignature(raw: string, header: string | null, appSecret: string) {
  const expected = Buffer.from(`sha256=${createHmac("sha256", appSecret).update(raw).digest("hex")}`);
  const given = Buffer.from(header ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

type StatusPayload = {
  entry?: { changes?: { value?: { statuses?: { id: string; status: string; errors?: { title?: string }[] }[] } }[] }[];
};

/** Applies delivery status updates (sent / delivered / read / failed) to invites and scanner links, optionally only one event's. */
export async function handleStatusWebhook(req: Request, appSecret: string | null | undefined, eventId?: string) {
  const raw = await req.text();
  if (!appSecret) return new Response("Webhook not configured", { status: 503 });
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"), appSecret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  const payload = JSON.parse(raw) as StatusPayload;
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const status of change.value?.statuses ?? []) {
        const data = { sendStatus: status.status, sendError: status.errors?.[0]?.title ?? null };
        await db.invite.updateMany({ where: { waMessageId: status.id, ...(eventId ? { guest: { eventId } } : {}) }, data });
        await db.scannerDevice.updateMany({ where: { waMessageId: status.id, ...(eventId ? { eventId } : {}) }, data });
      }
    }
  }
  return new Response("ok");
}
