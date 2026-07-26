import type {NextConfig} from 'next';

const isGitHubActions = process.env.GITHUB_ACTIONS === 'true' || process.env.GITHUB_ACTIONS === '1';
const repoName = process.env.GITHUB_REPOSITORY ? process.env.GITHUB_REPOSITORY.split('/')[1] : '';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || (isGitHubActions && repoName ? `/${repoName}` : '');

const nextConfig: NextConfig = {
  ...(isGitHubActions ? { output: 'export' } : {}),
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**', // This allows any path under the hostname
      },
    ],
  },
  transpilePackages: ['motion'],
  webpack: (config, {dev}) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
