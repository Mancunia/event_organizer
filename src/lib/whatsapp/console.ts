import { randomUUID } from "node:crypto";
import type { WhatsAppProvider } from "./types";

/** Development provider: logs the message instead of sending it. */
export const consoleProvider: WhatsAppProvider = {
  async sendInvite(message) {
    console.log(
      `[whatsapp:console] to=${message.to} template=${message.templateName}\n` +
        `  Hi ${message.guestName}, you're invited to ${message.title}.\n` +
        `  Your code: ${message.code}\n  Claim it: ${message.claimUrl}`,
    );
    return { messageId: `console-${randomUUID()}` };
  },
  async sendScannerLink(message) {
    console.log(
      `[whatsapp:console] to=${message.to} template=${message.templateName}\n` +
        `  Hi ${message.staffName}, you're checking guests in at ${message.title} (${message.label}).\n` +
        `  Set up your phone: ${message.url}`,
    );
    return { messageId: `console-${randomUUID()}` };
  },
};
