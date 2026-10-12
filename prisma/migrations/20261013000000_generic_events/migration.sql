-- Events are no longer weddings only. Existing rows keep their data and default to the "wedding" kind.
ALTER TABLE "Event" RENAME COLUMN "coupleNames" TO "title";

-- AlterTable
ALTER TABLE "Event" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'wedding',
ADD COLUMN "eyebrow" TEXT,
ADD COLUMN "inviteLine" TEXT,
ALTER COLUMN "messageTemplateName" SET DEFAULT 'event_invite';
