import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [{ key: "ngrok-skip-browser-warning", value: "true" }],
      },
    ];
  },
  experimental: {
    dynamicOnHover: true,
    authInterrupts: true,
  },
  reactCompiler: true,
  images: {
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
