export type CardPreview = {
  id: string;
  identifier: string;
  holder: string;
  status: "Preview";
  issuerCard: false;
};

function digest(value: string) {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase().padStart(7, "0").slice(-7);
}

/** A non-payment UI record. It contains no PAN, CVV, expiry, or PIN. */
export function createCardPreview(userId: string, holder: string): CardPreview {
  const key = userId.trim() || "pending";
  return { id: `preview-${digest(key)}`, identifier: `ARX-PRV-${digest(`${key}:card`)}`, holder: holder.trim() || "Aurex customer", status: "Preview", issuerCard: false };
}
