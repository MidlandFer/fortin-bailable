import ExcelJS from "exceljs";
import nodemailer from "nodemailer";
import { env } from "../config/env";
import { STAGE_TYPE } from "../config/constants";
import { getArtistReport, type ArtistReport } from "./reportService";

export class EmailNotConfiguredError extends Error {}

const STAGE_TYPE_LABEL: Record<string, string> = {
  [STAGE_TYPE.GENERAL]: "Entrada general",
  [STAGE_TYPE.PREVENTA]: "Preventa",
};

function requireEmailConfig() {
  if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD) {
    throw new EmailNotConfiguredError("GMAIL_USER / GMAIL_APP_PASSWORD no están configurados.");
  }
  if (env.adminEmails.length === 0) {
    throw new EmailNotConfiguredError("No hay direcciones cargadas en ADMIN_EMAILS.");
  }
  return { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD, recipients: env.adminEmails };
}

async function buildArtistWorkbook(report: ArtistReport) {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();

  const resumenSheet = workbook.addWorksheet("Resumen");
  resumenSheet.columns = [
    { header: "Tipo", key: "type", width: 20 },
    { header: "Entradas vendidas", key: "tickets", width: 20 },
    { header: "Monto total", key: "amount", width: 20 },
  ];
  for (const stage of report.breakdown) {
    resumenSheet.addRow({
      type: STAGE_TYPE_LABEL[stage.stageType] ?? stage.stageType,
      tickets: stage.ticketsSold,
      amount: stage.totalAmount,
    });
  }
  resumenSheet.addRow({});
  resumenSheet.addRow({
    type: "TOTAL",
    tickets: report.totalTicketsSold,
    amount: report.totalAmount,
  });
  resumenSheet.getColumn("amount").numFmt = '"$"#,##0.00';

  const detalleSheet = workbook.addWorksheet("Detalle de transferencias");
  detalleSheet.columns = [
    { header: "Tipo", key: "type", width: 20 },
    { header: "Fecha", key: "date", width: 20 },
    { header: "Monto", key: "amount", width: 16 },
  ];
  for (const stage of report.breakdown) {
    const label = STAGE_TYPE_LABEL[stage.stageType] ?? stage.stageType;
    for (const transfer of stage.transfers) {
      detalleSheet.addRow({ type: label, date: transfer.paidAt, amount: transfer.amount });
    }
  }
  detalleSheet.getColumn("date").numFmt = "dd/mm/yyyy hh:mm";
  detalleSheet.getColumn("amount").numFmt = '"$"#,##0.00';

  return workbook.xlsx.writeBuffer();
}

/** Manda por mail el reporte de ventas de un artista puntual, con Excel adjunto (resumen + detalle de transferencias). */
export async function sendArtistSalesReportEmail(
  artistId: number,
): Promise<{ recipients: string[]; artistName: string }> {
  const { user, pass, recipients } = requireEmailConfig();

  const report = await getArtistReport(artistId);
  if (!report) throw new Error(`No se encontró el artista ${artistId} para el reporte por mail.`);

  const buffer = await buildArtistWorkbook(report);

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  const today = new Date().toISOString().slice(0, 10);

  await transporter.sendMail({
    from: `"Fortín Bailable" <${user}>`,
    to: recipients.join(", "),
    subject: `Reporte de ventas — ${report.artistName} — ${today}`,
    text:
      `Adjunto el reporte de ventas de ${report.artistName}: ${report.totalTicketsSold} entrada(s) ` +
      `vendida(s) por un total de ${report.totalAmount}.`,
    attachments: [
      {
        filename: `reporte-${report.artistName.replace(/\s+/g, "-").toLowerCase()}-${today}.xlsx`,
        content: Buffer.from(buffer),
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    ],
  });

  return { recipients, artistName: report.artistName };
}
