export type InviteMessage = {
  /** E.164, e.g. +233241234567 */
  to: string;
  guestName: string;
  title: string;
  code: string;
  claimUrl: string;
  templateName: string;
  language: string;
};

/** Pairing link for a staff member's check-in device. */
export type ScannerLinkMessage = {
  /** E.164 */
  to: string;
  staffName: string;
  title: string;
  /** e.g. "Gate A" */
  label: string;
  url: string;
  templateName: string;
  language: string;
};

export interface WhatsAppProvider {
  sendInvite(message: InviteMessage): Promise<{ messageId: string }>;
  sendScannerLink(message: ScannerLinkMessage): Promise<{ messageId: string }>;
}
