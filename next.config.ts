import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep browser integration builds separate from the developer server.
  distDir:
    process.env.SALON77_INTEGRATION_TEST === "1"
      ? ".next-integration"
      : ".next",
};

export default nextConfig;
