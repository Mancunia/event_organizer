import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validSignature, verifySubscription } from "@/lib/whatsapp/webhook";

describe("WhatsApp webhook", () => {
  it("accepts only bodies signed with the app secret", () => {
    const body = '{"entry":[]}';
    const header = `sha256=${createHmac("sha256", "app-secret").update(body).digest("hex")}`;
    expect(validSignature(body, header, "app-secret")).toBe(true);
    expect(validSignature(body, header, "other-secret")).toBe(false);
    expect(validSignature(body + " ", header, "app-secret")).toBe(false);
    expect(validSignature(body, null, "app-secret")).toBe(false);
  });

  it("answers the subscription handshake only with the right verify token", async () => {
    const url = "https://example.com/hook?hub.mode=subscribe&hub.verify_token=tok&hub.challenge=42";
    const ok = verifySubscription(new Request(url), "tok");
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe("42");
    expect(verifySubscription(new Request(url), "other").status).toBe(403);
    expect(verifySubscription(new Request(url), null).status).toBe(403);
  });
});
