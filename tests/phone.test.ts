import { describe, expect, it } from "vitest";
import { normalizePhone } from "@/lib/phone";

describe("normalizePhone", () => {
  it("handles local, international and 00 formats", () => {
    expect(normalizePhone("024 123 4567", "233")).toBe("+233241234567");
    expect(normalizePhone("+44 7700 900123", "233")).toBe("+447700900123");
    expect(normalizePhone("00447700900123", "233")).toBe("+447700900123");
    expect(normalizePhone("abc", "233")).toBeNull();
  });
});
