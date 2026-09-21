import crypto from "node:crypto";
import QRCode from "qrcode";
import { env } from "../config/env";

export function signTicketId(ticketId: string): string {
  return crypto
    .createHmac("sha256", env.QR_SIGNING_SECRET)
    .update(ticketId)
    .digest("hex")
    .slice(0, 24);
}

export function buildQrPayload(ticketId: string): string {
  return `${ticketId}.${signTicketId(ticketId)}`;
}

export async function generateTicketQrPng(ticketId: string): Promise<Buffer> {
  const payload = buildQrPayload(ticketId);
  return QRCode.toBuffer(payload, { type: "png", width: 512, margin: 2 });
}
