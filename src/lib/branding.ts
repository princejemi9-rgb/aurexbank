export type BrandThemeId = "aurex-luxury" | "american-classic" | "royal-blue" | "executive-gold" | "modern-minimal" | "custom";

export type BrandingConfig = {
  bankName: string; shortName: string; tagline: string; supportName: string; footerName: string; description: string;
  logoUrl: string; logoPath: string; compactLogoUrl: string; compactLogoPath: string; lightLogoUrl: string; darkLogoUrl: string;
  themeId: BrandThemeId; primaryColor: string; secondaryColor: string; accentColor: string; backgroundColor: string; surfaceColor: string; headerColor: string; sidebarColor: string; textColor: string; borderColor: string; successColor: string; warningColor: string; errorColor: string; cardGradient: string;
  updatedAt: string; version: number;
};

type ThemePreset = Omit<BrandingConfig, "bankName" | "shortName" | "tagline" | "supportName" | "footerName" | "description" | "logoUrl" | "logoPath" | "compactLogoUrl" | "compactLogoPath" | "lightLogoUrl" | "darkLogoUrl" | "updatedAt" | "version"> & { label: string };
export const THEME_PRESETS: Record<Exclude<BrandThemeId, "custom">, ThemePreset> = {
  "aurex-luxury": { label: "Aurex Luxury", themeId: "aurex-luxury", primaryColor: "#05df72", secondaryColor: "#061b11", accentColor: "#80f2b1", backgroundColor: "#050606", surfaceColor: "#0b1510", headerColor: "#050606", sidebarColor: "#07120d", textColor: "#f5fff8", borderColor: "#214b32", successColor: "#05df72", warningColor: "#f6c453", errorColor: "#f26363", cardGradient: "linear-gradient(145deg,#020403,#063d24,#050606)" },
  "american-classic": { label: "American Classic", themeId: "american-classic", primaryColor: "#012169", secondaryColor: "#c41230", accentColor: "#c41230", backgroundColor: "#f5f7fa", surfaceColor: "#ffffff", headerColor: "#012169", sidebarColor: "#012169", textColor: "#172033", borderColor: "#d8dee9", successColor: "#087443", warningColor: "#a65c00", errorColor: "#c41230", cardGradient: "linear-gradient(145deg,#01133d,#012169 63%,#c41230)" },
  "royal-blue": { label: "Royal Blue", themeId: "royal-blue", primaryColor: "#2563eb", secondaryColor: "#102a6b", accentColor: "#8fb7ff", backgroundColor: "#09142f", surfaceColor: "#10204a", headerColor: "#0b1c48", sidebarColor: "#0b1c48", textColor: "#f7faff", borderColor: "#36599f", successColor: "#2dd4bf", warningColor: "#fbbf24", errorColor: "#fb7185", cardGradient: "linear-gradient(145deg,#102a6b,#2563eb,#8fb7ff)" },
  "executive-gold": { label: "Executive Gold", themeId: "executive-gold", primaryColor: "#d4af37", secondaryColor: "#191713", accentColor: "#f3d982", backgroundColor: "#12110f", surfaceColor: "#211e18", headerColor: "#12110f", sidebarColor: "#17140f", textColor: "#fff9e9", borderColor: "#615530", successColor: "#c7b35b", warningColor: "#f3d982", errorColor: "#e07568", cardGradient: "linear-gradient(145deg,#090806,#332a12,#d4af37)" },
  "modern-minimal": { label: "Modern Minimal", themeId: "modern-minimal", primaryColor: "#2563eb", secondaryColor: "#475569", accentColor: "#60a5fa", backgroundColor: "#f8fafc", surfaceColor: "#ffffff", headerColor: "#ffffff", sidebarColor: "#172033", textColor: "#172033", borderColor: "#d8e0eb", successColor: "#15803d", warningColor: "#b45309", errorColor: "#dc2626", cardGradient: "linear-gradient(145deg,#172033,#2563eb,#60a5fa)" },
};
export const DEFAULT_BRANDING: BrandingConfig = { bankName: "Aurex Bank", shortName: "Aurex", tagline: "Private Digital Banking", supportName: "Aurex Bank Support", footerName: "Aurex Bank", description: "", logoUrl: "", logoPath: "", compactLogoUrl: "", compactLogoPath: "", lightLogoUrl: "", darkLogoUrl: "", ...THEME_PRESETS["aurex-luxury"], updatedAt: "", version: 1 };
export const BRANDING_BUCKET = "avatars";
export const BRANDING_CONFIG_PATH = "branding/config.json";
export const BRANDING_DRAFT_PATH = "branding/draft.json";
export const BRANDING_REVISION_PREFIX = "branding/revisions";
export const BRANDING_CACHE_KEY = "aurexbank:branding";
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const THEMES = new Set<BrandThemeId>(["aurex-luxury", "american-classic", "royal-blue", "executive-gold", "modern-minimal", "custom"]);
const COLOR_KEYS = ["primaryColor", "secondaryColor", "accentColor", "backgroundColor", "surfaceColor", "headerColor", "sidebarColor", "textColor", "borderColor", "successColor", "warningColor", "errorColor"] as const;
export function isHexColor(value: string) { return HEX_COLOR.test(value); }
export function isSafeBrandUrl(value: string) { return value.startsWith("/") || /^https:\/\//i.test(value); }
export function presetFor(themeId: BrandThemeId) { return themeId === "custom" ? null : THEME_PRESETS[themeId]; }
export function normalizeBrandingConfig(value: unknown): BrandingConfig {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const themeId = typeof record.themeId === "string" && THEMES.has(record.themeId as BrandThemeId) ? record.themeId as BrandThemeId : DEFAULT_BRANDING.themeId;
  const preset = presetFor(themeId); const string = (k: string, f: string, n = 96) => typeof record[k] === "string" && record[k].trim() ? record[k].trim().slice(0, n) : f;
  const color = (k: typeof COLOR_KEYS[number]) => { const v = typeof record[k] === "string" ? record[k].toLowerCase() : ""; return isHexColor(v) ? v : (preset?.[k] ?? DEFAULT_BRANDING[k]); };
  const url = (k: string) => { const v = string(k, "", 2000); return isSafeBrandUrl(v) ? v : ""; };
  return { ...DEFAULT_BRANDING, ...preset, themeId, bankName: string("bankName", DEFAULT_BRANDING.bankName, 96), shortName: string("shortName", "", 40) || string("bankName", DEFAULT_BRANDING.bankName, 40), tagline: string("tagline", DEFAULT_BRANDING.tagline, 100), supportName: string("supportName", DEFAULT_BRANDING.supportName, 100), footerName: string("footerName", "", 100) || string("bankName", DEFAULT_BRANDING.bankName, 96), description: string("description", "", 500), logoUrl: url("logoUrl"), logoPath: string("logoPath", "", 300), compactLogoUrl: url("compactLogoUrl"), compactLogoPath: string("compactLogoPath", "", 300), lightLogoUrl: url("lightLogoUrl"), darkLogoUrl: url("darkLogoUrl"), ...Object.fromEntries(COLOR_KEYS.map(k => [k, color(k)])), cardGradient: typeof record.cardGradient === "string" && record.cardGradient.startsWith("linear-gradient(") && record.cardGradient.length < 250 ? record.cardGradient : (preset?.cardGradient ?? DEFAULT_BRANDING.cardGradient), updatedAt: string("updatedAt", "", 80), version: typeof record.version === "number" && Number.isInteger(record.version) && record.version > 0 ? record.version : DEFAULT_BRANDING.version } as BrandingConfig;
}
export function replaceLegacyBrandText(value: string, bankName: string) { if (!value || bankName === DEFAULT_BRANDING.bankName) return value; return value.replace(/\bAUREX BANK\b|\bAurex Bank\b|\bAUREX\b|\bAurex\b/g, match => match === match.toUpperCase() ? bankName.toUpperCase() : bankName); }
export function getRelativeLuminance(hex: string) { const c = [1,3,5].map(i => { const v = Number.parseInt(hex.slice(i,i+2),16)/255; return v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4; }); return c[0]*.2126+c[1]*.7152+c[2]*.0722; }
