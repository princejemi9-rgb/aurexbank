import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY || "";
}

export async function GET(request: NextRequest) {
  const accountNumber = request.nextUrl.searchParams.get("accountNumber")?.replace(/\D/g, "") || "";
  if (!/^\d{10}$/.test(accountNumber)) return NextResponse.json({ ok: false, error: "Enter a 10-digit account number." }, { status: 400 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = getServiceRoleKey();
  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!supabaseUrl || !anonKey || !serviceKey) return NextResponse.json({ ok: false, error: "Recipient lookup is unavailable." }, { status: 503 });
  if (!accessToken) return NextResponse.json({ ok: false, error: "Missing access token." }, { status: 401 });

  const authClient = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error: authError } = await authClient.auth.getUser(accessToken);
  if (authError || !user) return NextResponse.json({ ok: false, error: "Invalid session." }, { status: 401 });

  const accountClient = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await accountClient.auth.admin.listUsers({ page, perPage: 100 });
    if (error) return NextResponse.json({ ok: false, error: "Recipient lookup is unavailable." }, { status: 503 });
    const match = data.users.find((candidate) => readText(candidate.user_metadata?.account_number) === accountNumber);
    if (match) {
      const fullName = readText(match.user_metadata?.full_name) || [readText(match.user_metadata?.first_name), readText(match.user_metadata?.last_name)].filter(Boolean).join(" ");
      return NextResponse.json({ ok: true, matched: true, fullName: fullName || "Aurex account holder" });
    }
    if (data.users.length < 100) break;
  }
  return NextResponse.json({ ok: true, matched: false });
}
