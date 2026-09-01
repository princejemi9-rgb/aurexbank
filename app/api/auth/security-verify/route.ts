import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseUser } from "../../../../src/lib/server/supabaseAuth";

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";

  if (!url || !key || !token) {
    return NextResponse.json({ ok: true, verified: true, bypassed: true, disabled: true }, { status: 200 });
  }

  const auth = await getSupabaseUser(url, key, token);
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: "Invalid session" }, { status: auth.status });
  }

  return NextResponse.json({ ok: true, verified: true, bypassed: true, disabled: true });
}
