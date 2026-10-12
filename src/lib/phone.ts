/**
 * Normalizes to E.164. Numbers without a leading + or 00 get `defaultCountryCode` prepended
 * (after dropping a single trunk 0, e.g. 0241234567 -> +233241234567).
 */
export function normalizePhone(input: string, defaultCountryCode = process.env.DEFAULT_COUNTRY_CODE ?? "233"): string | null {
  let digits = input.trim().replace(/[\s().-]/g, "");
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
  if (!digits.startsWith("+")) digits = `+${defaultCountryCode}${digits.replace(/^0/, "")}`;
  return /^\+[1-9]\d{7,14}$/.test(digits) ? digits : null;
}
