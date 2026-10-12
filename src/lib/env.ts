function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

export const env = {
  get appUrl() {
    return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
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
