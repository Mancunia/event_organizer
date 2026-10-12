import type { Prisma } from "@prisma/client";
import { db } from "./db";

export async function audit(
  action: string,
  data: { eventId?: string; inviteId?: string; meta?: Prisma.InputJsonValue } = {},
) {
  await db.auditLog.create({ data: { action, ...data } });
}
