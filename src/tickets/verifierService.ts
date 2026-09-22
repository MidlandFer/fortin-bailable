import { pool } from "../db/pool";
import { env } from "../config/env";
import { TICKET_STATUS, SCAN_RESULT, type ScanResult } from "../config/constants";
import { verifyQrPayload } from "../qr/verifyQr";

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

const verifierPhones = new Set(env.verifierPhoneNumbers.map(normalizePhone));

export function isVerifierPhone(phone: string): boolean {
  return verifierPhones.has(normalizePhone(phone));
}

export interface ScannedTicketInfo {
  ticketNumber: number;
  unitIndex: number;
  quantity: number;
  artistName: string;
  buyerName: string | null;
  buyerDni: string | null;
  usedAt: Date | null;
}

export interface ScanOutcome {
  result: ScanResult;
  ticket?: ScannedTicketInfo;
}

interface TicketRow {
  id: string;
  status: string;
  unit_index: number;
  used_at: Date | null;
  quantity: number;
  buyer_name: string | null;
  buyer_dni: string | null;
  artist_name: string;
}

/** Si pegan el link wa.me completo en vez del texto ya precargado, rescata el payload del parámetro "text". */
function extractPayload(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("http")) return trimmed;
  try {
    return new URL(trimmed).searchParams.get("text") ?? trimmed;
  } catch {
    return trimmed;
  }
}

async function recordScan(
  ticketId: string | null,
  verifierPhone: string,
  result: ScanResult,
): Promise<void> {
  await pool.query(`INSERT INTO scan_logs (ticket_id, result, meta) VALUES ($1, $2, $3)`, [
    ticketId,
    result,
    JSON.stringify({ verifierPhone }),
  ]);
}

/** Valida el payload leído de un QR y, si corresponde, marca la entrada como usada. */
export async function scanTicketToken(rawToken: string, verifierPhone: string): Promise<ScanOutcome> {
  const verification = verifyQrPayload(extractPayload(rawToken));
  if (!verification.valid || !verification.ticketId || verification.ticketNumber === undefined) {
    return { result: SCAN_RESULT.INVALIDO };
  }
  const { ticketId, ticketNumber } = verification;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<TicketRow>(
      `SELECT t.id, t.status, t.unit_index, t.used_at,
              o.quantity, o.buyer_name, o.buyer_dni, a.name AS artist_name
       FROM tickets t
       JOIN orders o ON o.id = t.order_id
       JOIN artists a ON a.id = o.artist_id
       WHERE t.id = $1
       FOR UPDATE OF t`,
      [ticketId],
    );

    const row = result.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      await recordScan(null, verifierPhone, SCAN_RESULT.NO_ENCONTRADO);
      return { result: SCAN_RESULT.NO_ENCONTRADO };
    }

    const ticket: ScannedTicketInfo = {
      ticketNumber,
      unitIndex: row.unit_index,
      quantity: row.quantity,
      artistName: row.artist_name,
      buyerName: row.buyer_name,
      buyerDni: row.buyer_dni,
      usedAt: row.used_at,
    };

    if (row.status !== TICKET_STATUS.GENERADO) {
      await client.query("ROLLBACK");
      const outcome = row.status === TICKET_STATUS.USADO ? SCAN_RESULT.YA_USADO : SCAN_RESULT.INVALIDO;
      await recordScan(row.id, verifierPhone, outcome);
      return { result: outcome, ticket };
    }

    await client.query(`UPDATE tickets SET status = $2, used_at = now() WHERE id = $1`, [
      row.id,
      TICKET_STATUS.USADO,
    ]);
    await client.query(`INSERT INTO scan_logs (ticket_id, result, meta) VALUES ($1, $2, $3)`, [
      row.id,
      SCAN_RESULT.OK,
      JSON.stringify({ verifierPhone }),
    ]);
    await client.query("COMMIT");

    return { result: SCAN_RESULT.OK, ticket };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
