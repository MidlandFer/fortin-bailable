import crypto from "node:crypto";
import type { Request, Response, Router } from "express";
import { Router as createRouter } from "express";
import { env } from "../config/env";
import { markAsRead, sendText } from "./client";
import type { WhatsAppWebhookPayload } from "./types";

function verifySignature(req: Request): boolean {
  if (!env.WHATSAPP_APP_SECRET) return false;

  const signatureHeader = req.header("x-hub-signature-256");
  if (!signatureHeader?.startsWith("sha256=")) return false;

  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!rawBody) return false;

  const expected = crypto
    .createHmac("sha256", env.WHATSAPP_APP_SECRET)
    .update(rawBody)
    .digest("hex");
  const received = signatureHeader.slice("sha256=".length);

  const expectedBuf = Buffer.from(expected, "hex");
  const receivedBuf = Buffer.from(received, "hex");
  if (expectedBuf.length !== receivedBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

export function createWhatsAppWebhookRouter(): Router {
  const router = createRouter();

  // Meta llama a este endpoint una vez, al configurar el webhook, para confirmar
  // que somos dueños de la URL.
  router.get("/", (req: Request, res: Response) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === env.WHATSAPP_VERIFY_TOKEN) {
      res.status(200).send(challenge);
      return;
    }

    res.sendStatus(403);
  });

  router.post("/", async (req: Request, res: Response) => {
    // Respondemos 200 enseguida: Meta reintenta si no recibe 200 rápido, y no
    // queremos reintentos duplicados por procesamiento lento.
    res.sendStatus(200);

    if (!verifySignature(req)) {
      console.warn("Webhook de WhatsApp: firma inválida, se descarta el mensaje.");
      return;
    }

    const payload = req.body as WhatsAppWebhookPayload;

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const messages = change.value.messages ?? [];
        for (const message of messages) {
          try {
            await markAsRead(message.id);
          } catch (err) {
            console.error("No se pudo marcar el mensaje como leído:", err);
          }

          if (message.type === "text" && message.text) {
            console.log(`Mensaje de ${message.from}: ${message.text.body}`);
            try {
              await sendText(
                message.from,
                "¡Hola! Soy el colaborador del Fortín Bailable. Todavía estoy en construcción, pronto vas a poder comprar tus entradas por acá.",
              );
            } catch (err) {
              console.error("Error al responder por WhatsApp:", err);
            }
          }
        }
      }
    }
  });

  return router;
}
