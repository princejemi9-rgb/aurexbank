import { clearCachedAdminStatus } from "./isAdmin";
import { supabaseAuthStorageKey } from "./supabase";

const ACCOUNT_CACHE_KEYS = new Set([
  "aurex-bill-pay",
  "aurexbank:transfer-verification-requests",
]);

/** Remove only state that can identify or authorize the signed-out account. */
export function clearCurrentAccountCache(userId?: string) {
  clearCachedAdminStatus();

  if (typeof window === "undefined") return;

  const accountKeys = userId
    ? [
        `aurexbank:${userId}:`,
        `aurexbank-kyc-${userId}`,
        `aurex-card-preferences:${userId}`,
      ]
    : [];

  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);
    if (!key) continue;

    const belongsToAccount = accountKeys.some(
      (prefix) => key === prefix || key.startsWith(prefix)
    );
    const isSupabaseSession = key === supabaseAuthStorageKey;

    if (belongsToAccount || isSupabaseSession || ACCOUNT_CACHE_KEYS.has(key)) {
      window.localStorage.removeItem(key);
    }
  }
}
