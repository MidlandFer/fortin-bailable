import bcrypt from "bcrypt";
import { env } from "../src/config/env";
import { pool } from "../src/db/pool";

async function main() {
  const passwordHash = await bcrypt.hash(env.ADMIN_SEED_PASSWORD, 12);

  const result = await pool.query(
    `INSERT INTO admins (email, password_hash)
     VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id, email`,
    [env.ADMIN_SEED_EMAIL, passwordHash],
  );

  console.log("Admin creado/actualizado:", result.rows[0]);
  await pool.end();
}

main().catch((err) => {
  console.error("Error al crear el admin inicial:", err);
  process.exit(1);
});
