export const CONVERSATION_STATES = {
  INICIO: "INICIO",
  ESPERANDO_ARTISTA: "ESPERANDO_ARTISTA",
  ESPERANDO_CANTIDAD: "ESPERANDO_CANTIDAD",
  ESPERANDO_COMPROBANTE: "ESPERANDO_COMPROBANTE",
  VERIFICANDO_PAGO: "VERIFICANDO_PAGO",
  ESPERANDO_DATOS_PERSONALES: "ESPERANDO_DATOS_PERSONALES",
  COMPLETADO: "COMPLETADO",
} as const;

export type ConversationState = (typeof CONVERSATION_STATES)[keyof typeof CONVERSATION_STATES];

export const ORDER_STATUS = {
  RESERVADO: "reservado",
  ESPERANDO_PAGO: "esperando_pago",
  PAGO_CONFIRMADO: "pago_confirmado",
  EXPIRADO: "expirado",
  CANCELADO: "cancelado",
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export const TICKET_STATUS = {
  PENDIENTE: "pendiente",
  GENERADO: "generado",
  USADO: "usado",
} as const;

export type TicketStatus = (typeof TICKET_STATUS)[keyof typeof TICKET_STATUS];

export const SCAN_RESULT = {
  OK: "ok",
  YA_USADO: "ya_usado",
  INVALIDO: "invalido",
  NO_ENCONTRADO: "no_encontrado",
} as const;

export type ScanResult = (typeof SCAN_RESULT)[keyof typeof SCAN_RESULT];

export const MAX_RETRIES_RESPUESTA_AMBIGUA = 3;
