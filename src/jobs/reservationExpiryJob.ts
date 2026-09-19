import cron from "node-cron";
import { expireOverdueOrders } from "../tickets/orderService";

export function startReservationExpiryJob() {
  // Corre cada minuto: libera el stock reservado de órdenes que vencieron sin pago.
  cron.schedule("* * * * *", async () => {
    try {
      const count = await expireOverdueOrders();
      if (count > 0) {
        console.log(`Reservas expiradas liberadas: ${count}`);
      }
    } catch (err) {
      console.error("Error en reservationExpiryJob:", err);
    }
  });
}
