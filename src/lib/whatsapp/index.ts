import { env } from "../env";
import { openSecret } from "../secret-box";
import { consoleProvider } from "./console";
import { metaCloudProvider } from "./meta-cloud";
import type { WhatsAppProvider } from "./types";

export type { InviteMessage, ScannerLinkMessage, WhatsAppProvider } from "./types";

type EventAccount = { waPhoneNumberId: string | null; waAccessTokenEnc: string | null };

/** The client's own business account when the event has one; otherwise the platform account from env. */
export function whatsapp(event?: EventAccount): WhatsAppProvider {
  if (event?.waPhoneNumberId && event.waAccessTokenEnc) {
    const token = openSecret(event.waAccessTokenEnc);
    if (!token) throw new Error("Saved WhatsApp access token can't be decrypted — re-enter it in the event's WhatsApp settings");
    return metaCloudProvider({ token, phoneNumberId: event.waPhoneNumberId });
  }
  if (env.waProvider === "console") return consoleProvider;
  const token = process.env.WA_TOKEN;
  const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) throw new Error("WA_TOKEN and WA_PHONE_NUMBER_ID are required for WA_PROVIDER=meta");
  return metaCloudProvider({ token, phoneNumberId });
}
