import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseUser } from "../../../../src/lib/server/supabaseAuth";
import { PASSCODE_METADATA_KEY, readSecurityPasscode } from "../../../../src/lib/server/securityPasscode";
import { readSecuritySession, SECURITY_SESSION_COOKIE } from "../../../../src/lib/server/securitySession";

function isAdminEmail(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return false;
  return new Set([
    "princejemi9@gmail.com",
    ...(process.env.AUREX_ADMIN_EMAILS || "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean),
  ]).has(normalized);
}

export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!url || !key || !token) return NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 });

  const result = await getSupabaseUser(url, key, token);
  if (!result.user) return NextResponse.json({ ok: false, error: result.error || "Invalid session" }, { status: result.status });

  if (isAdminEmail(result.user.email)) {
    const session = readSecuritySession(request.cookies.get(SECURITY_SESSION_COOKIE)?.value);
    return NextResponse.json({ ok: true, configured: false, verified: Boolean(session && session.userId === result.user.id && session.revision === "admin-bypass"), bypassed: true });
  }

  const passcode = readSecurityPasscode(result.user.app_metadata?.[PASSCODE_METADATA_KEY]);
  const session = readSecuritySession(request.cookies.get(SECURITY_SESSION_COOKIE)?.value);
  const verified = Boolean(passcode && session && session.userId === result.user.id && session.revision === passcode.revision);
  return NextResponse.json({ ok: true, configured: Boolean(passcode), verified });
}
