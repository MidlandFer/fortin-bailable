export function normalizeDigits(input: string): string {
  return input.replace(/[.\-\s]/g, "");
}

export function isValidDni(input: string): boolean {
  const digits = normalizeDigits(input);
  return /^\d{7,8}$/.test(digits);
}

const CUIT_MULTIPLIERS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

export function isValidCuitCuil(input: string): boolean {
  const digits = normalizeDigits(input);
  if (!/^\d{11}$/.test(digits)) return false;

  const nums = digits.split("").map(Number);
  const checkDigit = nums[10];

  const sum = CUIT_MULTIPLIERS.reduce((acc, mult, i) => acc + mult * nums[i]!, 0);
  const remainder = sum % 11;
  let expected = 11 - remainder;
  if (expected === 11) expected = 0;
  if (expected === 10) return false; // combinación imposible para un CUIT/CUIL real

  return expected === checkDigit;
}

export function parseQuantity(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d{1,2}$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (n <= 0) return null;
  return n;
}

export function isAffirmative(input: string): boolean {
  const normalized = input.trim().toLowerCase();
  return ["si", "sí", "sii", "siii", "dale", "obvio", "quiero"].includes(normalized);
}

export function isNegative(input: string): boolean {
  const normalized = input.trim().toLowerCase();
  return ["no", "nop", "no gracias", "ahora no"].includes(normalized);
}
