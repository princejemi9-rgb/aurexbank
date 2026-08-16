import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseUser } from "../../../../src/lib/server/supabaseAuth";
import { PASSCODE_METADATA_KEY, readSecurityPasscode, tokenFingerprint } from "../../../../src/lib/server/securityPasscode";
import { readSecuritySession, SECURITY_SESSION_COOKIE } from "../../../../src/lib/server/securitySession";

export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!url || !key || !token) return NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 });
  const result = await getSupabaseUser(url, key, token);
  if (!result.user) return NextResponse.json({ ok: false, error: result.error || "Invalid session" }, { status: result.status });
  const passcode = readSecurityPasscode(result.user.app_metadata?.[PASSCODE_METADATA_KEY]);
  const session = readSecuritySession(request.cookies.get(SECURITY_SESSION_COOKIE)?.value);
  const verified = Boolean(passcode && session && session.userId === result.user.id && session.token === tokenFingerprint(token) && session.revision === passcode.revision);
  return NextResponse.json({ ok: true, configured: Boolean(passcode), verified });
}
