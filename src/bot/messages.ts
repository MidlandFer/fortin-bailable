import type { ArtistOption } from "../tickets/stockService";

function formatMoney(amount: number): string {
  return amount.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function artistListText(artists: ArtistOption[]): string {
  return artists
    .map((a, i) => `${i + 1}. ${a.artistName} — ${formatMoney(a.price)} (${a.stageName})`)
    .join("\n");
}

export const messages = {
  saludoConMenu: (artists: ArtistOption[]) =>
    `¡Hola! 👋 Soy el colaborador del Fortín Bailable. Estas son las entradas disponibles 🎟️:\n\n` +
    `${artistListText(artists)}\n\nRespondé con el número del artista que te interesa.`,

  sinArtistasDisponibles:
    "Por ahora no tenemos entradas a la venta 😕. Volvé a escribirnos más adelante, ¡gracias!",

  pedirArtista: (artists: ArtistOption[]) =>
    `Buenísimo 🙌. ¿Para qué artista querés comprar? Respondé con el número:\n\n${artistListText(artists)}`,

  artistaInvalido: (artists: ArtistOption[]) =>
    `No encontré esa opción 🤔. Elegí un número de la lista:\n\n${artistListText(artists)}`,

  artistaAgotado: "Ese artista ya no tiene entradas disponibles en esta etapa 🚫. Elegí otro:",

  pedirCantidad: (artistName: string, stock: number | null) =>
    `¿Cuántas entradas de *${artistName}* querés comprar? 🎫` +
    (stock !== null ? ` (quedan ${stock} disponibles)` : ""),

  cantidadInvalida: "Escribí un número válido de entradas (por ejemplo: 1, 2, 3...) 🔢",

  stockInsuficiente: (stock: number) =>
    `Solo quedan ${stock} entradas disponibles para ese artista 😬. Escribí una cantidad menor o igual.`,

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
    `Transferí ese monto exacto y después escribime *ya transferí*. ` +
    `⏱️ Tenés ${params.ttlMinutes} minutos antes de que se libere la reserva.`,

  pedirComprobante:
    "Mandame una foto 📸 o captura del comprobante de la transferencia, y después escribí *ya transferí*.",

  verificandoPago: "Dale 👀, estamos revisando la transferencia. Puede tardar unos minutos, ya te aviso.",

  pagoConfirmadoPedirNombre: "¡Recibimos tu pago! ✅ Ahora decime tu *nombre y apellido* completo.",

  nombreInvalido: "Decime tu nombre y apellido completo (nombre y apellido, separados por un espacio) ✍️",

  pedirDni: "Gracias 🙏. Por último, pasame tu *DNI* (sin puntos) para generar tu entrada con QR.",

  dniInvalido: "Ese DNI no parece válido 🤨. Mandalo de nuevo, solo los números (7 u 8 dígitos).",

  compraCompleta: (quantity: number, artistName: string) =>
    `¡Listo! 🎉 Tu compra de *${quantity}* entrada(s) para *${artistName}* quedó confirmada. ` +
    `Ya te mandamos tu(s) código(s) QR arriba 📲 — presentalos en la entrada del evento junto a tu DNI.\n\n` +
    `¡Nos vemos en el Fortín Bailable! 🕺💃`,

  cancelado: "Cancelé la compra en curso ❌. Escribime cuando quieras y te muestro las entradas de nuevo.",

  ayuda:
    "Puedo ayudarte a comprar entradas para el Fortín Bailable 🎟️. Escribime cualquier cosa para ver las entradas disponibles, o *cancelar* para cortar una compra en curso.",

  errorInesperado: "Uh 😅, tuvimos un problema de nuestro lado. Probá de nuevo en un rato, disculpá.",
};
