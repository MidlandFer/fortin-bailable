import crypto from "node:crypto";
import QRCode from "qrcode";
import { env } from "../config/env";

/**
 * Firma HMAC del ticket ID + la fecha/hora de emisión (epoch en segundos).
 * Incluir el timestamp en lo firmado agrega una capa de seguridad extra: si
 * alguien edita la fecha codificada en el QR, la firma deja de coincidir.
 */
export function signTicketPayload(ticketId: string, issuedAtEpochSeconds: number): string {
  return crypto
    .createHmac("sha256", env.QR_SIGNING_SECRET)
    .update(`${ticketId}.${issuedAtEpochSeconds}`)
    .digest("hex")
    .slice(0, 24);
}

export function buildQrPayload(ticketId: string, issuedAtEpochSeconds: number): string {
  const signature = signTicketPayload(ticketId, issuedAtEpochSeconds);
  return `${ticketId}.${issuedAtEpochSeconds}.${signature}`;
}

export async function generateTicketQrPng(ticketId: string, issuedAtEpochSeconds: number): Promise<Buffer> {
  const payload = buildQrPayload(ticketId, issuedAtEpochSeconds);
  return QRCode.toBuffer(payload, { type: "png", width: 512, margin: 2 });
}
