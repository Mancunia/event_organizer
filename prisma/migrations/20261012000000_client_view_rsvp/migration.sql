-- AlterTable
ALTER TABLE "Event" ADD COLUMN "clientPasswordHash" TEXT;

-- AlterTable
ALTER TABLE "Invite" ADD COLUMN "rsvpStatus" TEXT,
ADD COLUMN "rsvpCount" INTEGER,
ADD COLUMN "rsvpAt" TIMESTAMP(3);
