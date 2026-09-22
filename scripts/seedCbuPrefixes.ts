// Carga (opcional) del padrón completo de entidades financieras del BCRA.
// La migración 1789841360000_seed_cbu_prefixes.sql ya carga un puñado de bancos conocidos
// como placeholder. Para completar la tabla con el padrón oficial:
//   1. Descargar el listado de entidades financieras desde https://www.bcra.gob.ar
//      (sección "Entidades financieras" / códigos de entidad usados en CBU/CVU).
//   2. Armar un CSV en data/cbu_prefixes.csv con columnas: prefix,bank_name
//      (prefix = primeros 3 dígitos del CBU, con cero a la izquierda si corresponde).
//   3. Correr `npm run seed:cbu`.
import fs from "node:fs";
import path from "node:path";
import { pool } from "../src/db/pool";

const CSV_PATH = path.join(__dirname, "..", "data", "cbu_prefixes.csv");

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.log(
      `No se encontró ${CSV_PATH}. Se mantiene la tabla cbu_bank_prefixes con los valores` +
        " cargados por la migración 002. Ver el comentario al inicio de este script para completarla.",
    );
    await pool.end();
    return;
  }

  const lines = fs
    .readFileSync(CSV_PATH, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const [header, ...rows] = lines;
  if (header?.toLowerCase() !== "prefix,bank_name") {
    throw new Error('El CSV debe tener el encabezado exacto: "prefix,bank_name"');
  }

  let count = 0;
  for (const row of rows) {
    const [prefix, ...bankParts] = row.split(",");
    const bankName = bankParts.join(",").trim();
    if (!prefix || prefix.trim().length !== 3 || !bankName) {
      console.warn("Fila inválida, se omite:", row);
      continue;
    }
    await pool.query(
      `INSERT INTO cbu_bank_prefixes (prefix, bank_name) VALUES ($1, $2)
       ON CONFLICT (prefix) DO UPDATE SET bank_name = EXCLUDED.bank_name`,
      [prefix.trim(), bankName],
    );
    count++;
  }

  console.log(`Prefijos de CBU cargados/actualizados: ${count}`);
  await pool.end();
}

main().catch((err) => {
  console.error("Error al cargar prefijos de CBU:", err);
  process.exit(1);
});
