import { pool } from "../db/pool";
import { TICKET_STATUS } from "../config/constants";
import type { Order } from "./orderService";

/**
 * TODO (Fase 5): generar el payload firmado (HMAC) + imagen QR real y enviarla por
 * WhatsApp. Por ahora (Fase 3) solo se crean las filas de `tickets` en estado
 * 'generado' con un payload placeholder, para poder cerrar el flujo de compra
 * de punta a punta sin depender todavía del módulo de QR.
 */
export async function generateTicketsForOrder(order: Order): Promise<void> {
  for (let i = 1; i <= order.quantity; i++) {
    await pool.query(
      `INSERT INTO tickets (order_id, unit_index, qr_payload, qr_signature, status, generated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (order_id, unit_index) DO NOTHING`,
      [order.id, i, `PENDIENTE_FASE_5:${order.id}:${i}`, "", TICKET_STATUS.GENERADO],
    );
  }
}
