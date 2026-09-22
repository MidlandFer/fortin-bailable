import { SCAN_RESULT } from "../config/constants";
import { scanTicketToken } from "../tickets/verifierService";
import { messages } from "./messages";

export async function handleVerifierScan(verifierPhone: string, text: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return messages.qrInvalido;

  const outcome = await scanTicketToken(trimmed, verifierPhone);

  switch (outcome.result) {
    case SCAN_RESULT.OK:
      return messages.qrValido(outcome.ticket!);
    case SCAN_RESULT.YA_USADO:
      return messages.qrYaUsado(outcome.ticket!);
    case SCAN_RESULT.NO_ENCONTRADO:
      return messages.qrNoEncontrado;
    default:
      return messages.qrInvalido;
  }
}
