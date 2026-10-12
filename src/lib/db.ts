import { PrismaClient } from "@prisma/client";

// Encrypted client credentials are left out of every Event query unless explicitly selected,
// so they can't leak into pages or client components that receive a whole event.
const createClient = () => new PrismaClient({ omit: { event: { waAccessTokenEnc: true, waAppSecretEnc: true } } });

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
