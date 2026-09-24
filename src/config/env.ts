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
  // (Fase 2 WhatsApp, Fase 4 Mercado Pago, Fase 8 email). Se dejan
  // opcionales para no bloquear el desarrollo de fases tempranas; cada módulo
  // que las use valida explícitamente que estén presentes antes de operar.
  WHATSAPP_TOKEN: optionalString(),
  WHATSAPP_PHONE_NUMBER_ID: optionalString(),
  WHATSAPP_BUSINESS_ACCOUNT_ID: optionalString(),
  WHATSAPP_VERIFY_TOKEN: optionalString(),
  WHATSAPP_APP_SECRET: optionalString(),
  // Número público del bot (el que la gente ve en WhatsApp), en formato wa.me:
  // solo dígitos, con código de país, sin "+". Se usa para armar el link
  // "click to chat" que se codifica dentro del QR de cada entrada. Si no está
  // configurado, el QR cae al texto plano del payload (requiere pegarlo a mano).
  WHATSAPP_BOT_PHONE_NUMBER: optionalString(),
  // Números de WhatsApp de los verificadores de puerta (separados por coma), en
  // el mismo formato en que llegan en "message.from" del webhook: solo dígitos,
  // con código de país, sin "+" ni espacios. Cuando uno de estos números escribe
  // al bot, el texto se trata como un código de QR escaneado en la entrada en
  // vez de como un mensaje de compra.
  VERIFIER_PHONE_NUMBERS: z.string().default(""),

  MERCADOPAGO_ACCESS_TOKEN: optionalString(),
  MERCADOPAGO_WEBHOOK_SECRET: optionalString(),
  MP_ALIAS: z.string().min(1).default("fortin.baile"),

  QR_SIGNING_SECRET: z.string().min(16),
  SESSION_SECRET: z.string().min(16),
  JWT_SECRET: z.string().min(16),
  ADMIN_SEED_EMAIL: z.string().email(),
  ADMIN_SEED_PASSWORD: z.string().min(8),

  GMAIL_USER: optionalString(z.string().email()),
  GMAIL_APP_PASSWORD: optionalString(),
  ADMIN_EMAILS: z.string().default(""),

  RESERVATION_TTL_MINUTES: z.coerce.number().int().positive().default(5),
  // Tras ingresar la contraseña, un admin de reportes queda logueado en su
  // conversación de WhatsApp hasta que pasen tantos minutos sin consultar nada.
  REPORT_ADMIN_SESSION_IDLE_MINUTES: z.coerce.number().int().positive().default(15),
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
  verifierPhoneNumbers: parsed.data.VERIFIER_PHONE_NUMBERS.split(",")
    .map((p) => p.trim())
    .filter(Boolean),
};
