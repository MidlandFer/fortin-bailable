import { CONVERSATION_STATES, MAX_RETRIES_RESPUESTA_AMBIGUA } from "../config/constants";
import { env } from "../config/env";
import { messages } from "./messages";
import {
  getOrCreateConversation,
  updateConversation,
  type Conversation,
  type ConversationContext,
} from "./conversationRepo";
import { isValidCuitCuil, isValidDni, isAffirmative, isNegative, parseQuantity } from "./validators";
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
  setBuyerCuitCuil,
  markOrderPaidMock,
  cancelOrder,
  type Order,
} from "../tickets/orderService";
import { generateTicketsForOrder } from "../tickets/ticketService";

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
      if (order && order.status === "esperando_pago") {
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
  return { reply: messages.saludoInicial, nextState: CONVERSATION_STATES.ESPERANDO_INTERES };
}

async function handleEsperandoInteres(text: string, context: ConversationContext): Promise<HandlerResult> {
  if (isAffirmative(text)) {
    const artists = await getActiveArtistOptions();
    if (artists.length === 0) {
      return { reply: messages.sinArtistasDisponibles, nextState: CONVERSATION_STATES.INICIO };
    }
    return {
      reply: messages.pedirArtista(artists),
      nextState: CONVERSATION_STATES.ESPERANDO_ARTISTA,
      contextPatch: { retries: 0 },
    };
  }

  if (isNegative(text)) {
    return { reply: messages.despedida, nextState: CONVERSATION_STATES.INICIO };
  }

  const retries = (context.retries ?? 0) + 1;
  if (retries > MAX_RETRIES_RESPUESTA_AMBIGUA) {
    return { reply: messages.ayuda, nextState: CONVERSATION_STATES.INICIO };
  }
  return { reply: messages.noEntendidoInteres, contextPatch: { retries } };
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
  phoneNumber: string,
): Promise<HandlerResult> {
  const quantity = parseQuantity(text);
  if (!quantity) {
    return { reply: messages.cantidadInvalida };
  }

  const stageId = context.stageId!;
  const stage = await getArtistOptionByStageId(stageId);
  if (!stage) {
    return { reply: messages.errorInesperado, nextState: CONVERSATION_STATES.INICIO };
  }

  if (stage.stockAvailable !== null && quantity > stage.stockAvailable) {
    return { reply: messages.stockInsuficiente(stage.stockAvailable) };
  }

  const reserved = await reserveStock(stageId, quantity);
  if (!reserved) {
    return { reply: messages.stockInsuficiente(stage.stockAvailable ?? 0) };
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
    contextPatch: { quantity },
    activeOrderId: order.id,
  };
}

async function handleEsperandoComprobante(text: string, order: Order | null): Promise<HandlerResult> {
  if (!order) {
    return { reply: messages.errorInesperado, nextState: CONVERSATION_STATES.INICIO };
  }

  const normalized = text.trim().toLowerCase();
  if (normalized.includes("ya transfer")) {
    // TODO (Fase 4): reemplazar por la verificación real contra Mercado Pago.
    // Por ahora confirmamos el pago apenas el usuario avisa (mock de Fase 3).
    await markOrderPaidMock(order.id);
    return {
      reply: messages.pagoConfirmadoPedirNombre,
      nextState: CONVERSATION_STATES.ESPERANDO_NOMBRE,
    };
  }

  return { reply: messages.pedirComprobante };
}

async function handleEsperandoNombre(text: string, order: Order | null): Promise<HandlerResult> {
  const trimmed = text.trim();
  if (!order || trimmed.split(/\s+/).length < 2) {
    return { reply: messages.nombreInvalido };
  }
  await setBuyerName(order.id, trimmed);
  return { reply: messages.pedirDni, nextState: CONVERSATION_STATES.ESPERANDO_DNI };
}

async function handleEsperandoDni(text: string, order: Order | null): Promise<HandlerResult> {
  if (!order || !isValidDni(text)) {
    return { reply: messages.dniInvalido };
  }
  await setBuyerDni(order.id, text.trim());
  return { reply: messages.pedirCuit, nextState: CONVERSATION_STATES.ESPERANDO_CUIT };
}

async function handleEsperandoCuit(
  text: string,
  order: Order | null,
  context: ConversationContext,
): Promise<HandlerResult> {
  if (!order || !isValidCuitCuil(text)) {
    return { reply: messages.cuitInvalido };
  }
  await setBuyerCuitCuil(order.id, text.trim());

  const freshOrder = await getOrderById(order.id);
  if (!freshOrder) {
    return { reply: messages.errorInesperado, nextState: CONVERSATION_STATES.INICIO };
  }
  await generateTicketsForOrder(freshOrder);

  return {
    reply: messages.compraCompleta(freshOrder.quantity, context.artistName ?? "tu artista"),
    nextState: CONVERSATION_STATES.INICIO,
    contextPatch: {},
    activeOrderId: null,
  };
}

export async function handleIncomingMessage(phoneNumber: string, text: string): Promise<string> {
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
      case CONVERSATION_STATES.ESPERANDO_INTERES:
        result = await handleEsperandoInteres(text, conversation.context);
        break;
      case CONVERSATION_STATES.ESPERANDO_ARTISTA:
        result = await handleEsperandoArtista(text);
        break;
      case CONVERSATION_STATES.ESPERANDO_CANTIDAD:
        result = await handleEsperandoCantidad(text, conversation.context, phoneNumber);
        break;
      case CONVERSATION_STATES.ESPERANDO_COMPROBANTE:
        result = await handleEsperandoComprobante(text, order);
        break;
      case CONVERSATION_STATES.ESPERANDO_NOMBRE:
        result = await handleEsperandoNombre(text, order);
        break;
      case CONVERSATION_STATES.ESPERANDO_DNI:
        result = await handleEsperandoDni(text, order);
        break;
      case CONVERSATION_STATES.ESPERANDO_CUIT:
        result = await handleEsperandoCuit(text, order, conversation.context);
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
