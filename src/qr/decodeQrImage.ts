import { Jimp } from "jimp";
import jsQR from "jsqr";

function scanImage(image: { bitmap: { data: Buffer; width: number; height: number } }): string | null {
  const { data, width, height } = image.bitmap;
  const result = jsQR(new Uint8ClampedArray(data), width, height, {
    inversionAttempts: "attemptBoth",
  });
  return result?.data ?? null;
}

/**
 * Lee el contenido de texto de un QR dentro de una imagen. Devuelve null si no
 * encuentra ninguno tras varios intentos. "attemptBoth" en jsQR ya prueba la
 * imagen en negativo; acá además probamos con más contraste, porque las fotos
 * de pantalla (reflejos, brillo desparejo, recompresión al reenviar por
 * WhatsApp) suelen fallar con los píxeles tal cual llegan.
 */
export async function decodeQrFromImage(buffer: Buffer): Promise<string | null> {
  const image = await Jimp.read(buffer);

  const direct = scanImage(image);
  if (direct) return direct;

  const normalized = scanImage(image.clone().greyscale().normalize());
  if (normalized) return normalized;

  return scanImage(image.clone().greyscale().contrast(0.5));
}
