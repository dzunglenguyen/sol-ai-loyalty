import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // output: "standalone", // disabled for local dev — re-enable for Docker builds
  serverExternalPackages: ["@copilotkit/runtime"],
  turbopack: {
    // Keep Turbopack rooted at this monorepo, avoid scanning parent lockfiles.
    root: path.resolve(__dirname, "..", ".."),
  },
};

export default nextConfig;
