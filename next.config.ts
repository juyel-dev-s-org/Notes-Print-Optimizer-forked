import type {NextConfig} from 'next';
import bundleAnalyzer from '@next/bundle-analyzer';

const isGitHubActions = process.env.GITHUB_ACTIONS === 'true' || process.env.GITHUB_ACTIONS === '1';
const repoName = process.env.GITHUB_REPOSITORY ? process.env.GITHUB_REPOSITORY.split('/')[1] : '';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || (isGitHubActions && repoName ? `/${repoName}` : '');

const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === 'true' });

const nextConfig: NextConfig = {
  output: 'export',
  // Directory-style URLs (/tools/<slug>/, /offline/) — matches the service
  // worker's OFFLINE_URL and manifest start_url contract, emits
  // <route>/index.html so every static host serves deep links identically.
  trailingSlash: true,
  ...(basePath ? { basePath, assetPrefix: `${basePath}/` } : {}),
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  transpilePackages: ['motion'],
};

export default withBundleAnalyzer(nextConfig);
