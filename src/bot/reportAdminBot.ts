import { messages } from "./messages";
import {
  getSession,
  startPasswordPrompt,
  updatePendingEmailQuery,
  consumePendingEmailQuery,
  markAuthenticated,
  touchSession,
  recordFailedAttempt,
  endSession,
  verifyReportAdminPassword,
} from "../admin/reportAdminService";
import { getArtistMenuOptions, getArtistReport, getGeneralReport, findArtistByQuery } from "../admin/reportService";
import { sendArtistSalesReportEmail, EmailNotConfiguredError } from "../admin/salesReportEmail";

const FINAL_REPORT_PATTERN = /^(?:informe final|reporte final)\s+(.+)$/i;

function parseFinalReportQuery(text: string): string | null {
  const match = text.trim().match(FINAL_REPORT_PATTERN);
  return match ? match[1]!.trim() : null;
}

function isTriggerWord(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return normalized === "informe" || normalized === "resumen";
}

function isLogoutCommand(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return ["salir", "logout", "cerrar sesion", "cerrar sesión"].includes(normalized);
}

function isMenuCommand(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return ["menu", "menú", "ayuda"].includes(normalized) || isTriggerWord(normalized);
}

function minutesUntil(date: Date): number {
  return Math.max(1, Math.ceil((date.getTime() - Date.now()) / 60000));
}

/** Resuelve el artista pedido por "informe final"/"reporte final" y le manda el reporte por mail. */
async function emailArtistReport(query: string): Promise<string> {
  const artists = await getArtistMenuOptions();
  const artist = findArtistByQuery(query, artists);
  if (!artist) return messages.adminArtistaNoEncontradoParaMail(query, artists);

  try {
    const { recipients, artistName } = await sendArtistSalesReportEmail(artist.artistId);
    return messages.adminMailEnviado(artistName, recipients);
  } catch (err) {
    if (err instanceof EmailNotConfiguredError) return messages.adminMailNoConfigurado;
    throw err;
  }
}

/**
 * Atiende a los admins de reportes de venta en 3 etapas:
 * 1. Sin sesión: solo reacciona a "informe"/"resumen" (menú) o a
 *    "informe final"/"reporte final" + artista (pide la contraseña y, apenas
 *    loguea, manda ese reporte por mail sin pasar por el menú).
 * 2. Pendiente de contraseña: el próximo mensaje se valida contra el hash
 *    guardado; tras REPORT_ADMIN_MAX_FAILED_ATTEMPTS fallos seguidos, la
 *    sesión se bloquea por REPORT_ADMIN_LOCKOUT_MINUTES.
 * 3. Autenticado: elige por número un artista puntual o el resumen general,
 *    o pide por mail el reporte de cualquier artista con "informe final"/"reporte final" + artista.
 */
export async function handleReportAdminMessage(phone: string, text: string): Promise<string> {
  const trimmed = text.trim();
  const finalReportQuery = parseFinalReportQuery(trimmed);
  const session = await getSession(phone);

  if (session === null) {
    if (finalReportQuery) {
      await startPasswordPrompt(phone, finalReportQuery);
      return messages.adminPedirContrasena;
    }
    if (!isTriggerWord(trimmed)) return messages.adminPedirPalabraClave;
    await startPasswordPrompt(phone);
    return messages.adminPedirContrasena;
  }

  if (session.state === "locked") {
    return messages.adminBloqueado(minutesUntil(session.lockedUntil));
  }

  if (session.state === "pending_password") {
    if (finalReportQuery) {
      await updatePendingEmailQuery(phone, finalReportQuery);
      return messages.adminPedirContrasena;
    }
    if (isTriggerWord(trimmed)) {
      await touchSession(phone);
      return messages.adminPedirContrasena;
    }

    const valid = await verifyReportAdminPassword(phone, trimmed);
    if (!valid) {
      const attempt = await recordFailedAttempt(phone);
      return attempt.locked
        ? messages.adminBloqueado(minutesUntil(attempt.lockedUntil!))
        : messages.adminContrasenaIncorrecta;
    }

    const pendingQuery = await consumePendingEmailQuery(phone);
    await markAuthenticated(phone);

    if (pendingQuery) return emailArtistReport(pendingQuery);
    return messages.adminMenu(await getArtistMenuOptions());
  }

  // session.state === "active"
  if (isLogoutCommand(trimmed)) {
    await endSession(phone);
    return messages.adminSesionCerrada;
  }

  await touchSession(phone);

  if (finalReportQuery) return emailArtistReport(finalReportQuery);

  const artists = await getArtistMenuOptions();
  if (isMenuCommand(trimmed)) {
    return messages.adminMenu(artists);
  }

  const selection = Number(trimmed);
  if (!Number.isInteger(selection) || selection < 0 || selection > artists.length) {
    return messages.adminOpcionInvalida(artists);
  }

  if (selection === 0) {
    return messages.adminResumenGeneral(await getGeneralReport());
  }

  const chosen = artists[selection - 1]!;
  const report = await getArtistReport(chosen.artistId);
  return report ? messages.adminResumenArtista(report) : messages.adminOpcionInvalida(artists);
}
