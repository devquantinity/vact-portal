import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every authenticated page reads the session cookie and the database on each request,
  // so the classic per-request dynamic rendering model fits better than Cache Components.
  cacheComponents: false,
  devIndicators: { position: "bottom-right" },
  serverExternalPackages: ["@node-rs/argon2", "@prisma/client", "@prisma/adapter-pg", "pg", "sharp"],
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
