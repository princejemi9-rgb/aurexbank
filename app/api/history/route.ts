import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

function jsonError(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

/**
 * Returns the signed-in customer's own simulated history. The browser never
 * receives a service-role key and cannot select another customer's records.
 */
export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
  const authorization = request.headers.get("authorization") || "";
  const accessToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";

  if (!url || !anonKey || !serviceRoleKey) {
    return jsonError("Historical history is not configured", 503);
  }
  if (!accessToken) return jsonError("Sign in to view transaction history", 401);

  const authClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(accessToken);
  if (authError || !user) return jsonError("Invalid session", 401);

  const serviceClient = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await serviceClient
    .from("simulated_historical_transactions")
    .select("id,direction,amount,currency,category,description,counterparty_label,reference,status,effective_at,created_at")
    .eq("customer_id", user.id)
    .eq("metadata->>simulated", "true")
    .order("effective_at", { ascending: false });

  if (error) return jsonError("Historical records are temporarily unavailable", 503);
  return NextResponse.json({ ok: true, records: data ?? [] });
}
