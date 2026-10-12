"use client";

import { useActionState } from "react";
import { saveWhatsAppAccount } from "@/app/admin/actions";
import { FormStatus } from "./FormStatus";

export type WhatsAppAccountSummary = {
  phoneNumberId: string | null;
  hasToken: boolean;
  hasAppSecret: boolean;
  verifyToken: string | null;
  webhookUrl: string;
};

export function WhatsAppAccountForm({ eventId, account }: { eventId: string; account: WhatsAppAccountSummary }) {
  const [state, action, pending] = useActionState(saveWhatsAppAccount.bind(null, eventId), null);
  const connected = account.phoneNumberId !== null && account.hasToken;
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <label className="block sm:col-span-2">
        <span className="label">Phone number ID</span>
        <input name="phoneNumberId" className="input" inputMode="numeric" defaultValue={account.phoneNumberId ?? ""} required />
        <span className="mt-1 block text-xs text-ink-muted">From WhatsApp Manager → API setup. Not the phone number itself.</span>
      </label>
      <label className="block">
        <span className="label">{account.hasToken ? "New access token (leave blank to keep)" : "Access token"}</span>
        <input name="accessToken" type="password" className="input" autoComplete="off" required={!account.hasToken} />
        <span className="mt-1 block text-xs text-ink-muted">A permanent system-user token with whatsapp_business_messaging.</span>
      </label>
      <label className="block">
        <span className="label">{account.hasAppSecret ? "New app secret (leave blank to keep)" : "App secret (optional)"}</span>
        <input name="appSecret" type="password" className="input" autoComplete="off" />
        <span className="mt-1 block text-xs text-ink-muted">Only needed for delivery receipts.</span>
      </label>
      {connected && account.verifyToken && (
        <div className="space-y-1 text-sm sm:col-span-2">
          <p className="text-ink-muted">For delivery receipts, set this webhook in the client&apos;s Meta app and subscribe to <code>messages</code>:</p>
          <p>
            Callback URL: <code className="break-all">{account.webhookUrl}</code>
          </p>
          <p>
            Verify token: <code className="break-all">{account.verifyToken}</code>
          </p>
        </div>
      )}
      <div className="flex items-center gap-4 sm:col-span-2">
        <button className="btn" disabled={pending}>
          {pending ? "Saving…" : connected ? "Update account" : "Connect account"}
        </button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}
