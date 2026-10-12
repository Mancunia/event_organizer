import { beforeAll, describe, expect, it } from "vitest";
import { extractQrToken, signQrToken, verifyQrToken } from "@/lib/qr-token";

beforeAll(() => {
  process.env.QR_SECRET = "test-secret-test-secret-test-secret-123";
  process.env.APP_URL = "https://example.com";
});

describe("QR tokens", () => {
  it("round-trips", async () => {
    const token = await signQrToken({ inviteId: "inv1", eventId: "evt1" });
    expect(await verifyQrToken(token)).toEqual({ inviteId: "inv1", eventId: "evt1" });
  });

  it("rejects tampered payloads", async () => {
    const token = await signQrToken({ inviteId: "inv1", eventId: "evt1" });
    const [h, , s] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ inv: "inv2", evt: "evt1" })).toString("base64url");
    expect(await verifyQrToken(`${h}.${forged}.${s}`)).toBeNull();
  });

  it("rejects tokens signed with another secret", async () => {
    const token = await signQrToken({ inviteId: "inv1", eventId: "evt1" });
    process.env.QR_SECRET = "another-secret-another-secret-another-1";
    expect(await verifyQrToken(token)).toBeNull();
    process.env.QR_SECRET = "test-secret-test-secret-test-secret-123";
  });

  it("extracts tokens from scanned URLs", () => {
    expect(extractQrToken("https://example.com/v/aaa.bbb.ccc")).toBe("aaa.bbb.ccc");
    expect(extractQrToken("aaa.bbb.ccc")).toBe("aaa.bbb.ccc");
    expect(extractQrToken("ABCD-EFGH")).toBeNull();
  });
});
