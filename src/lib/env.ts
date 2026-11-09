import { z } from "zod";

/**
 * Typed access to environment variables. Everything provider-related lives here so the
 * same code runs on a laptop today and on a server later without touching the source.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  APP_URL: z.string().url().default("http://localhost:3000"),
  SESSION_SECRET: z.string().min(32),
  UPLOAD_DIR: z.string().default("./uploads"),
  CRON_SECRET: z.string().default(""),

  WHATSAPP_MODE: z.enum(["live", "simulate"]).default("simulate"),
  GRAPH_API_VERSION: z.string().default("v24.0"),
  WHATSAPP_PHONE_NUMBER_ID: z.string().default(""),
  WHATSAPP_ACCESS_TOKEN: z.string().default(""),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().default(""),
  WHATSAPP_APP_SECRET: z.string().default(""),
  WHATSAPP_VERIFY_TOKEN: z.string().default("vact-verify"),
  WHATSAPP_TEMPLATE_NAME: z.string().default("vact_reminder"),
  WHATSAPP_TEMPLATE_LANGUAGE: z.string().default("en"),

  RESEND_API_KEY: z.string().default(""),
  EMAIL_FROM: z.string().default("V ACT Client Portal <portal@quantinity.com>"),
  RESEND_WEBHOOK_SECRET: z.string().default(""),

  SEED_DEMO_PHONE: z.string().default("+60123456789"),
  SEED_DEMO_EMAIL: z.string().default("client@vact.demo"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment: ${issues}. Copy .env.example to .env and fill it in.`);
  }
  cached = parsed.data;
  return cached;
}

export const FIRM_NAME = "V ACT Management Services Sdn Bhd";
export const FIRM_SHORT = "V ACT";
export const TIMEZONE = "Asia/Kuala_Lumpur";
