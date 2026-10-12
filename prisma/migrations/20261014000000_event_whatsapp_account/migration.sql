-- Each event can send through the client's own WhatsApp Business account; null = use the platform account from env.
ALTER TABLE "Event" ADD COLUMN "waPhoneNumberId" TEXT,
ADD COLUMN "waAccessTokenEnc" TEXT,
ADD COLUMN "waAppSecretEnc" TEXT,
ADD COLUMN "waVerifyToken" TEXT;
