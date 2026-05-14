import { config as dotenvConfig } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

function normalizeEnvString(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  // Host panels sometimes store env values with literal wrapping quotes.
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

const requestedTimezone = normalizeEnvString(process.env.TZ ?? process.env.APP_TIMEZONE ?? "Asia/Manila");
if (typeof requestedTimezone === "string" && requestedTimezone.length > 0) {
  process.env.TZ = requestedTimezone;
}

const appEnv = normalizeEnvString(process.env.APP_ENV ?? "development");
const localEnvPath = path.resolve(process.cwd(), ".env");

if (appEnv !== "production" && fs.existsSync(localEnvPath)) {
  dotenvConfig({
    path: localEnvPath,
    override: false
  });
}

const cleanedProcessEnv = Object.fromEntries(
  Object.entries(process.env).map(([k, v]) => [k, normalizeEnvString(v)])
);

const defaultPort = (() => {
  const fromPortEnv = Number(cleanedProcessEnv.PORT);
  return Number.isInteger(fromPortEnv) && fromPortEnv > 0 ? fromPortEnv : 3000;
})();

const optionalUrl = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.string().url().optional()
);

const envSchema = z.object({
  APP_ENV: z.string().default("development"),
  APP_PORT: z.coerce.number().int().positive().default(defaultPort),
  APP_HOST: z.string().default("0.0.0.0"),
  APP_TIMEZONE: z.string().default("Asia/Manila"),
  FRONTEND_ORIGIN: z.string().default("http://localhost:5173"),
  PLATFORM_BASE_DOMAIN: z.string().default(""),
  PLATFORM_CHECKOUT_SUCCESS_URL: optionalUrl,
  PLATFORM_CHECKOUT_CANCEL_URL: optionalUrl,
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().optional().default(""),
  DB_NAME: z.string().min(1),
  DB_CONNECTION_LIMIT: z.coerce.number().int().positive().default(10),
  JWT_SECRET: z.string().min(1),
  JWT_EXPIRES_IN: z.string().default("7d"),
  UPLOADS_BASE_PATH: z.string().default("/uploads"),
  PUBLIC_FILES_BASE_URL: z.string().url().default(`http://localhost:${defaultPort}`),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  AI_PROVIDER: z.string().default("disabled"),
  AI_BASE_URL: z.string().default("https://api.openai.com/v1"),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
  AI_EMBEDDING_MODEL: z.string().optional(),
  AI_CHAT_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  BILLING_PROVIDER_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  XENDIT_SECRET_KEY: z.string().optional(),
  XENDIT_WEBHOOK_TOKEN: z.string().optional(),
  PDF_GENERATOR_BASE_URL: optionalUrl,
  PDF_GENERATOR_API_KEY: z.string().optional(),
  PDF_GENERATOR_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  PDF_COMPANY_NAME: z.string().default("JRSPC Hardware Enterprise"),
  PDF_COMPANY_ADDRESS: z.string().default("Bacolod City, Philippines"),
  PDF_COMPANY_PHONE: z.string().default("+63 9318581575"),
  PDF_COMPANY_EMAIL: z.string().default("admin@jrspc.local"),
  PDF_COMPANY_LOGO_URL: optionalUrl
});

const parsed = envSchema.safeParse(cleanedProcessEnv);

if (!parsed.success) {
  console.error("Environment Validation Error:", JSON.stringify(parsed.error.format(), null, 2));
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}

export const env = parsed.data;
