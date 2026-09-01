import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
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

function isAdminUser(user: { email?: string | null; app_metadata?: Record<string, unknown> | null; user_metadata?: Record<string, unknown> | null } | null | undefined) {
  if (!user) return false;

  const email = user.email?.trim().toLowerCase();
  if (email && getAllowedAdminEmails().includes(email)) {
    return true;
  }

  const values = [
    user.app_metadata?.is_admin,
    user.app_metadata?.admin,
    user.app_metadata?.role,
    user.user_metadata?.is_admin,
    user.user_metadata?.admin,
    user.user_metadata?.role,
  ];

  return values.some((value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      return normalized === "admin" || normalized === "true" || normalized === "1" || normalized === "yes";
    }
    return false;
  });
}

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

  const isAdmin = isAdminUser(user);

  return NextResponse.json({ ok: true, isAdmin });
}
