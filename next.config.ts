import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A lockfile in a parent folder otherwise confuses Next about the project root.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
