import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: false,
  skipWaiting: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  turbopack: {},
  images: {
    remotePatterns: [
      {
      protocol: 'https',
      hostname: '**',
      },
    ],
    formats: ['image/avif', 'image/webp']
  },
  rewrites: async () => {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/api/:path*`,
      },
    ]
  },
  experimental: {
    scrollRestoration: true,
  },
};

export default withPWA(nextConfig);
