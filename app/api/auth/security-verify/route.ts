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

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";

  if (!url || !key || !token) {
    return NextResponse.json({ ok: false, error: "Security verification is unavailable." }, { status: 503 });
  }

  const auth = await getSupabaseUser(url, key, token);
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: "Invalid session" }, { status: auth.status });
  }

  const response = NextResponse.json({ ok: true, bypassed: true });
  return response;
}
