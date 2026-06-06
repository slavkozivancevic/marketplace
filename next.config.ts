import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  transpilePackages: ["pdfjs-dist"],
  serverExternalPackages: [
    "fluent-ffmpeg",
    "ffmpeg-static",
    "@ffprobe-installer/ffprobe",
    "sharp",
  ],
  cacheComponents: true,
  allowedDevOrigins: ["localhost", "*.ngrok-free.dev", "*.ngrok-free.app"],
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
      { protocol: "https", hostname: "**.amazonaws.com" },
      { protocol: "https", hostname: "**.s3.amazonaws.com" },
      { protocol: "https", hostname: "**.ngrok-free.app" },
      { protocol: "https", hostname: "**.ngrok-free.dev" },
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default withNextIntl(nextConfig);
