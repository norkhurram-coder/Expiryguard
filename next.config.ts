import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The worker threads load these files from disk at run time (they are not bundled),
  // so tell Vercel to copy them into every server function.
  outputFileTracingIncludes: {
    "/**": ["./lib/threads/analysis-worker.ts", "./lib/analysis.ts", "./lib/expiry.ts"],
  },
};

export default nextConfig;
