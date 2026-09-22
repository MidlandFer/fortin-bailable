import { Jimp } from "jimp";
import jsQR from "jsqr";

/** Lee el contenido de texto de un QR dentro de una imagen. Devuelve null si no encuentra ninguno. */
export async function decodeQrFromImage(buffer: Buffer): Promise<string | null> {
  const image = await Jimp.read(buffer);
  const { data, width, height } = image.bitmap;
  const result = jsQR(new Uint8ClampedArray(data), width, height);
  return result?.data ?? null;
}
