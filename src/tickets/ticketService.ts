import { pool } from "../db/pool";
import { TICKET_STATUS } from "../config/constants";
import type { Order } from "./orderService";
import { generateTicketQrPng, signTicketId } from "../qr/generateTicketQr";
import { uploadMedia, sendImageByMediaId } from "../whatsapp/client";

/**
 * Crea cada ticket de la orden, genera su QR firmado (HMAC) y lo manda por
 * WhatsApp como imagen. Si falla el envío de alguno, se corta el loop y se
 * propaga el error (el llamador ya le avisa al usuario que hubo un problema).
 */
export async function generateAndSendTicketsForOrder(order: Order, artistName: string): Promise<void> {
  for (let i = 1; i <= order.quantity; i++) {
    const inserted = await pool.query<{ id: string }>(
      `INSERT INTO tickets (order_id, unit_index, status) VALUES ($1, $2, $3) RETURNING id`,
      [order.id, i, TICKET_STATUS.PENDIENTE],
    );
    const ticketId = inserted.rows[0]!.id;
    const signature = signTicketId(ticketId);

    await pool.query(
      `UPDATE tickets SET qr_payload = $2, qr_signature = $3, status = $4, generated_at = now() WHERE id = $1`,
      [ticketId, ticketId, signature, TICKET_STATUS.GENERADO],
    );

    const pngBuffer = await generateTicketQrPng(ticketId);
    const mediaId = await uploadMedia(pngBuffer, "image/png", `entrada-${i}.png`);
    await sendImageByMediaId(
      order.phoneNumber,
      mediaId,
      `Entrada ${i}/${order.quantity} — ${artistName}. Presentá este QR junto a tu DNI en el ingreso.`,
    );
  }
}
