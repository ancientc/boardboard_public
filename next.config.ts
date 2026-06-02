import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Makes Cloudflare bindings (D1, R2, Durable Objects) available to
// getCloudflareContext() while running `next dev`.
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // konva imports the Node.js "canvas" package for server-side rendering.
    // We only use it client-side (via next/dynamic ssr:false), so stub it out.
    config.externals = [
      ...(Array.isArray(config.externals) ? config.externals : []),
      { canvas: "canvas" },
    ];
    return config;
  },
};

export default nextConfig;
