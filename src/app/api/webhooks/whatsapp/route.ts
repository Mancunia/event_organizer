import { handleStatusWebhook, verifySubscription } from "@/lib/whatsapp/webhook";

// Platform account (WA_* env vars). Events using a client's own account have their own URL: ./[eventId]

export async function GET(req: Request) {
  return verifySubscription(req, process.env.WA_VERIFY_TOKEN);
}

export async function POST(req: Request) {
  return handleStatusWebhook(req, process.env.WA_APP_SECRET);
}
