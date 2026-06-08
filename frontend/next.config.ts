import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: false,
  // 静态导出由 Flask 托管，无 Next 图片优化服务；避免请求 /_next/image 404
  images: {
    unoptimized: true,
  },
  env: {},
};

export default withNextIntl(nextConfig);
