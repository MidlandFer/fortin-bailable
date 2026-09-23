import { pool } from "../db/pool";
import { ORDER_STATUS, STAGE_TYPE, type StageType } from "../config/constants";

export interface ArtistMenuOption {
  artistId: number;
  artistName: string;
}

export interface Transfer {
  paidAt: Date;
  amount: number;
}

export interface StageTypeSummary {
  stageType: StageType;
  ticketsSold: number;
  totalAmount: number;
  transfers: Transfer[];
}

export interface ArtistReport {
  artistId: number;
  artistName: string;
  totalTicketsSold: number;
  totalAmount: number;
  breakdown: StageTypeSummary[];
}

export interface GeneralReportRow {
  artistId: number;
  artistName: string;
  ticketsSold: number;
  totalAmount: number;
}

export async function getArtistMenuOptions(): Promise<ArtistMenuOption[]> {
  const result = await pool.query<{ id: number; name: string }>(
    `SELECT id, name FROM artists ORDER BY id`,
  );
  return result.rows.map((r) => ({ artistId: r.id, artistName: r.name }));
}

/** Resuelve el artista pedido por número de menú o por nombre (exacto o parcial). */
export function findArtistByQuery(query: string, artists: ArtistMenuOption[]): ArtistMenuOption | null {
  const trimmed = query.trim();
  const asNumber = Number(trimmed);
  if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= artists.length) {
    return artists[asNumber - 1]!;
  }
  const normalized = trimmed.toLowerCase();
  return (
    artists.find((a) => a.artistName.toLowerCase() === normalized) ??
    artists.find((a) => a.artistName.toLowerCase().includes(normalized)) ??
    null
  );
}

export async function getArtistReport(artistId: number): Promise<ArtistReport | null> {
  const artistResult = await pool.query<{ name: string }>(`SELECT name FROM artists WHERE id = $1`, [
    artistId,
  ]);
  const artistName = artistResult.rows[0]?.name;
  if (!artistName) return null;

  const salesResult = await pool.query<{
    stage_type: StageType;
    quantity: number;
    total_amount: string;
    paid_at: Date;
  }>(
    `SELECT s.stage_type, o.quantity, o.total_amount, o.paid_at
     FROM orders o
     JOIN presale_stages s ON s.id = o.stage_id
     WHERE o.artist_id = $1 AND o.status = $2
     ORDER BY o.paid_at`,
    [artistId, ORDER_STATUS.PAGO_CONFIRMADO],
  );

  const byType = new Map<StageType, StageTypeSummary>();
  for (const row of salesResult.rows) {
    const summary = byType.get(row.stage_type) ?? {
      stageType: row.stage_type,
      ticketsSold: 0,
      totalAmount: 0,
      transfers: [],
    };
    summary.ticketsSold += row.quantity;
    summary.totalAmount += Number(row.total_amount);
    summary.transfers.push({ paidAt: row.paid_at, amount: Number(row.total_amount) });
    byType.set(row.stage_type, summary);
  }

  // El orden general primero, preventa después, es más intuitivo para leer.
  const breakdown = [STAGE_TYPE.GENERAL, STAGE_TYPE.PREVENTA]
    .map((type) => byType.get(type))
    .filter((summary): summary is StageTypeSummary => summary !== undefined);

  const totalTicketsSold = breakdown.reduce((sum, s) => sum + s.ticketsSold, 0);
  const totalAmount = breakdown.reduce((sum, s) => sum + s.totalAmount, 0);

  return { artistId, artistName, totalTicketsSold, totalAmount, breakdown };
}

export async function getGeneralReport(): Promise<GeneralReportRow[]> {
  const result = await pool.query<{
    artist_id: number;
    artist_name: string;
    tickets_sold: string;
    total_amount: string;
  }>(
    `SELECT a.id AS artist_id, a.name AS artist_name,
            COALESCE(SUM(o.quantity), 0) AS tickets_sold,
            COALESCE(SUM(o.total_amount), 0) AS total_amount
     FROM artists a
     LEFT JOIN orders o ON o.artist_id = a.id AND o.status = $1
     GROUP BY a.id, a.name
     ORDER BY a.id`,
    [ORDER_STATUS.PAGO_CONFIRMADO],
  );

  return result.rows.map((r) => ({
    artistId: r.artist_id,
    artistName: r.artist_name,
    ticketsSold: Number(r.tickets_sold),
    totalAmount: Number(r.total_amount),
  }));
}
