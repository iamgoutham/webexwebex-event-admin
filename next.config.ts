import type { NextConfig } from "next";
import { execSync } from "child_process";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "drive.google.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  generateBuildId: async () => {
    try {
      return execSync("git rev-parse HEAD").toString().trim();
    } catch {
      return process.env.BUILD_ID ?? `build-${Date.now()}`;
    }
  },
};

export default nextConfig;
