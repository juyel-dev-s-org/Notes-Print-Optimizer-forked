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
        pathname: '/**',
      },
    ],
  },
  transpilePackages: ['motion'],
  webpack: (config, {isServer, dev}) => {
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = { ignored: /.*/ };
    }
    if (!isServer) {
      config.output = {
        ...config.output,
        chunkFilename: dev ? '[name].js' : '[name].[contenthash:8].js',
      };
    }
    return config;
  },
};

export default nextConfig;
