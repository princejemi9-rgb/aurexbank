import { createClient } from "@supabase/supabase-js";

const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

function parseSupabaseUrl(url: string) {
  try {
    return new URL(url).toString();
  } catch {
    console.error("[SUPABASE] Invalid Supabase URL:", url);
    return "";
  }
}

const supabaseUrl = parseSupabaseUrl(rawSupabaseUrl);

function getSupabaseAuthStorageKey(url: string | undefined) {
  if (!url) return null;

  try {
    return `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
  } catch {
    return null;
  }
}

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const supabaseAuthStorageKey = getSupabaseAuthStorageKey(supabaseUrl);

if (!supabaseUrl) {
  console.warn("[SUPABASE] Supabase client created without a valid URL. Set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL.");
}
if (!supabaseAnonKey) {
  console.warn("[SUPABASE] Supabase client created without an anon/service key. Set NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY.");
}

export const supabase = createClient(
  supabaseUrl || "https://missing-supabase-url.supabase.co",
  supabaseAnonKey || "missing-supabase-anon-key"
);
