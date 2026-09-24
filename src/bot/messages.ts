import type { ArtistOption } from "../tickets/stockService";
import type { ScannedTicketInfo } from "../tickets/verifierService";
import type { ArtistMenuOption, ArtistReport, GeneralReportRow } from "../admin/reportService";

function formatMoney(amount: number): string {
  return amount.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function formatFechaHora(date: Date): string {
  return date.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STAGE_TYPE_LABEL: Record<string, string> = {
  general: "Entrada general",
  preventa: "Preventa",
};

const MAX_TRANSFERENCIAS_DETALLADAS = 50;

function adminMenuOpciones(artists: ArtistMenuOption[]): string {
  return (
    `0. Resumen general (todos los artistas)\n` +
    artists.map((a, i) => `${i + 1}. ${a.artistName}`).join("\n")
  );
}

const ADMIN_FOOTER_NAVEGACION = "Escribí otro número para ver otro artista, o *salir* para cerrar sesión.";

function artistListText(artists: ArtistOption[]): string {
  return artists
    .map((a, i) => `${i + 1}. ${a.artistName} — ${formatMoney(a.price)} (${a.stageName})`)
    .join("\n");
}

export const messages = {
  saludoConMenu: (artists: ArtistOption[]) =>
    `¡Hola! 👋 Soy el colaborador del Fortín Bailable. Estas son las entradas disponibles 🎟️:\n\n` +
    `${artistListText(artists)}\n\nRespondé con el nombre del artista o el número que te interesa.`,

  sinArtistasDisponibles:
    "Por ahora no tenemos entradas a la venta 😕. Volvé a escribirnos más adelante, ¡gracias!",

  pedirArtista: (artists: ArtistOption[]) =>
    `Buenísimo 🙌. ¿Para qué artista querés comprar? Respondé con el nombre o el número:\n\n${artistListText(artists)}`,

  artistaInvalido: (artists: ArtistOption[]) =>
    `No encontré esa opción 🤔. Elegí un número de la lista:\n\n${artistListText(artists)}`,

  artistaAgotado: "Ese artista ya no tiene entradas disponibles en esta etapa 🚫. Elegí otro:",

  pedirCantidad: (artistName: string, stock: number | null) =>
    `¿Cuántas entradas de *${artistName}* querés comprar? 🎫` +
    (stock !== null ? ` (quedan ${stock} disponibles)` : ""),

  cantidadInvalida: "Escribí un número válido de entradas (por ejemplo: 1, 2, 3...) 🔢",

  stockInsuficiente: (stock: number) =>
    `Solo quedan ${stock} entradas disponibles para ese artista 😬. Escribí una cantidad menor o igual.`,

  confirmarCompra: (params: { artistName: string; quantity: number; unitPrice: number }) =>
    `Decime si está todo bien 🧐:\n\n` +
    `🎟️ *${params.quantity}* entrada(s) de *${params.artistName}*\n` +
    `💰 ${formatMoney(params.unitPrice)} c/u — Total: *${formatMoney(params.unitPrice * params.quantity)}*\n\n` +
    `Respondé *Sí* para confirmar, o decime el artista o la cantidad correcta si hay que cambiar algo.`,

  confirmacionNoEntendida:
    "No te entendí 🤔. Respondé *Sí* para confirmar la compra, o decime el artista o la cantidad correcta.",

  ordenCreada: (params: {
    artistName: string;
    quantity: number;
    totalAmount: number;
    alias: string;
    ttlMinutes: number;
  }) =>
    `Perfecto ✅, reservé *${params.quantity}* entrada(s) de *${params.artistName}*.\n\n` +
    `💰 *Monto a transferir: ${formatMoney(params.totalAmount)}*\n` +
    `🏦 Alias de Mercado Pago: *${params.alias}*\n\n` +
    `Transferí el monto exacto y compartime el comprobante de transferencia o la foto 📸, ` +
    `lo que te resulte más cómodo. Que se vea el *CBU/CVU*, el *CUIT/CUIL* y el *N° de operación*. ` +
    `⏱️ Tenés ${params.ttlMinutes} minutos antes de que se libere la reserva.`,

  pedirComprobante:
    "Mandame el comprobante de la transferencia — con una foto 📸, o con la opción " +
    '*"Compartir comprobante"* de Mercado Pago, lo que te resulte más cómodo. ' +
    "Que se vea el *CBU/CVU*, el *CUIT/CUIL* y el *N° de operación* " +
    "— así podemos corroborar que llegó a la cuenta " +
    "(o escribí *ya transferí* si preferís avisarme por texto).",

  verificandoPago: "Dale 👀, estamos revisando la transferencia. Puede tardar unos minutos, ya te aviso.",

  pagoNoEncontrado:
    "Todavía no encontramos una transferencia aprobada por el monto exacto 🧐. " +
    "Revisá que hayas transferido el importe indicado y volvé a mandar el comprobante o escribir *ya transferí*.",

  pagoConfirmadoPedirDatos:
    "¡Recibimos tu pago! ✅ Ahora pasame tu *nombre y apellido completo* junto con tu *DNI* " +
    "en un solo mensaje, para generar tu entrada con QR.\n\nEjemplo: _Juan Carlos Gomez 23456789_",

  datosInvalidos:
    "No te entendí 🤨. Mandame tu nombre y apellido junto con tu DNI en un solo mensaje.\n\n" +
    "Ejemplo: _Juan Carlos Gomez 23456789_",

  compraCompleta: (quantity: number, artistName: string) =>
    `¡Listo! 🎉 Tu compra de *${quantity}* entrada(s) para *${artistName}* quedó confirmada. ` +
    `Ya te mandamos tu(s) código(s) QR arriba 📲 — presentalos en la entrada del evento junto a tu DNI.\n\n` +
    `¡Nos vemos en el Fortín Bailable! 🕺💃`,

  cancelado: "Cancelé la compra en curso ❌. Escribime cuando quieras y te muestro las entradas de nuevo.",

  ayuda:
    "Puedo ayudarte a comprar entradas para el Fortín Bailable 🎟️. Escribime cualquier cosa para ver las entradas disponibles, o *cancelar* para cortar una compra en curso.",

  errorInesperado: "Uh 😅, tuvimos un problema de nuestro lado. Probá de nuevo en un rato, disculpá.",

  qrValido: (ticket: ScannedTicketInfo) =>
    `✅ ENTRADA VÁLIDA — ingreso autorizado\n` +
    `${ticket.artistName} — N° ${String(ticket.ticketNumber).padStart(5, "0")}` +
    (ticket.buyerName
      ? `\nTitular: ${ticket.buyerName}${ticket.buyerDni ? ` (DNI ${ticket.buyerDni})` : ""}`
      : ""),

  qrYaUsado: (ticket: ScannedTicketInfo) =>
    `⛔ ENTRADA YA USADA — no dejar pasar\n` +
    `${ticket.artistName} — N° ${String(ticket.ticketNumber).padStart(5, "0")}` +
    (ticket.usedAt ? `\nYa había ingresado el ${ticket.usedAt.toLocaleString("es-AR")}.` : ""),

  qrInvalido: "⛔ CÓDIGO INVÁLIDO — no corresponde a una entrada del evento. No dejar pasar.",

  qrNoEncontrado: "⛔ CÓDIGO NO ENCONTRADO — no existe esa entrada. No dejar pasar.",

  qrImagenIlegible:
    "No pude leer ningún código QR en esa imagen 🧐. Probá con una foto más nítida y bien enfocada, " +
    "o mandame directamente el texto del código.",

  adminPedirPalabraClave: "Escribí *informe* o *resumen* para ver el reporte de ventas.",

  adminPedirContrasena: "🔐 Ingresá la contraseña de administrador para acceder a los reportes de venta.",

  adminContrasenaIncorrecta: "❌ Contraseña incorrecta. Probá de nuevo.",

  adminMenu: (artists: ArtistMenuOption[]) =>
    `✅ Acceso concedido. ¿Qué querés ver?\n\n${adminMenuOpciones(artists)}\n\n` +
    "Respondé con un número, o escribí *salir* para cerrar sesión.",

  adminOpcionInvalida: (artists: ArtistMenuOption[]) =>
    `No entendí esa opción 🤔. Elegí un número:\n\n${adminMenuOpciones(artists)}`,

  adminSesionCerrada: "Sesión cerrada 🔒. Escribí *informe* o *resumen* cuando quieras volver a entrar.",

  adminSinArtistas: "Todavía no hay artistas cargados en el sistema.",

  adminSoloTexto:
    "En el modo administrador solo puedo leer texto 🧐. Escribí *informe* o *resumen* para empezar.",

  adminBloqueado: (minutesRemaining: number) =>
    `🔒 Demasiadas contraseñas incorrectas. Probá de nuevo en ${minutesRemaining} minuto(s).`,

  adminResumenGeneral: (rows: GeneralReportRow[]) => {
    if (rows.length === 0) return "Todavía no hay artistas cargados en el sistema.";

    const lineas = rows.map(
      (r) => `• *${r.artistName}*: ${r.ticketsSold} entrada(s) — ${formatMoney(r.totalAmount)}`,
    );
    const totalEntradas = rows.reduce((sum, r) => sum + r.ticketsSold, 0);
    const totalMonto = rows.reduce((sum, r) => sum + r.totalAmount, 0);

    return (
      `📊 *Resumen general*\n\n${lineas.join("\n")}\n\n` +
      `*Total: ${totalEntradas} entrada(s) — ${formatMoney(totalMonto)}*\n\n${ADMIN_FOOTER_NAVEGACION}`
    );
  },

  adminResumenArtista: (report: ArtistReport) => {
    if (report.breakdown.length === 0) {
      return (
        `📊 *${report.artistName}*\n\nTodavía no tiene ninguna transferencia confirmada.\n\n` +
        ADMIN_FOOTER_NAVEGACION
      );
    }

    const secciones = report.breakdown.map((s) => {
      const etiqueta = STAGE_TYPE_LABEL[s.stageType] ?? s.stageType;
      const detalle = s.transfers
        .slice(0, MAX_TRANSFERENCIAS_DETALLADAS)
        .map((t) => `   ${formatFechaHora(t.paidAt)} — ${formatMoney(t.amount)}`)
        .join("\n");
      const restantes = s.transfers.length - MAX_TRANSFERENCIAS_DETALLADAS;
      const nota = restantes > 0 ? `\n   (+${restantes} transferencia(s) más)` : "";

      return (
        `*${etiqueta}*: ${s.ticketsSold} entrada(s) — ${formatMoney(s.totalAmount)}\n${detalle}${nota}`
      );
    });

    return (
      `📊 *${report.artistName}*\n\n${secciones.join("\n\n")}\n\n` +
      `*Total: ${report.totalTicketsSold} entrada(s) — ${formatMoney(report.totalAmount)}*\n\n${ADMIN_FOOTER_NAVEGACION}`
    );
  },
};
