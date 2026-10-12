import { z } from "zod";
import type { ScannerRef } from "./scanners";

/** Pairing link token on first visit, or the stored device id when re-authenticating. */
export const scannerRefSchema = z.union([
  z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{32}$/) }),
  z.object({ deviceId: z.string().min(1).max(40) }),
]);

export const refKey = (ref: ScannerRef) => ("token" in ref ? `t:${ref.token}` : `d:${ref.deviceId}`);

export const scannerMessages = {
  not_found: "This scanner link isn't valid. Ask the organiser to send you a new one.",
  revoked: "This device has been removed as a scanner. Ask the organiser to send you a new link.",
  expired: "This scanner link has expired. Ask the organiser to send you a new one.",
  invalid: "This request expired. Please try again.",
  bad_signature: "We couldn't verify this device. Please try again.",
  claimed_elsewhere: "This link has already been used to set up another phone. Ask the organiser to send you a new one.",
} as const;
