import "dotenv/config";
import { z } from "zod";

// Convierte "" (variable presente en .env pero vacía) en undefined, para que
// .optional() funcione como se espera en vez de fallar la validación de formato.
const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);
const optionalString = (schema: z.ZodString = z.string().min(1)) =>
  z.preprocess(emptyToUndefined, schema.optional());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  BASE_URL: z.string().url(),
  TZ: z.string().default("America/Argentina/Buenos_Aires"),

  DATABASE_URL: z.string().min(1),

  // Estas integraciones se van habilitando en fases posteriores del roadmap
  // (Fase 2 WhatsApp, Fase 3.5 IA, Fase 4 Mercado Pago, Fase 8 email). Se dejan
  // opcionales para no bloquear el desarrollo de fases tempranas; cada módulo
  // que las use valida explícitamente que estén presentes antes de operar.
  WHATSAPP_TOKEN: optionalString(),
  WHATSAPP_PHONE_NUMBER_ID: optionalString(),
  WHATSAPP_BUSINESS_ACCOUNT_ID: optionalString(),
  WHATSAPP_VERIFY_TOKEN: optionalString(),
  WHATSAPP_APP_SECRET: optionalString(),

  MERCADOPAGO_ACCESS_TOKEN: optionalString(),
  MERCADOPAGO_WEBHOOK_SECRET: optionalString(),
  MP_ALIAS: z.string().min(1).default("fortin.baile"),

  ANTHROPIC_API_KEY: optionalString(),

  QR_SIGNING_SECRET: z.string().min(16),
  SESSION_SECRET: z.string().min(16),
  JWT_SECRET: z.string().min(16),
  ADMIN_SEED_EMAIL: z.string().email(),
  ADMIN_SEED_PASSWORD: z.string().min(8),

  GMAIL_USER: optionalString(z.string().email()),
  GMAIL_APP_PASSWORD: optionalString(),
  ADMIN_EMAILS: z.string().default(""),

  RESERVATION_TTL_MINUTES: z.coerce.number().int().positive().default(5),
  PAYMENT_MATCH_WINDOW_MINUTES: z.coerce.number().int().positive().default(45),
  AMOUNT_DISTINGUISHING_STEP: z.coerce.number().positive().default(0.01),

  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Variables de entorno inválidas o faltantes:");
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error("Configuración de entorno inválida. Revisá el .env contra .env.example.");
}

export const env = {
  ...parsed.data,
  adminEmails: parsed.data.ADMIN_EMAILS.split(",").map((e) => e.trim()).filter(Boolean),
};
