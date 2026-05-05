import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  // 开发者工具指示器（只在开发环境生效，生产环境自动隐藏）
  devIndicators: {
    position: 'bottom-right',
  },
};

export default nextConfig;
