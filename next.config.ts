import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  experimental: {
    dynamicOnHover: true,
    authInterrupts: true,
  },
  images: {
    // domains: [
    //   "marketplace-product-images-slavko.s3.eu-central-1.amazonaws.com",
    //   "marketplace-product-images.s3.amazonaws.com",
    //   "images.unsplash.com",
    //   "res.cloudinary.com",
    // ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "**.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "**.ngrok-free.app",
      },
    ],
  },
};

export default nextConfig;
