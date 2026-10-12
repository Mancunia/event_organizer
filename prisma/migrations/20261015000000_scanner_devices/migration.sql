-- Scanner devices are paired by one-time WhatsApp links; they replace the shared staff PIN.
-- AlterTable
ALTER TABLE "Event" DROP COLUMN "staffPinHash",
ADD COLUMN     "scannerTemplateName" TEXT NOT NULL DEFAULT 'scanner_link';

-- AlterTable
ALTER TABLE "Invite" ADD COLUMN     "checkedInById" TEXT;

-- CreateTable
CREATE TABLE "ScannerDevice" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "staffName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "devicePublicKey" JSONB,
    "boundAt" TIMESTAMP(3),
    "boundUserAgent" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "sendStatus" TEXT,
    "sendError" TEXT,
    "waMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScannerDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScannerNonce" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "ScannerNonce_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScannerDevice_token_key" ON "ScannerDevice"("token");

-- CreateIndex
CREATE UNIQUE INDEX "ScannerDevice_waMessageId_key" ON "ScannerDevice"("waMessageId");

-- CreateIndex
CREATE INDEX "ScannerDevice_eventId_idx" ON "ScannerDevice"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "ScannerNonce_value_key" ON "ScannerNonce"("value");

-- CreateIndex
CREATE INDEX "ScannerNonce_deviceId_idx" ON "ScannerNonce"("deviceId");

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_checkedInById_fkey" FOREIGN KEY ("checkedInById") REFERENCES "ScannerDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScannerDevice" ADD CONSTRAINT "ScannerDevice_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScannerNonce" ADD CONSTRAINT "ScannerNonce_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "ScannerDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

