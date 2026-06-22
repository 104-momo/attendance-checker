import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  // Cloudflare Workers 节点兼容：允许在边缘运行时使用 Buffer 等 Node.js API
  experimental: {
    // 让 Next.js 知道这是部署到 Cloudflare 的项目
    // @opennextjs/cloudflare 会自动处理大多数配置
  },
};

export default nextConfig;
