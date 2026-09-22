export type CardDetails = { id: string; number: string; expiry: string; cvv: string };

function hash(value: string) {
  let result = 2166136261;
  for (const character of value) { result ^= character.charCodeAt(0); result = Math.imul(result, 16777619); }
  return result >>> 0;
}

function withLuhnCheckDigit(prefix: string) {
  let total = 0;
  for (let index = prefix.length - 1, position = 0; index >= 0; index -= 1, position += 1) {
    let digit = Number(prefix[index]);
    if (position % 2 === 0) { digit *= 2; if (digit > 9) digit -= 9; }
    total += digit;
  }
  return `${prefix}${(10 - (total % 10)) % 10}`;
}

export function createCardDetails(userId: string): CardDetails {
  const seed = hash(userId.trim() || "aurex-card");
  const body = String(seed).padStart(9, "0").slice(-9);
  const number = withLuhnCheckDigit(`5356${body}000`).replace(/(\d{4})/g, "$1 ").trim();
  return { id: `card-${seed.toString(36)}`, number, expiry: `09/${29 + (seed % 5)}`, cvv: String((seed % 900) + 100) };
}
