import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  // Keep tracing inside this app when the repository sits below a workspace
  // that also contains an unrelated package-manager lockfile.
  outputFileTracingRoot: process.cwd(),
};
export default nextConfig;
