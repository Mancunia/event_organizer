import { beforeAll, describe, expect, it } from "vitest";
import { openSecret, sealSecret } from "@/lib/secret-box";

beforeAll(() => {
  process.env.CREDENTIALS_SECRET = "test-credentials-secret-test-credentials";
});

describe("secret box", () => {
  it("round-trips and never stores the plaintext", () => {
    const sealed = sealSecret("EAAG-token-123");
    expect(sealed).not.toContain("EAAG");
    expect(openSecret(sealed)).toBe("EAAG-token-123");
  });

  it("uses a fresh IV each time", () => {
    expect(sealSecret("same")).not.toBe(sealSecret("same"));
  });

  it("rejects tampered values", () => {
    const [v, iv, tag, data] = sealSecret("EAAG-token-123").split(".");
    const flipped = Buffer.from(data, "base64url");
    flipped[0] ^= 1;
    expect(openSecret([v, iv, tag, flipped.toString("base64url")].join("."))).toBeNull();
    expect(openSecret("garbage")).toBeNull();
  });

  it("rejects values sealed with another secret", () => {
    const sealed = sealSecret("EAAG-token-123");
    process.env.CREDENTIALS_SECRET = "another-credentials-secret-another-one";
    expect(openSecret(sealed)).toBeNull();
    process.env.CREDENTIALS_SECRET = "test-credentials-secret-test-credentials";
  });
});
