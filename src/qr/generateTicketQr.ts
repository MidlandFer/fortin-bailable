import crypto from "node:crypto";
import QRCode from "qrcode";
import { env } from "../config/env";

/**
 * Firma HMAC del ticket ID + número de entrada global + fecha/hora de emisión
 * (epoch en segundos). Incluir estos datos en lo firmado agrega una capa de
 * seguridad extra: si alguien edita cualquiera de ellos en el QR, la firma
 * deja de coincidir.
 */
export function signTicketPayload(
  ticketId: string,
  ticketNumber: number,
  issuedAtEpochSeconds: number,
): string {
  return crypto
    .createHmac("sha256", env.QR_SIGNING_SECRET)
    .update(`${ticketId}.${ticketNumber}.${issuedAtEpochSeconds}`)
    .digest("hex")
    .slice(0, 24);
}

export function buildQrPayload(
  ticketId: string,
  ticketNumber: number,
  issuedAtEpochSeconds: number,
): string {
  const signature = signTicketPayload(ticketId, ticketNumber, issuedAtEpochSeconds);
  return `${ticketId}.${ticketNumber}.${issuedAtEpochSeconds}.${signature}`;
}

/**
 * Si hay un número de WhatsApp del bot configurado, envuelve el payload en un
 * link "click to chat" (wa.me) con el texto precargado: al escanear el QR con
 * la cámara, el celular abre WhatsApp directo con el bot y el mensaje ya
 * escrito, listo para tocar "Enviar". Sin ese número configurado, el QR
 * codifica el payload en texto plano (hay que pegarlo a mano en el chat).
 */
function buildQrContent(payload: string): string {
  if (!env.WHATSAPP_BOT_PHONE_NUMBER) return payload;
  return `https://wa.me/${env.WHATSAPP_BOT_PHONE_NUMBER}?text=${encodeURIComponent(payload)}`;
}

export async function generateTicketQrPng(
  ticketId: string,
  ticketNumber: number,
  issuedAtEpochSeconds: number,
): Promise<Buffer> {
  const payload = buildQrPayload(ticketId, ticketNumber, issuedAtEpochSeconds);
  return QRCode.toBuffer(buildQrContent(payload), { type: "png", width: 512, margin: 2 });
}
