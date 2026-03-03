/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: false,
  turbopack: {},
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
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'mms.img.susercontent.com' },
      { protocol: 'https', hostname: 'cf.shopee.co.id' },
    ],
  },
  env: {
    // Gunakan RENDER_EXTERNAL_URL untuk environment production
    // dan fallback ke localhost untuk development
    NEXT_PUBLIC_BASE_URL: 'https://zavena.net' || 'http://localhost:10000',
  },
};

export default nextConfig;
