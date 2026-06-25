import { supabase } from "./supabase";
import type { Session } from "@supabase/supabase-js";

export type AdminStatus = {
  isAdmin: boolean;
  loading: boolean;
};

type CachedAdminStatus = {
  checkedAt: number;
  isAdmin: boolean;
  userId: string;
};

const ADMIN_CACHE_TTL_MS = 5 * 60 * 1000;
const ADMIN_CACHE_STORAGE_KEY = "aurexbank:admin-status";
let cachedAdminStatus: CachedAdminStatus | null = null;
let pendingAdminStatus: Promise<boolean> | null = null;
let pendingAdminUserId: string | null = null;

function readStoredAdminStatus() {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.localStorage.getItem(ADMIN_CACHE_STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as CachedAdminStatus;
    if (
      typeof parsed.userId !== "string" ||
      typeof parsed.checkedAt !== "number" ||
      typeof parsed.isAdmin !== "boolean"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeStoredAdminStatus(status: CachedAdminStatus) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ADMIN_CACHE_STORAGE_KEY, JSON.stringify(status));
}

function isFreshCache(userId: string) {
  cachedAdminStatus = cachedAdminStatus ?? readStoredAdminStatus();
  return (
    cachedAdminStatus?.userId === userId &&
    Date.now() - cachedAdminStatus.checkedAt < ADMIN_CACHE_TTL_MS
  );
}

export function getCachedAdminStatus(userId?: string | null) {
  cachedAdminStatus = cachedAdminStatus ?? readStoredAdminStatus();
  if (!cachedAdminStatus) return null;
  if (userId && cachedAdminStatus.userId !== userId) return null;
  return cachedAdminStatus;
}

export function clearCachedAdminStatus() {
  cachedAdminStatus = null;
  pendingAdminStatus = null;
  pendingAdminUserId = null;
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(ADMIN_CACHE_STORAGE_KEY);
  }
}

export async function fetchIsAdmin(options: {
  force?: boolean;
  session?: Session | null;
} = {}): Promise<boolean> {
  const session =
    options.session ??
    (
      await supabase.auth.getSession()
    ).data.session;

  const token = session?.access_token;
  const userId = session?.user?.id;
  if (!token || !userId) return false;

  if (!options.force && isFreshCache(userId)) {
    return cachedAdminStatus?.isAdmin === true;
  }

  if (pendingAdminStatus && pendingAdminUserId === userId) {
    return pendingAdminStatus;
  }

  pendingAdminUserId = userId;
  pendingAdminStatus = (async () => {
    const priorStatus = getCachedAdminStatus(userId);

    try {
      const response = await fetch("/api/admin/status", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = (await response.json().catch(() => null)) as
        | { isAdmin?: boolean }
        | null;

      if (!response.ok) {
        return response.status >= 500 && priorStatus?.isAdmin === true;
      }

      const isAdmin = data?.isAdmin === true;
      cachedAdminStatus = {
        checkedAt: Date.now(),
        isAdmin,
        userId,
      };
      writeStoredAdminStatus(cachedAdminStatus);

      return isAdmin;
    } catch {
      return priorStatus?.isAdmin === true;
    }
  })();

  try {
    return await pendingAdminStatus;
  } finally {
    pendingAdminStatus = null;
    pendingAdminUserId = null;
  }
}
