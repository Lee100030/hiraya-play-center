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
      { protocol: 'https', hostname: '**.onrender.com' },
      { protocol: 'https', hostname: 'www.hirayalearningcenter.app' },
    ],
  },
  async redirects() {
    return [
      { source: '/login', destination: '/admin', permanent: false },
      { source: '/admin/dashboard', destination: '/app', permanent: false },
      { source: '/admin/students', destination: '/app/students', permanent: false },
      { source: '/admin/teachers', destination: '/app/staff', permanent: false },
      { source: '/admin/enrollment', destination: '/app/enrollment', permanent: false },
      { source: '/admin/payments', destination: '/app/payments', permanent: false },
      { source: '/admin/attendance', destination: '/app/attendance', permanent: false },
      { source: '/admin/programs', destination: '/app/programs', permanent: false },
    ];
  },
};

export default nextConfig;
