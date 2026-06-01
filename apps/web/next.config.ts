import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Scope file tracing to this repo only — there are other lockfiles in
  // ~/Documents/project/ that Next would otherwise pull into the trace.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: ["@tomois/shared", "@tomois/ui"],
};

export default nextConfig;
