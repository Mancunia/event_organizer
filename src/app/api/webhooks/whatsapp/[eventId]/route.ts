import { db } from "@/lib/db";
import { openSecret } from "@/lib/secret-box";
import { handleStatusWebhook, verifySubscription } from "@/lib/whatsapp/webhook";

type Params = { params: Promise<{ eventId: string }> };

/** Webhook for an event that sends through the client's own WhatsApp Business account. */
async function account({ params }: Params) {
  const { eventId } = await params;
  return db.event.findUnique({ where: { id: eventId }, select: { id: true, waVerifyToken: true, waAppSecretEnc: true } });
}

export async function GET(req: Request, ctx: Params) {
  return verifySubscription(req, (await account(ctx))?.waVerifyToken);
}

export async function POST(req: Request, ctx: Params) {
  const event = await account(ctx);
  const secret = event?.waAppSecretEnc ? openSecret(event.waAppSecretEnc) : null;
  return handleStatusWebhook(req, secret, event?.id);
}
