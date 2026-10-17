export const SUPPORT_LANGUAGES = [
  ["en", "English"], ["es", "Spanish"], ["fr", "French"], ["de", "German"], ["it", "Italian"], ["pt", "Portuguese"], ["ar", "Arabic"], ["ro", "Romanian"], ["tr", "Turkish"], ["ru", "Russian"], ["zh", "Chinese"], ["ja", "Japanese"], ["ko", "Korean"], ["hi", "Hindi"], ["nl", "Dutch"], ["pl", "Polish"], ["uk", "Ukrainian"], ["id", "Indonesian"], ["sw", "Swahili"],
] as const;

export type SupportLanguage = (typeof SUPPORT_LANGUAGES)[number][0];
export const DEFAULT_SUPPORT_LANGUAGE: SupportLanguage = "en";
export function isSupportLanguage(value: unknown): value is SupportLanguage { return typeof value === "string" && SUPPORT_LANGUAGES.some(([code]) => code === value); }
export function languageLabel(code: string) { return SUPPORT_LANGUAGES.find(([value]) => value === code)?.[1] ?? code; }
export function languageDirection(code: string) { return code === "ar" ? "rtl" : "ltr"; }
