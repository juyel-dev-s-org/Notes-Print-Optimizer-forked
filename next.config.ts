import type {NextConfig} from 'next';

const isGitHubActions = process.env.GITHUB_ACTIONS === 'true' || process.env.GITHUB_ACTIONS === '1';
const repoName = process.env.GITHUB_REPOSITORY ? process.env.GITHUB_REPOSITORY.split('/')[1] : '';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || (isGitHubActions && repoName ? `/${repoName}` : '');

const nextConfig: NextConfig = {
  output: 'export',
  ...(basePath ? { basePath, assetPrefix: `${basePath}/` } : {}),
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  transpilePackages: ['motion'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
