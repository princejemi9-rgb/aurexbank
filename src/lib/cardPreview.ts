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
  return {
    id: `digital-${key}`,
    number: "•••• •••• •••• 2464",
    previewIdentifier: `${group(0)} ${group(4)} 2464`,
    expiry: "12/29",
    securityCode: "581",
    holder: holder.trim() || "Aurex customer",
    status: "Digital debit",
    issuerCard: false,
  };
}
