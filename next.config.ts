import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  experimental: {
    dynamicOnHover: true,
    authInterrupts: true,
  },
};

export default nextConfig;
