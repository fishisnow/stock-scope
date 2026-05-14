import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: false,
  env: {},
};

export default withNextIntl(nextConfig);
