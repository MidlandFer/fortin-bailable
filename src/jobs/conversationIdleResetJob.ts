import cron from "node-cron";
import { pool } from "../db/pool";
import { env } from "../config/env";
import { CONVERSATION_STATES, ORDER_STATUS } from "../config/constants";
import { expireOrder, getOrderById } from "../tickets/orderService";

interface IdleConversationRow {
  id: number;
  active_order_id: number | null;
}

/**
 * Si un comprador queda RESERVATION_TTL_MINUTES sin mandar ningún mensaje
 * (en cualquier paso de la conversación, no solo esperando el pago), se
 * reinicia su conversación a INICIO. Si tenía una orden sin pagar todavía,
 * se cancela y se libera el stock reservado. Una orden ya pagada (pago_confirmado)
 * NO se cancela — solo se desvincula de la conversación, para no perder un
 * pago real por inactividad; queda en la base para seguimiento manual.
 */
export function startConversationIdleResetJob() {
  cron.schedule("* * * * *", async () => {
    try {
      const result = await pool.query<IdleConversationRow>(
        `SELECT id, active_order_id FROM whatsapp_conversations
         WHERE current_state != $1
           AND last_message_at < now() - ($2 || ' minutes')::interval`,
        [CONVERSATION_STATES.INICIO, env.RESERVATION_TTL_MINUTES],
      );

      for (const row of result.rows) {
        if (row.active_order_id) {
          const order = await getOrderById(row.active_order_id);
          if (order && order.status === ORDER_STATUS.ESPERANDO_PAGO) {
            await expireOrder(order);
          }
        }
        await pool.query(
          `UPDATE whatsapp_conversations
           SET current_state = $2, context = '{}'::jsonb, active_order_id = NULL
           WHERE id = $1`,
          [row.id, CONVERSATION_STATES.INICIO],
        );
      }

      if (result.rows.length > 0) {
        console.log(`Conversaciones reiniciadas por inactividad: ${result.rows.length}`);
      }
    } catch (err) {
      console.error("Error en conversationIdleResetJob:", err);
    }
  });
}
