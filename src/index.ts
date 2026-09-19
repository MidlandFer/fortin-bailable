import { env } from "./config/env";
import { createServer } from "./server";
import { startReservationExpiryJob } from "./jobs/reservationExpiryJob";

const app = createServer();

app.listen(env.PORT, () => {
  console.log(`Fortín Bailable escuchando en el puerto ${env.PORT} (${env.NODE_ENV})`);
});

startReservationExpiryJob();
