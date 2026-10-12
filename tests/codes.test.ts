import { describe, expect, it } from "vitest";
import { CODE_ALPHABET, CODE_LENGTH, formatCode, generateCode, normalizeCode } from "@/lib/codes";

describe("invite codes", () => {
  it("uses only the unambiguous alphabet", () => {
    for (let i = 0; i < 2000; i++) {
      const code = generateCode();
      expect(code).toHaveLength(CODE_LENGTH);
      for (const ch of code) expect(CODE_ALPHABET).toContain(ch);
    }
    expect(CODE_ALPHABET).not.toMatch(/[01ILO]/);
  });

  it("is effectively unique", () => {
    const codes = new Set(Array.from({ length: 20000 }, generateCode));
    expect(codes.size).toBe(20000);
  });

  it("normalizes what guests type", () => {
    expect(normalizeCode(" abcd-efgh ")).toBe("ABCDEFGH");
    expect(normalizeCode("ABCD EFGH")).toBe("ABCDEFGH");
    expect(normalizeCode("ABCD-EFG0")).toBeNull();
    expect(normalizeCode("ABC")).toBeNull();
    expect(formatCode("ABCDEFGH")).toBe("ABCD-EFGH");
  });
});
