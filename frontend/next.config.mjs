import { createRequire } from 'module';
const require = createRequire(import.meta.url);

let withBundleAnalyzer;
try {
  // Try importing the bundle analyzer wrapper creator
  withBundleAnalyzer = require('@next/bundle-analyzer');
} catch (err) {
  // Fallback signature match: returns a function that returns the configuration object directly
  withBundleAnalyzer = () => (config) => config;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Silences custom Webpack configuration conflicts under Turbopack
  turbopack: {},
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '8000',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/media/:path*',
        destination: 'http://127.0.0.1:8000/media/:path*',
      },
    ];
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Split node_modules vendor libraries into a separate cache chunk group
      config.optimization.splitChunks.cacheGroups.vendors = {
        test: /[\\/]node_modules[\\/]/,
        name: 'vendors',
        chunks: 'all',
      };
    }
    return config;
  }
};

const analyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

export default analyzer(nextConfig);
