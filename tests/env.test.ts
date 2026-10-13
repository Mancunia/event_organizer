import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "@/lib/env";

function stub(vars: Record<string, string>) {
  for (const name of ["APP_URL", "VERCEL_ENV", "VERCEL_PROJECT_PRODUCTION_URL", "VERCEL_URL"]) {
    vi.stubEnv(name, vars[name] ?? "");
  }
}

describe("env.appUrl", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("prefers APP_URL", () => {
    stub({ APP_URL: "https://invites.example.com/", VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "x.vercel.app" });
    expect(env.appUrl).toBe("https://invites.example.com");
  });

  it("adds https to a bare APP_URL host", () => {
    stub({ APP_URL: "invites.example.com" });
    expect(env.appUrl).toBe("https://invites.example.com");
  });

  it("uses the production domain on Vercel production", () => {
    stub({ VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "wedding.vercel.app", VERCEL_URL: "wedding-abc123.vercel.app" });
    expect(env.appUrl).toBe("https://wedding.vercel.app");
  });

  it("uses the deployment URL on previews", () => {
    stub({ VERCEL_ENV: "preview", VERCEL_PROJECT_PRODUCTION_URL: "wedding.vercel.app", VERCEL_URL: "wedding-abc123.vercel.app" });
    expect(env.appUrl).toBe("https://wedding-abc123.vercel.app");
  });

  it("falls back to localhost", () => {
    stub({});
    expect(env.appUrl).toBe("http://localhost:3000");
  });
});
