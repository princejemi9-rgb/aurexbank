import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseUser, type SupabaseRouteUser } from "./supabaseAuth";

export function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY || "";
  return url && key ? createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }) : null;
}

export function isSuperAdmin(user: SupabaseRouteUser | null) {
  const allowed = (process.env.AUREX_ADMIN_EMAILS || "princejemi9@gmail.com").split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
  return Boolean(user?.email && allowed.includes(user.email.toLowerCase()));
}

export async function requestUser(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!url || !anon || !token) return null;
  const result = await getSupabaseUser(url, anon, token);
  return result.user;
}

export async function approvedPersonalAdmin(db: SupabaseClient, userId: string) {
  const { data } = await db.from("personal_admin_profiles").select("user_id,status,referral_code,full_name,email,phone,permissions").eq("user_id", userId).eq("status", "approved").maybeSingle();
  return data as { user_id: string; status: string; referral_code: string; full_name: string; email: string; phone: string; permissions: Record<string, boolean> } | null;
}
