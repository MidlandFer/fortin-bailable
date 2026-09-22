import { Jimp } from "jimp";
import jsQR from "jsqr";

/**
 * Lee el contenido de texto de un QR dentro de una imagen. Devuelve null si no
 * encuentra ninguno. "attemptBoth" también prueba la imagen en negativo, que
 * ayuda con fotos de pantallas con reflejos o brillo desparejo.
 */
export async function decodeQrFromImage(buffer: Buffer): Promise<string | null> {
  const image = await Jimp.read(buffer);
  const { data, width, height } = image.bitmap;
  const result = jsQR(new Uint8ClampedArray(data), width, height, {
    inversionAttempts: "attemptBoth",
  });
  return result?.data ?? null;
}
