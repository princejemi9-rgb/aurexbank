import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseUser } from "../../../../src/lib/server/supabaseAuth";

function getAllowedAdminEmails() {
  return Array.from(
    new Set([
      "princejemi9@gmail.com",
      ...(process.env.AUREX_ADMIN_EMAILS || "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ])
  );
}

export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";

  if (!url || !key || !token) {
    return NextResponse.json({ ok: true, configured: false, verified: true }, { status: 200 });
  }

  const result = await getSupabaseUser(url, key, token);
  if (!result.user) {
    return NextResponse.json({ ok: true, configured: false, verified: true }, { status: 200 });
  }

  return NextResponse.json({ ok: true, configured: false, verified: true });
}
