export type BrandingConfig = {
  bankName: string;
  logoUrl: string;
  logoPath: string;
  primaryColor: string;
  backgroundColor: string;
  updatedAt: string;
};

export const DEFAULT_BRANDING: BrandingConfig = {
  bankName: "Aurex Bank",
  logoUrl: "",
  logoPath: "",
  primaryColor: "#05df72",
  backgroundColor: "#050606",
  updatedAt: "",
};

export const BRANDING_BUCKET = "avatars";
export const BRANDING_CONFIG_PATH = "branding/config.json";
export const BRANDING_CACHE_KEY = "aurexbank:branding";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function isHexColor(value: string) {
  return HEX_COLOR.test(value);
}

export function normalizeBrandingConfig(value: unknown): BrandingConfig {
  const record =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const bankName =
    typeof record.bankName === "string" ? record.bankName.trim().slice(0, 48) : "";
  const logoUrl = typeof record.logoUrl === "string" ? record.logoUrl.trim() : "";
  const logoPath = typeof record.logoPath === "string" ? record.logoPath.trim() : "";
  const primaryColor =
    typeof record.primaryColor === "string" && isHexColor(record.primaryColor)
      ? record.primaryColor.toLowerCase()
      : DEFAULT_BRANDING.primaryColor;
  const backgroundColor =
    typeof record.backgroundColor === "string" && isHexColor(record.backgroundColor)
      ? record.backgroundColor.toLowerCase()
      : DEFAULT_BRANDING.backgroundColor;

  return {
    bankName: bankName || DEFAULT_BRANDING.bankName,
    logoUrl:
      logoUrl.startsWith("/") || /^https:\/\//i.test(logoUrl) ? logoUrl : "",
    logoPath,
    primaryColor,
    backgroundColor,
    updatedAt:
      typeof record.updatedAt === "string" ? record.updatedAt : "",
  };
}

export function replaceLegacyBrandText(value: string, bankName: string) {
  if (!value || bankName === DEFAULT_BRANDING.bankName) return value;

  const upperName = bankName.toUpperCase();

  return value.replace(
    /\bAUREX BANK\b|\bAurex Bank\b|\bAUREX\b|\bAurex\b/g,
    (match) => (match === match.toUpperCase() ? upperName : bankName)
  );
}

export function getRelativeLuminance(hex: string) {
  const channels = [1, 3, 5].map((index) => {
    const value = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
