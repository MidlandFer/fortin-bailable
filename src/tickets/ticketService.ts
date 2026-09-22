import { pool } from "../db/pool";
import { TICKET_STATUS } from "../config/constants";
import { getPurchaseSequenceNumber, type Order } from "./orderService";
import { buildQrPayload, generateTicketQrPng, signTicketPayload } from "../qr/generateTicketQr";

function formatTicketNumber(rawSerial: number): { displayNumber: number; padded: string } {
  // La SERIAL de Postgres arranca en 1; se resta 1 para que la primera
  // entrada emitida en todo el sistema se muestre como "00000".
  const displayNumber = rawSerial - 1;
  return { displayNumber, padded: String(displayNumber).padStart(5, "0") };
}
import { uploadMedia, sendImageByMediaId } from "../whatsapp/client";

function formatFecha(date: Date): string {
  return date.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
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
 * hora de emisión (con segundos) queda firmada dentro del propio QR (no solo
 * como texto visible), así una fecha alterada invalida la firma. Cada entrada
 * de una misma compra usa un segundo distinto (base + i-1), para que ninguna
 * de las N entradas de una compra grupal quede con el contenido idéntico.
 */
export async function generateAndSendTicketsForOrder(order: Order, artistName: string): Promise<void> {
  const purchaseSeq = await getPurchaseSequenceNumber(order.phoneNumber, order.id);
  const purchaseSeqPadded = String(purchaseSeq).padStart(2, "0");

  const baseEpochSeconds = Math.floor(Date.now() / 1000);

  for (let i = 1; i <= order.quantity; i++) {
    const ticketEpochSeconds = baseEpochSeconds + (i - 1);
    const ticketIssuedAt = new Date(ticketEpochSeconds * 1000);

    const inserted = await pool.query<{ id: string; ticket_number: number }>(
      `INSERT INTO tickets (order_id, unit_index, status) VALUES ($1, $2, $3) RETURNING id, ticket_number`,
      [order.id, i, TICKET_STATUS.PENDIENTE],
    );
    const ticketId = inserted.rows[0]!.id;
    const { displayNumber: ticketNumber, padded: ticketNumberPadded } = formatTicketNumber(
      inserted.rows[0]!.ticket_number,
    );
    const qrPayload = buildQrPayload(ticketId, ticketNumber, ticketEpochSeconds);
    const signature = signTicketPayload(ticketId, ticketNumber, ticketEpochSeconds);

    await pool.query(
      `UPDATE tickets
       SET qr_payload = $2, qr_signature = $3, status = $4, generated_at = to_timestamp($5)
       WHERE id = $1`,
      [ticketId, qrPayload, signature, TICKET_STATUS.GENERADO, ticketEpochSeconds],
    );

    const pngBuffer = await generateTicketQrPng(ticketId, ticketNumber, ticketEpochSeconds);
    const mediaId = await uploadMedia(pngBuffer, "image/png", `entrada-${ticketNumberPadded}.png`);
    const caption =
      `🎟️ Entrada -${purchaseSeqPadded}/${i} de ${order.quantity} — ${artistName}\n` +
      `🔢 N° de entrada: ${ticketNumberPadded}\n` +
      `🪪 DNI: ${order.buyerDni}\n` +
      `🗓️ ${formatFecha(ticketIssuedAt)}\n` +
      `Presentá este QR junto a tu DNI en el ingreso.`;
    await sendImageByMediaId(order.phoneNumber, mediaId, caption);
  }
}
