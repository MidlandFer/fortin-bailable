import axios from "axios";
import { env } from "../config/env";

function requireConfig() {
  if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    throw new Error(
      "WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID no configurados. Completá esas variables antes de enviar mensajes.",
    );
  }
  return { token: env.WHATSAPP_TOKEN, phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID };
}

const GRAPH_API_VERSION = "v21.0";

function graphUrl(path: string) {
  return `https://graph.facebook.com/${GRAPH_API_VERSION}/${path}`;
}

export async function sendText(to: string, body: string) {
  const { token, phoneNumberId } = requireConfig();

  await axios.post(
    graphUrl(`${phoneNumberId}/messages`),
    {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    },
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

export async function markAsRead(messageId: string) {
  const { token, phoneNumberId } = requireConfig();

  await axios.post(
    graphUrl(`${phoneNumberId}/messages`),
    {
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    },
    { headers: { Authorization: `Bearer ${token}` } },
  );
}
