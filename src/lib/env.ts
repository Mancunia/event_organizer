function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

function withScheme(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export const env = {
  // APP_URL wins; on Vercel fall back to the stable production domain (links sent over
  // WhatsApp must survive redeploys), then the per-deployment preview URL.
  get appUrl() {
    const url =
      process.env.APP_URL ||
      (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
      process.env.VERCEL_URL;
    return (url ? withScheme(url) : "http://localhost:3000").replace(/\/$/, "");
  },
  get sessionSecret() {
    const secret = required("SESSION_SECRET");
    if (secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
    return secret;
  },
  get adminPassword() {
    return required("ADMIN_PASSWORD");
  },
  get qrSecret() {
    const secret = required("QR_SECRET");
    if (secret.length < 32) throw new Error("QR_SECRET must be at least 32 characters");
    return secret;
  },
  get credentialsSecret() {
    const secret = required("CREDENTIALS_SECRET");
    if (secret.length < 32) throw new Error("CREDENTIALS_SECRET must be at least 32 characters");
    return secret;
  },
  get waProvider(): "console" | "meta" {
    return process.env.WA_PROVIDER === "meta" ? "meta" : "console";
  },
};
