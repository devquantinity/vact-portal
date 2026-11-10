import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations want a direct connection; Neon on Vercel exposes it as DATABASE_URL_UNPOOLED.
    url: process.env.DATABASE_URL_UNPOOLED ? process.env.DATABASE_URL_UNPOOLED : env("DATABASE_URL"),
  },
});
