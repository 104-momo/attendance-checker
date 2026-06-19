import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  // 构建时跳过 ESLint 检查，避免 lint 警告导致部署失败
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
