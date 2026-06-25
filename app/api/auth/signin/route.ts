import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { fetchWithRemoteTimeout } from "../../../../src/lib/server/remoteTimeout";

type SupabasePasswordSession = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: string;
  user?: {
    id?: string;
    email?: string | null;
    user_metadata?: Record<string, unknown> | null;
  };
};

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function readAuthError(response: Response) {
  const data = (await response.json().catch(() => null)) as
    | {
        msg?: string;
        message?: string;
        error_description?: string;
        error?: string;
      }
    | null;

  return (
    data?.msg ||
    data?.message ||
    data?.error_description ||
    data?.error ||
    "Unable to sign in"
  );
}

function getSupabaseAuthStorageKey(supabaseUrl: string) {
  try {
    return `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { ok: false, error: "Missing Supabase env vars" },
      { status: 500 }
    );
  }

  const body = (await request.json().catch(() => null)) as
    | { email?: unknown; password?: unknown }
    | null;
  const email = readString(body?.email).toLowerCase();
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, error: "Please enter both email and password" },
      { status: 400 }
    );
  }

  const authResponse = await fetchWithRemoteTimeout(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    },
    20000
  ).catch(() => null);

  if (!authResponse) {
    return NextResponse.json(
      { ok: false, error: "Unable to reach authentication service" },
      { status: 503 }
    );
  }

  if (!authResponse.ok) {
    return NextResponse.json(
      { ok: false, error: await readAuthError(authResponse) },
      { status: authResponse.status === 400 ? 401 : authResponse.status }
    );
  }

  const session = (await authResponse.json().catch(() => null)) as
    | SupabasePasswordSession
    | null;

  if (!session?.access_token || !session.refresh_token || !session.user?.id) {
    return NextResponse.json(
      { ok: false, error: "Unable to establish secure banking session" },
      { status: 502 }
    );
  }

  const res = NextResponse.json({
    ok: true,
    session: {
      ...session,
      expires_at:
        session.expires_at ||
        Math.round(Date.now() / 1000) + (session.expires_in || 3600),
    },
    storageKey: getSupabaseAuthStorageKey(supabaseUrl),
  });

  res.cookies.set("sb_logged_in", "1", {
    path: "/",
    httpOnly: true,
    maxAge: 60 * 60 * 24,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });

  return res;
}
