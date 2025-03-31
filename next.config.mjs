/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        dns: false,
      };
    }
    return config;
  },
  env: {
    // Gunakan RENDER_EXTERNAL_URL untuk environment production
    // dan fallback ke localhost untuk development
    NEXT_PUBLIC_BASE_URL: process.env.RENDER_EXTERNAL_URL || 'http://localhost:10000',
  },
};

export default nextConfig;
