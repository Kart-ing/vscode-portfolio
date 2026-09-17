import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Parallel dev servers need separate build directories:
  // NEXT_DIST_DIR=.next-ui npx next dev --port 3103
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
