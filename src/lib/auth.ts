import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";
import { env } from "./env";
import { loadScanner } from "./scanners";

type AdminSession = { admin?: boolean };
/** Check-in devices this browser has proven it holds the key for; `keyX` pins each to its current binding. */
export type StaffSession = { scanners?: { eventId: string; deviceId: string; keyX: string }[] };
/** The hosts' read-only access to their own guest list. */
type ClientSession = { eventIds?: string[] };
/** Proof that this browser holds the private key bound to `inviteId`. `keyX` pins it to the current binding. */
export type GuestSession = { inviteId?: string; eventId?: string; keyX?: string };

const secure = process.env.NODE_ENV === "production";

function options(cookieName: string, maxAge: number): SessionOptions {
  return {
    cookieName,
    password: env.sessionSecret,
    ttl: maxAge,
    cookieOptions: { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge },
  };
}

export async function adminSession() {
  return getIronSession<AdminSession>(await cookies(), options("wi_admin", 60 * 60 * 12));
}

export async function staffSession() {
  return getIronSession<StaffSession>(await cookies(), options("wi_staff", 60 * 60 * 24 * 7));
}

export async function clientSession() {
  return getIronSession<ClientSession>(await cookies(), options("wi_client", 60 * 60 * 12));
}

export async function guestSession() {
  return getIronSession<GuestSession>(await cookies(), options("wi_guest", 60 * 60 * 12));
}

export async function isAdmin(): Promise<boolean> {
  return (await adminSession()).admin === true;
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new Error("Unauthorized");
}

/** The bound, unrevoked scanner device this browser is signed in as for the event, if any. */
export async function currentScanner(eventId: string) {
  const entry = (await staffSession()).scanners?.find((s) => s.eventId === eventId);
  return loadScanner(entry, eventId);
}

export async function isStaffFor(eventId: string): Promise<boolean> {
  return (await isAdmin()) || (await currentScanner(eventId)) !== null;
}

export async function isClientFor(eventId: string): Promise<boolean> {
  return (await isAdmin()) || ((await clientSession()).eventIds ?? []).includes(eventId);
}

export function checkAdminPassword(input: string): boolean {
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(env.adminPassword).digest();
  return timingSafeEqual(a, b);
}
