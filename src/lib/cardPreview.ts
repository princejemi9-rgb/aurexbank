export type CardPreview = {
  id: string;
  number: string;
  previewIdentifier: string;
  expiry: string;
  securityCode: string;
  holder: string;
  status: "Digital debit";
  issuerCard: false;
};

export function createCardPreview(userId: string, holder: string): CardPreview {
  const key = userId.trim() || "pending";
  const seed = Array.from(key).reduce((total, character) => (total * 31 + character.charCodeAt(0)) >>> 0, 17);
  const group = (shift: number) => String((seed >>> shift) % 10000).padStart(4, "0");
  const candidate = `9495${group(0)}${group(4)}7554`;
  const luhnTotal = candidate.split("").reverse().reduce((total, digit, index) => {
    const value = Number(digit) * (index % 2 ? 2 : 1);
    return total + (value > 9 ? value - 9 : value);
  }, 0);
  const previewDigits = luhnTotal % 10 === 0
    ? `${candidate.slice(0, 11)}${(Number(candidate[11]) + 1) % 10}${candidate.slice(12)}`
    : candidate;
  return {
    id: `digital-${key}`,
    number: "•••• •••• •••• 7554",
    previewIdentifier: previewDigits.replace(/(\d{4})(?=\d)/g, "$1 "),
    expiry: "12/29",
    securityCode: "581",
    holder: holder.trim() || "Aurex customer",
    status: "Digital debit",
    issuerCard: false,
  };
}
