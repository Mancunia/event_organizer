import type { WhatsAppProvider } from "./types";

/**
 * WhatsApp Business Cloud API. Each message is an approved template whose body takes four parameters:
 *   invites:       {{1}} guest name, {{2}} event title, {{3}} invite code, {{4}} claim link
 *   scanner links: {{1}} staff name, {{2}} event title, {{3}} device label, {{4}} setup link
 */
export function metaCloudProvider({ token, phoneNumberId }: { token: string; phoneNumberId: string }): WhatsAppProvider {
  const version = process.env.WA_API_VERSION ?? "v21.0";

  async function sendTemplate(to: string, templateName: string, language: string, params: string[]) {
    const res = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace(/^\+/, ""),
        type: "template",
        template: {
          name: templateName,
          language: { code: language },
          components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }],
        },
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      messages?: { id: string }[];
      error?: { message?: string };
    };
    if (!res.ok || !body.messages?.[0]?.id) {
      throw new Error(body.error?.message ?? `WhatsApp API error ${res.status}`);
    }
    return { messageId: body.messages[0].id };
  }

  return {
    sendInvite: (m) => sendTemplate(m.to, m.templateName, m.language, [m.guestName, m.title, m.code, m.claimUrl]),
    sendScannerLink: (m) => sendTemplate(m.to, m.templateName, m.language, [m.staffName, m.title, m.label, m.url]),
  };
}
