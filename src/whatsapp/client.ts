import axios from "axios";
import FormData from "form-data";
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

/** Sube un archivo binario a los servidores de WhatsApp y devuelve su media id. */
export async function uploadMedia(
  buffer: Buffer,
  mimeType: string,
  filename: string,
): Promise<string> {
  const { token, phoneNumberId } = requireConfig();

  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("file", buffer, { filename, contentType: mimeType });

  const response = await axios.post<{ id: string }>(graphUrl(`${phoneNumberId}/media`), form, {
    headers: { Authorization: `Bearer ${token}`, ...form.getHeaders() },
  });
  return response.data.id;
}

export async function sendImageByMediaId(to: string, mediaId: string, caption?: string) {
  const { token, phoneNumberId } = requireConfig();

  await axios.post(
    graphUrl(`${phoneNumberId}/messages`),
    {
      messaging_product: "whatsapp",
      to,
      type: "image",
      image: { id: mediaId, caption },
    },
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

/** Descarga un media de WhatsApp (foto, documento, etc.) a partir de su media id. */
export async function downloadMedia(mediaId: string): Promise<Buffer> {
  const { token } = requireConfig();

  const metadata = await axios.get<{ url: string }>(graphUrl(mediaId), {
    headers: { Authorization: `Bearer ${token}` },
  });

  const file = await axios.get<ArrayBuffer>(metadata.data.url, {
    headers: { Authorization: `Bearer ${token}` },
    responseType: "arraybuffer",
  });
  return Buffer.from(file.data);
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
