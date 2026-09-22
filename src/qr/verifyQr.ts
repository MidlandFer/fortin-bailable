import crypto from "node:crypto";
import { signTicketPayload } from "./generateTicketQr";

export interface QrVerificationResult {
  valid: boolean;
  ticketId?: string;
  issuedAt?: Date;
}

/** Valida la firma de un payload leído de un QR (formato "ticketId.timestamp.signature"). */
export function verifyQrPayload(payload: string): QrVerificationResult {
  const [ticketId, timestampStr, signature] = payload.split(".");
  if (!ticketId || !timestampStr || !signature) return { valid: false };

  const timestamp = Number(timestampStr);
  if (!Number.isFinite(timestamp)) return { valid: false };

  const expected = signTicketPayload(ticketId, timestamp);
  const expectedBuf = Buffer.from(expected, "hex");
  const receivedBuf = Buffer.from(signature, "hex");

  if (expectedBuf.length !== receivedBuf.length) return { valid: false };
  if (!crypto.timingSafeEqual(expectedBuf, receivedBuf)) return { valid: false };

  return { valid: true, ticketId, issuedAt: new Date(timestamp * 1000) };
}
