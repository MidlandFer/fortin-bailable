import bcrypt from "bcrypt";
import { pool } from "../db/pool";
import { env } from "../config/env";
import { REPORT_ADMIN_MAX_FAILED_ATTEMPTS, REPORT_ADMIN_LOCKOUT_MINUTES } from "../config/constants";

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export type ReportAdminSession =
  | { state: "pending_password" }
  | { state: "active" }
  | { state: "locked"; lockedUntil: Date };

export async function isReportAdminPhone(phone: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM report_admins WHERE phone_number = $1 AND active = true`,
    [normalizePhone(phone)],
  );
  return (result.rowCount ?? 0) > 0;
}

/** Verifica la contraseña contra el hash guardado para ese número. */
export async function verifyReportAdminPassword(phone: string, password: string): Promise<boolean> {
  const result = await pool.query<{ password_hash: string }>(
    `SELECT password_hash FROM report_admins WHERE phone_number = $1 AND active = true`,
    [normalizePhone(phone)],
  );
  const hash = result.rows[0]?.password_hash;
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

/**
 * Estado actual: null si nunca pidió acceso o pasó REPORT_ADMIN_SESSION_IDLE_MINUTES
 * sin actividad (hay que arrancar de nuevo escribiendo "informe"/"resumen"),
 * "locked" mientras dura el bloqueo por intentos fallidos (independiente de la
 * inactividad: un bloqueo no se esquiva dejando pasar el tiempo de sesión),
 * o el estado vigente de la sesión.
 */
export async function getSession(phone: string): Promise<ReportAdminSession | null> {
  const result = await pool.query<{
    authenticated: boolean;
    last_activity_at: Date;
    locked_until: Date | null;
  }>(
    `SELECT authenticated, last_activity_at, locked_until
     FROM report_admin_sessions WHERE phone_number = $1`,
    [normalizePhone(phone)],
  );
  const row = result.rows[0];
  if (!row) return null;

  if (row.locked_until && row.locked_until.getTime() > Date.now()) {
    return { state: "locked", lockedUntil: row.locked_until };
  }

  const idleLimitMs = env.REPORT_ADMIN_SESSION_IDLE_MINUTES * 60 * 1000;
  if (Date.now() - row.last_activity_at.getTime() > idleLimitMs) return null;

  return { state: row.authenticated ? "active" : "pending_password" };
}

/**
 * Arranca el pedido de contraseña desde cero (sesión nueva): resetea intentos
 * fallidos y bloqueo previos. `pendingEmailQuery` guarda el artista pedido por
 * "informe final"/"reporte final" para mandarlo por mail apenas loguee.
 */
export async function startPasswordPrompt(phone: string, pendingEmailQuery?: string): Promise<void> {
  await pool.query(
    `INSERT INTO report_admin_sessions
       (phone_number, authenticated, last_activity_at, failed_attempts, locked_until, pending_email_query)
     VALUES ($1, false, now(), 0, NULL, $2)
     ON CONFLICT (phone_number) DO UPDATE
       SET authenticated = false, last_activity_at = now(), failed_attempts = 0,
           locked_until = NULL, pending_email_query = $2`,
    [normalizePhone(phone), pendingEmailQuery ?? null],
  );
}

/** Actualiza el artista pedido por mail mientras sigue esperando la contraseña, sin tocar los intentos fallidos. */
export async function updatePendingEmailQuery(phone: string, query: string): Promise<void> {
  await pool.query(
    `UPDATE report_admin_sessions SET pending_email_query = $2, last_activity_at = now()
     WHERE phone_number = $1`,
    [normalizePhone(phone), query],
  );
}

/** Devuelve el artista pendiente de mandar por mail (si había) y lo limpia. */
export async function consumePendingEmailQuery(phone: string): Promise<string | null> {
  const normalized = normalizePhone(phone);
  const result = await pool.query<{ pending_email_query: string | null }>(
    `SELECT pending_email_query FROM report_admin_sessions WHERE phone_number = $1`,
    [normalized],
  );
  const value = result.rows[0]?.pending_email_query ?? null;
  if (value !== null) {
    await pool.query(
      `UPDATE report_admin_sessions SET pending_email_query = NULL WHERE phone_number = $1`,
      [normalized],
    );
  }
  return value;
}

/** Marca la sesión como logueada tras una contraseña correcta; limpia intentos fallidos y bloqueo. */
export async function markAuthenticated(phone: string): Promise<void> {
  await pool.query(
    `UPDATE report_admin_sessions
     SET authenticated = true, last_activity_at = now(), failed_attempts = 0, locked_until = NULL
     WHERE phone_number = $1`,
    [normalizePhone(phone)],
  );
}

/** Refresca la actividad de una sesión activa, sin cambiar su estado. */
export async function touchSession(phone: string): Promise<void> {
  await pool.query(
    `UPDATE report_admin_sessions SET last_activity_at = now() WHERE phone_number = $1`,
    [normalizePhone(phone)],
  );
}

/** Suma un intento fallido y, si llega al máximo, bloquea la sesión por REPORT_ADMIN_LOCKOUT_MINUTES. */
export async function recordFailedAttempt(phone: string): Promise<{ locked: boolean; lockedUntil?: Date }> {
  const normalized = normalizePhone(phone);
  const result = await pool.query<{ failed_attempts: number }>(
    `UPDATE report_admin_sessions
     SET failed_attempts = failed_attempts + 1, last_activity_at = now()
     WHERE phone_number = $1
     RETURNING failed_attempts`,
    [normalized],
  );
  const attempts = result.rows[0]?.failed_attempts ?? 0;
  if (attempts >= REPORT_ADMIN_MAX_FAILED_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + REPORT_ADMIN_LOCKOUT_MINUTES * 60 * 1000);
    await pool.query(`UPDATE report_admin_sessions SET locked_until = $2 WHERE phone_number = $1`, [
      normalized,
      lockedUntil,
    ]);
    return { locked: true, lockedUntil };
  }
  return { locked: false };
}

export async function endSession(phone: string): Promise<void> {
  await pool.query(`DELETE FROM report_admin_sessions WHERE phone_number = $1`, [
    normalizePhone(phone),
  ]);
}
