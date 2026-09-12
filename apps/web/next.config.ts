import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@hiraya/api',
    '@hiraya/config',
    '@hiraya/types',
    '@hiraya/ui',
    '@hiraya/utils',
    '@hiraya/validation',
  ],
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: '127.0.0.1' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
  async redirects() {
    return [{ source: '/login', destination: '/admin', permanent: false }];
  },
};

export default nextConfig;
