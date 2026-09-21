import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseUser } from "../../../../src/lib/server/supabaseAuth";

const ADMIN_EMAIL = "princejemi9@gmail.com";

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { ok: false, isAdmin: false, error: "Missing Supabase env vars" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization") || "";
  const accessToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!accessToken) {
    return NextResponse.json({ ok: true, isAdmin: false }, { status: 401 });
  }

  const userResult = await getSupabaseUser(
    supabaseUrl,
    supabaseAnonKey,
    accessToken
  );

  if (!userResult.user && userResult.status >= 500) {
    return NextResponse.json(
      { ok: false, isAdmin: false, error: userResult.error },
      { status: 503 }
    );
  }

  const user = userResult.user;

  if (!user?.email) {
    return NextResponse.json({ ok: true, isAdmin: false }, { status: 401 });
  }

  const isAdmin = user.email.trim().toLowerCase() === ADMIN_EMAIL;

  return NextResponse.json({ ok: true, isAdmin });
}
