import type { NextConfig } from "next";

// Extra origins allowed to load the dev server, e.g. your Mac's LAN IP or an ngrok host:
// ALLOWED_DEV_ORIGINS="192.168.0.12,*.ngrok-free.app"
const allowedDevOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  ...(allowedDevOrigins.length ? { allowedDevOrigins } : {}),
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
