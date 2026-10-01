export type CardPreview = {
  id: string;
  number: string;
  expiry: string;
  cvv: string;
  holder: string;
  status: "Digital debit";
  issuerCard: false;
};

export function createCardPreview(userId: string, holder: string): CardPreview {
  const key = userId.trim() || "pending";
  return {
    id: `digital-${key}`,
    number: "0000 0000 0000 0000",
    expiry: "12/29",
    cvv: "000",
    holder: holder.trim() || "Aurex customer",
    status: "Digital debit",
    issuerCard: false,
  };
}
