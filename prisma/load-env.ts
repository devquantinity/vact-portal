import { config } from "dotenv";

// Imported first by the seed so the values are in place before any module reads them.
// SEED_ENV_FILE=.env.production.local pnpm db:seed seeds a hosted database with values pulled from Vercel.
config({ path: process.env.SEED_ENV_FILE ?? ".env" });
