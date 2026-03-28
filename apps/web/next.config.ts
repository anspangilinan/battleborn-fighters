import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@battleborn/game-core", "@battleborn/content"],
};

export default nextConfig;
