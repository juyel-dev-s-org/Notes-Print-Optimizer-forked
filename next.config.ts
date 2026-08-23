import type {NextConfig} from 'next';
import bundleAnalyzer from '@next/bundle-analyzer';

/**
 * Base path comes ONLY from an explicit env var — never inferred from the
 * environment (the old GITHUB_ACTIONS auto-detection once silently built
 * Pages-style paths inside CI, breaking root-hosted E2E). Vercel/any root
 * host needs nothing; subpath deploys opt in deliberately.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

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
