import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    /* config options here */
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb", // This allows images up to 10MB
    },
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
    ],
  },
};

export default nextConfig;
