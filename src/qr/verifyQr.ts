import crypto from "node:crypto";
import { signTicketId } from "./generateTicketQr";

export interface QrVerificationResult {
  valid: boolean;
  ticketId?: string;
}

/** Valida la firma de un payload leído de un QR (formato "ticketId.signature"). */
export function verifyQrPayload(payload: string): QrVerificationResult {
  const [ticketId, signature] = payload.split(".");
  if (!ticketId || !signature) return { valid: false };

  const expected = signTicketId(ticketId);
  const expectedBuf = Buffer.from(expected, "hex");
  const receivedBuf = Buffer.from(signature, "hex");

  if (expectedBuf.length !== receivedBuf.length) return { valid: false };
  if (!crypto.timingSafeEqual(expectedBuf, receivedBuf)) return { valid: false };

  return { valid: true, ticketId };
}
