import { pool } from "../db/pool";
import { CONVERSATION_STATES, type ConversationState } from "../config/constants";

export interface ConversationContext {
  artistId?: number;
  stageId?: number;
  artistName?: string;
  quantity?: number;
  unitPrice?: number;
  retries?: number;
}

export interface Conversation {
  id: number;
  phoneNumber: string;
  currentState: ConversationState;
  context: ConversationContext;
  activeOrderId: number | null;
}

interface ConversationRow {
  id: number;
  phone_number: string;
  current_state: string;
  context: ConversationContext;
  active_order_id: number | null;
}

function mapConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    phoneNumber: row.phone_number,
    currentState: row.current_state as ConversationState,
    context: row.context ?? {},
    activeOrderId: row.active_order_id,
  };
}

export async function getOrCreateConversation(phoneNumber: string): Promise<Conversation> {
  const existing = await pool.query<ConversationRow>(
    `SELECT * FROM whatsapp_conversations WHERE phone_number = $1`,
    [phoneNumber],
  );
  if (existing.rows[0]) {
    return mapConversation(existing.rows[0]);
  }

  const created = await pool.query<ConversationRow>(
    `INSERT INTO whatsapp_conversations (phone_number, current_state, context, last_message_at)
     VALUES ($1, $2, '{}'::jsonb, now())
     RETURNING *`,
    [phoneNumber, CONVERSATION_STATES.INICIO],
  );
  return mapConversation(created.rows[0]!);
}

export async function updateConversation(
  conversation: Conversation,
  updates: Partial<Pick<Conversation, "currentState" | "context" | "activeOrderId">>,
): Promise<void> {
  const nextState = updates.currentState ?? conversation.currentState;
  const nextContext = updates.context ?? conversation.context;
  const nextActiveOrderId =
    updates.activeOrderId !== undefined ? updates.activeOrderId : conversation.activeOrderId;

  await pool.query(
    `UPDATE whatsapp_conversations
     SET current_state = $2, context = $3, active_order_id = $4, last_message_at = now()
     WHERE id = $1`,
    [conversation.id, nextState, JSON.stringify(nextContext), nextActiveOrderId],
  );
}
