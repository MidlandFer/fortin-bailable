import { Pool, type QueryResultRow } from "pg";
import { env } from "../config/env";

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

pool.on("error", (err: Error) => {
  console.error("Error inesperado en un cliente idle de Postgres", err);
});

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
) {
  return pool.query<T>(text, params);
}
