import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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

export const supabase = createClient(
  supabaseUrl || "https://missing-supabase-url.supabase.co",
  supabaseAnonKey || "missing-supabase-anon-key"
);
