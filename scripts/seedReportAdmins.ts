// Carga/actualiza los 3 números de WhatsApp habilitados como admins de reportes
// de venta. Las contraseñas se toman de REPORT_ADMIN_PASSWORD_1/2/3 en el .env
// (ver .env.example) y se guardan hasheadas; el número que no tenga su
// contraseña cargada se saltea.
import "dotenv/config";
import bcrypt from "bcrypt";
import { pool } from "../src/db/pool";

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

const REPORT_ADMINS = [
  { phone: "+5492284372174", passwordEnvVar: "REPORT_ADMIN_PASSWORD_1" },
  { phone: "+5492284616972", passwordEnvVar: "REPORT_ADMIN_PASSWORD_2" },
  { phone: "+5491139339542", passwordEnvVar: "REPORT_ADMIN_PASSWORD_3" },
];

async function main() {
  for (const { phone, passwordEnvVar } of REPORT_ADMINS) {
    const password = process.env[passwordEnvVar];
    if (!password) {
      console.log(`Salteando ${phone}: falta ${passwordEnvVar} en el .env`);
      continue;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO report_admins (phone_number, password_hash)
       VALUES ($1, $2)
       ON CONFLICT (phone_number) DO UPDATE SET password_hash = EXCLUDED.password_hash
       RETURNING id, phone_number`,
      [normalizePhone(phone), passwordHash],
    );
    console.log("Admin de reportes creado/actualizado:", result.rows[0]);
  }

  await pool.end();
}

main().catch((err) => {
  console.error("Error al crear los admins de reportes:", err);
  process.exit(1);
});
