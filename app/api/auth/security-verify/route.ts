import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseUser } from "../../../../src/lib/server/supabaseAuth";
import {
  PASSCODE_METADATA_KEY,
  readSecurityPasscode,
  validatePasscodeInput,
  verifySecurityPasscode,
} from "../../../../src/lib/server/securityPasscode";
import { createSecuritySession, setSecuritySession } from "../../../../src/lib/server/securitySession";

function isAdminEmail(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return false;

  return new Set([
    "princejemi9@gmail.com",
    ...(process.env.AUREX_ADMIN_EMAILS || "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  ]).has(normalized);
}

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const body = (await request.json().catch(() => null)) as { passcode?: unknown } | null;

  if (!url || !key || !token) return NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 });

  const auth = await getSupabaseUser(url, key, token);
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: "Invalid session" }, { status: auth.status });
  }

  try {
    const response = NextResponse.json({ ok: true, bypassed: isAdminEmail(auth.user.email) });

    if (isAdminEmail(auth.user.email)) {
      setSecuritySession(response, createSecuritySession(auth.user.id, "admin-bypass"));
      return response;
    }

    const passcode = body?.passcode;
    if (!validatePasscodeInput(passcode)) {
      return NextResponse.json({ ok: false, error: "Enter your security passcode." }, { status: 400 });
    }

    const record = readSecurityPasscode(auth.user.app_metadata?.[PASSCODE_METADATA_KEY]);
    if (!record) {
      return NextResponse.json(
        { ok: false, error: "A security passcode has not been configured for this account. Contact an administrator." },
        { status: 403 }
      );
    }
    if (!verifySecurityPasscode(passcode, record)) {
      return NextResponse.json({ ok: false, error: "Incorrect security passcode. Please try again." }, { status: 401 });
    }

    setSecuritySession(response, createSecuritySession(auth.user.id, record.revision));
    return response;
  } catch {
    return NextResponse.json({ ok: false, error: "Security verification is unavailable." }, { status: 503 });
  }
}
