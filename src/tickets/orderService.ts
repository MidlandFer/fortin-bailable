import { pool } from "../db/pool";
import { env } from "../config/env";
import { ORDER_STATUS } from "../config/constants";
import { releaseStock, confirmStockSale } from "./stockService";

export interface Order {
  id: number;
  phoneNumber: string;
  artistId: number;
  stageId: number;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  buyerName: string | null;
  buyerDni: string | null;
  buyerCuitCuil: string | null;
  status: string;
  createdAt: Date;
  expiresAt: Date | null;
}

interface OrderRow {
  id: number;
  phone_number: string;
  artist_id: number;
  stage_id: number;
  quantity: number;
  unit_price: string;
  total_amount: string;
  buyer_name: string | null;
  buyer_dni: string | null;
  buyer_cuit_cuil: string | null;
  status: string;
  created_at: Date;
  expires_at: Date | null;
}

function mapOrder(row: OrderRow): Order {
  return {
    id: row.id,
    phoneNumber: row.phone_number,
    artistId: row.artist_id,
    stageId: row.stage_id,
    quantity: row.quantity,
    unitPrice: Number(row.unit_price),
    totalAmount: Number(row.total_amount),
    buyerName: row.buyer_name,
    buyerDni: row.buyer_dni,
    buyerCuitCuil: row.buyer_cuit_cuil,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

/** Calcula un offset distintivo para evitar ambigüedad entre órdenes concurrentes del mismo monto base. */
async function computeDistinguishingOffset(baseAmount: number): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT count(*) FROM orders
     WHERE status = $1 AND unit_price * quantity = $2`,
    [ORDER_STATUS.ESPERANDO_PAGO, baseAmount],
  );
  const concurrentCount = Number(result.rows[0]?.count ?? 0);
  return Number((concurrentCount * env.AMOUNT_DISTINGUISHING_STEP).toFixed(2));
}

export async function createOrder(params: {
  phoneNumber: string;
  artistId: number;
  stageId: number;
  quantity: number;
  unitPrice: number;
}): Promise<Order> {
  const baseAmount = Number((params.unitPrice * params.quantity).toFixed(2));
  const offset = await computeDistinguishingOffset(baseAmount);
  const totalAmount = Number((baseAmount + offset).toFixed(2));

  const result = await pool.query<OrderRow>(
    `INSERT INTO orders
       (phone_number, artist_id, stage_id, quantity, unit_price, distinguishing_offset,
        total_amount, status, created_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now() + ($9 || ' minutes')::interval)
     RETURNING *`,
    [
      params.phoneNumber,
      params.artistId,
      params.stageId,
      params.quantity,
      params.unitPrice,
      offset,
      totalAmount,
      ORDER_STATUS.ESPERANDO_PAGO,
      env.RESERVATION_TTL_MINUTES,
    ],
  );
  return mapOrder(result.rows[0]!);
}

export async function getOrderById(orderId: number): Promise<Order | null> {
  const result = await pool.query<OrderRow>(`SELECT * FROM orders WHERE id = $1`, [orderId]);
  const row = result.rows[0];
  return row ? mapOrder(row) : null;
}

export async function setBuyerName(orderId: number, name: string): Promise<void> {
  await pool.query(`UPDATE orders SET buyer_name = $2 WHERE id = $1`, [orderId, name]);
}

export async function setBuyerDni(orderId: number, dni: string): Promise<void> {
  await pool.query(`UPDATE orders SET buyer_dni = $2 WHERE id = $1`, [orderId, dni]);
}

export async function setComprobanteMediaId(orderId: number, mediaId: string): Promise<void> {
  await pool.query(`UPDATE orders SET comprobante_media_id = $2 WHERE id = $1`, [orderId, mediaId]);
}

/**
 * Número de compra de este comprador (1, 2, 3...) contando solo sus compras
 * pagadas hasta esta orden inclusive. Sirve para diferenciar los QR cuando la
 * misma persona compra en distintas ocasiones (ej. "-01", "-02").
 */
export async function getPurchaseSequenceNumber(phoneNumber: string, orderId: number): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT count(*) FROM orders WHERE phone_number = $1 AND status = $2 AND id <= $3`,
    [phoneNumber, ORDER_STATUS.PAGO_CONFIRMADO, orderId],
  );
  return Number(result.rows[0]?.count ?? 1);
}

export async function setBuyerCuitCuil(orderId: number, cuitCuil: string): Promise<void> {
  await pool.query(`UPDATE orders SET buyer_cuit_cuil = $2 WHERE id = $1`, [orderId, cuitCuil]);
}

/**
 * Marca la orden como pagada. TODO (Fase 4): reemplazar por la verificación real
 * contra la API de Mercado Pago (matcher por monto + ventana de tiempo). Por ahora,
 * dispara la confirmación en cuanto el usuario escribe "ya transferí" (mock explícito
 * de la Fase 3, sin corroborar el pago real).
 */
export async function markOrderPaidMock(orderId: number): Promise<Order> {
  const result = await pool.query<OrderRow>(
    `UPDATE orders SET status = $2, paid_at = now() WHERE id = $1 RETURNING *`,
    [orderId, ORDER_STATUS.PAGO_CONFIRMADO],
  );
  const order = mapOrder(result.rows[0]!);
  await confirmStockSale(order.stageId, order.quantity);
  return order;
}

export async function cancelOrder(order: Order): Promise<void> {
  await pool.query(`UPDATE orders SET status = $2 WHERE id = $1`, [
    order.id,
    ORDER_STATUS.CANCELADO,
  ]);
  await releaseStock(order.stageId, order.quantity);
}

export async function expireOrder(order: Order): Promise<void> {
  await pool.query(`UPDATE orders SET status = $2 WHERE id = $1`, [
    order.id,
    ORDER_STATUS.EXPIRADO,
  ]);
  await releaseStock(order.stageId, order.quantity);
}

/** Libera y marca como expiradas todas las órdenes 'esperando_pago' vencidas. */
export async function expireOverdueOrders(): Promise<number> {
  const result = await pool.query<{ id: number; stage_id: number; quantity: number }>(
    `UPDATE orders
     SET status = '${ORDER_STATUS.EXPIRADO}'
     WHERE status = '${ORDER_STATUS.ESPERANDO_PAGO}' AND expires_at < now()
     RETURNING id, stage_id, quantity`,
  );
  for (const row of result.rows) {
    await releaseStock(row.stage_id, row.quantity);
  }
  return result.rows.length;
}
