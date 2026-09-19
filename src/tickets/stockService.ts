import { pool } from "../db/pool";

export interface ArtistOption {
  artistId: number;
  artistName: string;
  stageId: number;
  stageName: string;
  price: number;
  stockAvailable: number | null; // null = sin límite
}

// El stage "vigente" de un artista: activo, dentro de su ventana de fechas (si tiene),
// y el de mayor prioridad entre los que cumplen esa condición.
const ACTIVE_STAGE_QUERY = `
  SELECT DISTINCT ON (a.id)
    a.id AS artist_id,
    a.name AS artist_name,
    s.id AS stage_id,
    s.name AS stage_name,
    s.price,
    s.stock_limit,
    s.sold_count,
    s.reserved_count
  FROM artists a
  JOIN presale_stages s ON s.artist_id = a.id
  WHERE a.active = true
    AND s.active = true
    AND (s.starts_at IS NULL OR s.starts_at <= now())
    AND (s.ends_at IS NULL OR s.ends_at >= now())
  ORDER BY a.id, s.priority DESC, s.id DESC
`;

function toStockAvailable(row: {
  stock_limit: number | null;
  sold_count: number;
  reserved_count: number;
}): number | null {
  if (row.stock_limit === null) return null;
  return Math.max(0, row.stock_limit - row.sold_count - row.reserved_count);
}

export async function getActiveArtistOptions(): Promise<ArtistOption[]> {
  const result = await pool.query<{
    artist_id: number;
    artist_name: string;
    stage_id: number;
    stage_name: string;
    price: string;
    stock_limit: number | null;
    sold_count: number;
    reserved_count: number;
  }>(`${ACTIVE_STAGE_QUERY} ORDER BY a.id`);

  return result.rows.map((r) => ({
    artistId: r.artist_id,
    artistName: r.artist_name,
    stageId: r.stage_id,
    stageName: r.stage_name,
    price: Number(r.price),
    stockAvailable: toStockAvailable(r),
  }));
}

export async function getArtistOptionByStageId(stageId: number): Promise<ArtistOption | null> {
  const result = await pool.query<{
    artist_id: number;
    artist_name: string;
    stage_id: number;
    stage_name: string;
    price: string;
    stock_limit: number | null;
    sold_count: number;
    reserved_count: number;
  }>(
    `SELECT a.id AS artist_id, a.name AS artist_name, s.id AS stage_id, s.name AS stage_name,
            s.price, s.stock_limit, s.sold_count, s.reserved_count
     FROM presale_stages s
     JOIN artists a ON a.id = s.artist_id
     WHERE s.id = $1`,
    [stageId],
  );
  const row = result.rows[0];
  if (!row) return null;

  return {
    artistId: row.artist_id,
    artistName: row.artist_name,
    stageId: row.stage_id,
    stageName: row.stage_name,
    price: Number(row.price),
    stockAvailable: toStockAvailable(row),
  };
}

/** Reserva stock de forma atómica. Devuelve false si no había suficiente disponible. */
export async function reserveStock(stageId: number, quantity: number): Promise<boolean> {
  const result = await pool.query(
    `UPDATE presale_stages
     SET reserved_count = reserved_count + $2
     WHERE id = $1
       AND (stock_limit IS NULL OR stock_limit - sold_count - reserved_count >= $2)
     RETURNING id`,
    [stageId, quantity],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function releaseStock(stageId: number, quantity: number): Promise<void> {
  await pool.query(
    `UPDATE presale_stages
     SET reserved_count = GREATEST(0, reserved_count - $2)
     WHERE id = $1`,
    [stageId, quantity],
  );
}

export async function confirmStockSale(stageId: number, quantity: number): Promise<void> {
  await pool.query(
    `UPDATE presale_stages
     SET reserved_count = GREATEST(0, reserved_count - $2),
         sold_count = sold_count + $2
     WHERE id = $1`,
    [stageId, quantity],
  );
}
