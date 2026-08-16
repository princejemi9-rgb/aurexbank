import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseUser } from "../../../../src/lib/server/supabaseAuth";
import { PASSCODE_METADATA_KEY, readSecurityPasscode, tokenFingerprint, validatePasscodeInput, verifySecurityPasscode } from "../../../../src/lib/server/securityPasscode";
import { createSecuritySession, setSecuritySession } from "../../../../src/lib/server/securitySession";

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY || "";
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const body = await request.json().catch(() => null) as { passcode?: unknown } | null;
  if (!url || !key || !serviceKey || !token) return NextResponse.json({ ok: false, error: "Security verification is unavailable." }, { status: 503 });
  if (!validatePasscodeInput(body?.passcode)) return NextResponse.json({ ok: false, error: "Enter your security passcode." }, { status: 400 });
  const auth = await getSupabaseUser(url, key, token);
  if (!auth.user) return NextResponse.json({ ok: false, error: "Invalid session" }, { status: auth.status });
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user } } = await admin.auth.admin.getUserById(auth.user.id);
  const record = readSecurityPasscode(user?.app_metadata?.[PASSCODE_METADATA_KEY]);
  if (!record) return NextResponse.json({ ok: false, error: "A security passcode has not been configured for this account." }, { status: 403 });
  if (!verifySecurityPasscode(body!.passcode as string, record)) return NextResponse.json({ ok: false, error: "Incorrect security passcode. Please try again." }, { status: 401 });
  try {
    const response = NextResponse.json({ ok: true });
    setSecuritySession(response, createSecuritySession(auth.user.id, tokenFingerprint(token), record.revision));
    return response;
  } catch { return NextResponse.json({ ok: false, error: "Security verification is unavailable." }, { status: 503 }); }
}
