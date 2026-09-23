export const CONVERSATION_STATES = {
  INICIO: "INICIO",
  ESPERANDO_ARTISTA: "ESPERANDO_ARTISTA",
  ESPERANDO_CANTIDAD: "ESPERANDO_CANTIDAD",
  ESPERANDO_CONFIRMACION: "ESPERANDO_CONFIRMACION",
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

export const STAGE_TYPE = {
  GENERAL: "general",
  PREVENTA: "preventa",
} as const;

export type StageType = (typeof STAGE_TYPE)[keyof typeof STAGE_TYPE];

export const MAX_RETRIES_RESPUESTA_AMBIGUA = 3;

// Tras esta cantidad de contraseñas incorrectas seguidas, un admin de reportes
// queda bloqueado por REPORT_ADMIN_LOCKOUT_MINUTES antes de poder reintentar.
export const REPORT_ADMIN_MAX_FAILED_ATTEMPTS = 5;
export const REPORT_ADMIN_LOCKOUT_MINUTES = 15;
