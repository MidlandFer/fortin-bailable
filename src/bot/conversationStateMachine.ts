import { CONVERSATION_STATES, ORDER_STATUS } from "../config/constants";
import { env } from "../config/env";
import { messages } from "./messages";
import {
  getOrCreateConversation,
  updateConversation,
  type Conversation,
  type ConversationContext,
} from "./conversationRepo";
import { isAffirmative, parseNameAndDni, parseQuantity } from "./validators";
import {
  getActiveArtistOptions,
  getArtistOptionByStageId,
  reserveStock,
  type ArtistOption,
} from "../tickets/stockService";
import {
  createOrder,
  getOrderById,
  setBuyerName,
  setBuyerDni,
  setComprobanteMediaId,
  confirmOrderWithPayment,
  markOrderPaidMock,
  cancelOrder,
  type Order,
} from "../tickets/orderService";
import { generateAndSendTicketsForOrder } from "../tickets/ticketService";
import { findApprovedPaymentForOrder } from "../payments/mercadoPagoService";

interface HandlerResult {
  reply: string;
  nextState?: string;
  contextPatch?: ConversationContext;
  activeOrderId?: number | null;
}

function isCancelCommand(text: string): boolean {
  return text.trim().toLowerCase() === "cancelar";
}

function isHelpCommand(text: string): boolean {
  return text.trim().toLowerCase() === "ayuda";
}

async function handleGlobalCommand(
  conversation: Conversation,
  text: string,
): Promise<HandlerResult | null> {
  if (isHelpCommand(text)) {
    return { reply: messages.ayuda };
  }

  if (isCancelCommand(text)) {
    if (conversation.activeOrderId) {
      const order = await getOrderById(conversation.activeOrderId);
      if (order && order.status === ORDER_STATUS.ESPERANDO_PAGO) {
        await cancelOrder(order);
      }
    }
    return {
      reply: messages.cancelado,
      nextState: CONVERSATION_STATES.INICIO,
      contextPatch: {},
      activeOrderId: null,
    };
  }

  return null;
}

async function handleInicio(): Promise<HandlerResult> {
  const artists = await getActiveArtistOptions();
  if (artists.length === 0) {
    return { reply: messages.sinArtistasDisponibles };
  }
  return {
    reply: messages.saludoConMenu(artists),
    nextState: CONVERSATION_STATES.ESPERANDO_ARTISTA,
    contextPatch: { retries: 0 },
  };
}

function findArtistBySelection(text: string, artists: ArtistOption[]): ArtistOption | null {
  const trimmed = text.trim();
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

async function handleEsperandoArtista(text: string): Promise<HandlerResult> {
  const artists = await getActiveArtistOptions();
  if (artists.length === 0) {
    return { reply: messages.sinArtistasDisponibles, nextState: CONVERSATION_STATES.INICIO };
  }

  const chosen = findArtistBySelection(text, artists);
  if (!chosen) {
    return { reply: messages.artistaInvalido(artists) };
  }

  if (chosen.stockAvailable !== null && chosen.stockAvailable <= 0) {
    return { reply: `${messages.artistaAgotado}\n\n${messages.pedirArtista(artists)}` };
  }

  return {
    reply: messages.pedirCantidad(chosen.artistName, chosen.stockAvailable),
    nextState: CONVERSATION_STATES.ESPERANDO_CANTIDAD,
    contextPatch: {
      artistId: chosen.artistId,
      stageId: chosen.stageId,
      artistName: chosen.artistName,
      unitPrice: chosen.price,
    },
  };
}

async function handleEsperandoCantidad(
  text: string,
  context: ConversationContext,
): Promise<HandlerResult> {
  const quantity = parseQuantity(text);
  if (!quantity) {
    return { reply: messages.cantidadInvalida };
  }

  const stage = await getArtistOptionByStageId(context.stageId!);
  if (!stage) {
    return { reply: messages.errorInesperado, nextState: CONVERSATION_STATES.INICIO };
  }

  if (stage.stockAvailable !== null && quantity > stage.stockAvailable) {
    return { reply: messages.stockInsuficiente(stage.stockAvailable) };
  }

  return {
    reply: messages.confirmarCompra({
      artistName: context.artistName!,
      quantity,
      unitPrice: context.unitPrice!,
    }),
    nextState: CONVERSATION_STATES.ESPERANDO_CONFIRMACION,
    contextPatch: { quantity },
  };
}

async function handleEsperandoConfirmacion(
  text: string,
  context: ConversationContext,
  phoneNumber: string,
): Promise<HandlerResult> {
  if (isAffirmative(text)) {
    const stageId = context.stageId!;
    const quantity = context.quantity!;
    const stage = await getArtistOptionByStageId(stageId);
    if (!stage) {
      return { reply: messages.errorInesperado, nextState: CONVERSATION_STATES.INICIO };
    }

    if (stage.stockAvailable !== null && quantity > stage.stockAvailable) {
      return {
        reply: messages.stockInsuficiente(stage.stockAvailable),
        nextState: CONVERSATION_STATES.ESPERANDO_CANTIDAD,
      };
    }

    const reserved = await reserveStock(stageId, quantity);
    if (!reserved) {
      return {
        reply: messages.stockInsuficiente(stage.stockAvailable ?? 0),
        nextState: CONVERSATION_STATES.ESPERANDO_CANTIDAD,
      };
    }

    const order = await createOrder({
      phoneNumber,
      artistId: context.artistId!,
      stageId,
      quantity,
      unitPrice: context.unitPrice!,
    });

    return {
      reply: messages.ordenCreada({
        artistName: context.artistName!,
        quantity,
        totalAmount: order.totalAmount,
        alias: env.MP_ALIAS,
        ttlMinutes: env.RESERVATION_TTL_MINUTES,
      }),
      nextState: CONVERSATION_STATES.ESPERANDO_COMPROBANTE,
      activeOrderId: order.id,
    };
  }

  // ¿Está corrigiendo el artista? (por nombre o número, igual que en ESPERANDO_ARTISTA)
  const artists = await getActiveArtistOptions();
  const chosenArtist = findArtistBySelection(text, artists);
  if (chosenArtist) {
    if (chosenArtist.stockAvailable !== null && chosenArtist.stockAvailable <= 0) {
      return {
        reply: `${messages.artistaAgotado}\n\n${messages.pedirArtista(artists)}`,
        nextState: CONVERSATION_STATES.ESPERANDO_ARTISTA,
      };
    }

    const artistPatch = {
      artistId: chosenArtist.artistId,
      stageId: chosenArtist.stageId,
      artistName: chosenArtist.artistName,
      unitPrice: chosenArtist.price,
    };
    const quantity = context.quantity!;

    if (chosenArtist.stockAvailable !== null && quantity > chosenArtist.stockAvailable) {
      return {
        reply: messages.pedirCantidad(chosenArtist.artistName, chosenArtist.stockAvailable),
        nextState: CONVERSATION_STATES.ESPERANDO_CANTIDAD,
        contextPatch: artistPatch,
      };
    }

    return {
      reply: messages.confirmarCompra({ artistName: chosenArtist.artistName, quantity, unitPrice: chosenArtist.price }),
      contextPatch: artistPatch,
    };
  }

  // ¿Está corrigiendo la cantidad?
  const newQuantity = parseQuantity(text);
  if (newQuantity) {
    const stage = await getArtistOptionByStageId(context.stageId!);
    if (!stage) {
      return { reply: messages.errorInesperado, nextState: CONVERSATION_STATES.INICIO };
    }
    if (stage.stockAvailable !== null && newQuantity > stage.stockAvailable) {
      return { reply: messages.stockInsuficiente(stage.stockAvailable) };
    }
    return {
      reply: messages.confirmarCompra({
        artistName: context.artistName!,
        quantity: newQuantity,
        unitPrice: context.unitPrice!,
      }),
      contextPatch: { quantity: newQuantity },
    };
  }

  return { reply: messages.confirmacionNoEntendida };
}

async function handleEsperandoComprobante(
  text: string,
  order: Order | null,
  mediaId?: string,
): Promise<HandlerResult> {
  if (!order) {
    return { reply: messages.errorInesperado, nextState: CONVERSATION_STATES.INICIO };
  }

  const normalized = text.trim().toLowerCase();
  const avisoDeTransferencia = mediaId !== undefined || normalized.includes("ya transfer");

  if (mediaId) {
    await setComprobanteMediaId(order.id, mediaId);
  }

  if (avisoDeTransferencia) {
    // Sin MERCADOPAGO_ACCESS_TOKEN configurado (todavía no se cargó el real de
    // producción), confirmamos el pago sin corroborarlo. En cuanto se cargue el
    // token, esta rama deja de usarse sola y pasa a validar contra Mercado Pago.
    if (!env.MERCADOPAGO_ACCESS_TOKEN) {
      await markOrderPaidMock(order.id);
      return {
        reply: messages.pagoConfirmadoPedirDatos,
        nextState: CONVERSATION_STATES.ESPERANDO_DATOS_PERSONALES,
      };
    }

    const payment = await findApprovedPaymentForOrder(order);
    if (!payment) return { reply: messages.pagoNoEncontrado };

    const confirmed = await confirmOrderWithPayment(order.id, payment);
    if (!confirmed) return { reply: messages.pagoNoEncontrado };

    return {
      reply: messages.pagoConfirmadoPedirDatos,
      nextState: CONVERSATION_STATES.ESPERANDO_DATOS_PERSONALES,
    };
  }

  return { reply: messages.pedirComprobante };
}

async function handleEsperandoDatosPersonales(
  text: string,
  order: Order | null,
  context: ConversationContext,
): Promise<HandlerResult> {
  const parsed = parseNameAndDni(text);
  if (!order || !parsed) {
    return { reply: messages.datosInvalidos };
  }

  await setBuyerName(order.id, parsed.name);
  await setBuyerDni(order.id, parsed.dni);

  const freshOrder = await getOrderById(order.id);
  if (!freshOrder) {
    return { reply: messages.errorInesperado, nextState: CONVERSATION_STATES.INICIO };
  }
  const artistName = context.artistName ?? "tu artista";
  await generateAndSendTicketsForOrder(freshOrder, artistName);

  return {
    reply: messages.compraCompleta(freshOrder.quantity, artistName),
    nextState: CONVERSATION_STATES.INICIO,
    contextPatch: {},
    activeOrderId: null,
  };
}

export async function handleIncomingMessage(
  phoneNumber: string,
  text: string,
  mediaId?: string,
): Promise<string> {
  const conversation = await getOrCreateConversation(phoneNumber);

  const globalResult = await handleGlobalCommand(conversation, text);
  let result: HandlerResult;

  if (globalResult) {
    result = globalResult;
  } else {
    const order = conversation.activeOrderId ? await getOrderById(conversation.activeOrderId) : null;

    switch (conversation.currentState) {
      case CONVERSATION_STATES.INICIO:
        result = await handleInicio();
        break;
      case CONVERSATION_STATES.ESPERANDO_ARTISTA:
        result = await handleEsperandoArtista(text);
        break;
      case CONVERSATION_STATES.ESPERANDO_CANTIDAD:
        result = await handleEsperandoCantidad(text, conversation.context);
        break;
      case CONVERSATION_STATES.ESPERANDO_CONFIRMACION:
        result = await handleEsperandoConfirmacion(text, conversation.context, phoneNumber);
        break;
      case CONVERSATION_STATES.ESPERANDO_COMPROBANTE:
        result = await handleEsperandoComprobante(text, order, mediaId);
        break;
      case CONVERSATION_STATES.ESPERANDO_DATOS_PERSONALES:
        result = await handleEsperandoDatosPersonales(text, order, conversation.context);
        break;
      default:
        result = await handleInicio();
    }
  }

  await updateConversation(conversation, {
    currentState: (result.nextState ?? conversation.currentState) as Conversation["currentState"],
    context: result.contextPatch
      ? { ...conversation.context, ...result.contextPatch }
      : conversation.context,
    activeOrderId:
      result.activeOrderId !== undefined ? result.activeOrderId : conversation.activeOrderId,
  });

  return result.reply;
}
