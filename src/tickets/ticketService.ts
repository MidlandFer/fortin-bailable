import { pool } from "../db/pool";
import { TICKET_STATUS } from "../config/constants";
import { getPurchaseSequenceNumber, type Order } from "./orderService";
import { buildQrPayload, generateTicketQrPng, signTicketPayload } from "../qr/generateTicketQr";
import { uploadMedia, sendImageByMediaId } from "../whatsapp/client";

function formatFecha(date: Date): string {
  return date.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Crea cada ticket de la orden, genera su QR firmado (HMAC) y lo manda por
 * WhatsApp como imagen. Si falla el envío de alguno, se corta el loop y se
 * propaga el error (el llamador ya le avisa al usuario que hubo un problema).
 *
 * Cada entrada se etiqueta como "-NN/i": NN es el número de compra de este
 * comprador (01, 02...) para diferenciar QR de compras en días u ocasiones
 * distintas, e "i" es el número de entrada dentro de esta compra. La fecha y
 * hora de emisión queda firmada dentro del propio QR (no solo como texto
 * visible), así una fecha alterada invalida la firma.
 */
export async function generateAndSendTicketsForOrder(order: Order, artistName: string): Promise<void> {
  const purchaseSeq = await getPurchaseSequenceNumber(order.phoneNumber, order.id);
  const purchaseSeqPadded = String(purchaseSeq).padStart(2, "0");

  const issuedAt = new Date();
  const issuedAtEpochSeconds = Math.floor(issuedAt.getTime() / 1000);

  for (let i = 1; i <= order.quantity; i++) {
    const inserted = await pool.query<{ id: string }>(
      `INSERT INTO tickets (order_id, unit_index, status) VALUES ($1, $2, $3) RETURNING id`,
      [order.id, i, TICKET_STATUS.PENDIENTE],
    );
    const ticketId = inserted.rows[0]!.id;
    const qrPayload = buildQrPayload(ticketId, issuedAtEpochSeconds);
    const signature = signTicketPayload(ticketId, issuedAtEpochSeconds);

    await pool.query(
      `UPDATE tickets
       SET qr_payload = $2, qr_signature = $3, status = $4, generated_at = to_timestamp($5)
       WHERE id = $1`,
      [ticketId, qrPayload, signature, TICKET_STATUS.GENERADO, issuedAtEpochSeconds],
    );

    const pngBuffer = await generateTicketQrPng(ticketId, issuedAtEpochSeconds);
    const mediaId = await uploadMedia(pngBuffer, "image/png", `entrada-${purchaseSeqPadded}-${i}.png`);
    const caption =
      `🎟️ Entrada -${purchaseSeqPadded}/${i} de ${order.quantity} — ${artistName}\n` +
      `🪪 DNI: ${order.buyerDni}\n` +
      `🗓️ ${formatFecha(issuedAt)}\n` +
      `Presentá este QR junto a tu DNI en el ingreso.`;
    await sendImageByMediaId(order.phoneNumber, mediaId, caption);
  }
}
