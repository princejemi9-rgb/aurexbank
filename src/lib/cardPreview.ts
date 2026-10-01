export type CardPreview = {
  id: string;
  number: string;
  expiry: string;
  securityCode: string;
  holder: string;
  status: "Digital debit";
  issuerCard: false;
};

export function createCardPreview(userId: string, holder: string): CardPreview {
  const key = userId.trim() || "pending";
  return {
    id: `digital-${key}`,
    number: "•••• •••• •••• 4827",
    expiry: "12/29",
    securityCode: "581",
    holder: holder.trim() || "Aurex customer",
    status: "Digital debit",
    issuerCard: false,
  };
}
