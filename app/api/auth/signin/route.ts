import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { fetchWithRemoteTimeout } from "../../../../src/lib/server/remoteTimeout";
import { clearSecuritySession, createSecuritySession, setSecuritySession } from "../../../../src/lib/server/securitySession";

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

function isAdminEmail(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return false;
  return new Set([
    "princejemi9@gmail.com",
    ...(process.env.AUREX_ADMIN_EMAILS || "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean),
  ]).has(normalized);
}

export async function POST(request: NextRequest) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    "";

  console.log("[AUTH API] Sign-in request received");
  console.log("[AUTH API] Supabase URL present:", !!supabaseUrl);
  console.log("[AUTH API] Supabase anon/service key present:", !!supabaseAnonKey);
  if (supabaseUrl) {
    console.log("[AUTH API] Supabase URL prefix:", supabaseUrl.substring(0, 20) + "...");
  }
  if (supabaseAnonKey) {
    console.log("[AUTH API] Supabase key prefix:", supabaseAnonKey.substring(0, 10) + "...");
  }
  console.log("[AUTH API] NODE_ENV:", process.env.NODE_ENV);

  if (supabaseUrl) {
    console.log("[AUTH API] Supabase URL prefix:", supabaseUrl.substring(0, 20) + "...");
  }
  if (supabaseAnonKey) {
    console.log("[AUTH API] Anon key prefix:", supabaseAnonKey.substring(0, 10) + "...");
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "[AUTH API] MISSING ENV VARS - URL present:", !!supabaseUrl,
      "KEY present:", !!supabaseAnonKey
    );
    return NextResponse.json(
      {
        ok: false,
        error: !supabaseUrl
          ? "Missing Supabase URL environment variable"
          : "Missing Supabase anon/service key environment variable",
        errorType: "CONFIG_ERROR",
      },
      { status: 500 }
    );
  }

  const body = (await request.json().catch(() => null)) as
    | { email?: unknown; password?: unknown }
    | null;
  const email = readString(body?.email).toLowerCase();
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    console.log("[AUTH API] Missing email or password");
    return NextResponse.json(
      { ok: false, error: "Please enter both email and password" },
      { status: 400 }
    );
  }

  console.log("[AUTH API] Attempting to authenticate with Supabase...");
  console.log("[AUTH API] Target URL:", `${supabaseUrl}/auth/v1/token?grant_type=password`);

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
  ).catch((err) => {
    console.error("[AUTH API] fetchWithRemoteTimeout threw:", err?.message || err);
    return null;
  });

  if (!authResponse) {
    console.error("[AUTH API] No response from Supabase - likely network failure or timeout");
    return NextResponse.json(
      {
        ok: false,
        error: "Unable to reach authentication service",
        errorType: "SERVICE_UNAVAILABLE",
      },
      { status: 503 }
    );
  }

  console.log("[AUTH API] Supabase responded with status:", authResponse.status);

  if (!authResponse.ok) {
    const clonedRes = authResponse.clone();
    const rawBody = await clonedRes.text().catch(() => "(unable to read body)");
    console.error("[AUTH API] Supabase error response body:", rawBody);

    const parsedError = await readAuthError(authResponse);
    console.error("[AUTH API] Parsed error message:", parsedError);

    let errorType = "AUTH_FAILED";
    const lowerError = parsedError.toLowerCase();
    if (lowerError.includes("invalid login credentials") || lowerError.includes("invalid_grant") || lowerError.includes("wrong password") || lowerError.includes("email not confirmed")) {
      errorType = "INVALID_CREDENTIALS";
    } else if (lowerError.includes("network") || lowerError.includes("timeout") || lowerError.includes("fetch")) {
      errorType = "NETWORK_ERROR";
    } else if (lowerError.includes("rate limit") || lowerError.includes("too many requests")) {
      errorType = "RATE_LIMITED";
    }

    console.log("[AUTH API] Error classification:", errorType);

    return NextResponse.json(
      {
        ok: false,
        error: parsedError,
        errorType: errorType,
      },
      { status: authResponse.status === 400 ? 401 : authResponse.status }
    );
  }

  const session = (await authResponse.json().catch(() => null)) as
    | SupabasePasswordSession
    | null;

  if (!session?.access_token || !session.refresh_token || !session.user?.id) {
    console.error("[AUTH API] Session data incomplete after successful auth response");
    console.error("[AUTH API] Has access_token:", !!session?.access_token);
    console.error("[AUTH API] Has refresh_token:", !!session?.refresh_token);
    console.error("[AUTH API] Has user.id:", !!session?.user?.id);

    return NextResponse.json(
      { ok: false, error: "Unable to establish secure banking session" },
      { status: 502 }
    );
  }

  console.log("[AUTH API] Authentication successful for user:", session.user.email || session.user.id);

  const isLocalhost =
    request.nextUrl.hostname === "localhost" ||
    request.nextUrl.hostname === "127.0.0.1" ||
    request.nextUrl.hostname === "::1";

  const res = NextResponse.json({
    ok: true,
    session: {
      ...session,
      expires_at:
        session.expires_at ||
        Math.round(Date.now() / 1000) + (session.expires_in || 3600),
    },
    storageKey: getSupabaseAuthStorageKey(supabaseUrl),
    errorType: null,
  });

  res.cookies.set("sb_logged_in", "1", {
    path: "/",
    httpOnly: true,
    maxAge: 60 * 60 * 24,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production" && !isLocalhost,
  });
  // This signed, HttpOnly cookie is the server-side counterpart to the browser
  // Supabase session. It lets the proxy admit only a passcode-verified session.
  if (isAdminEmail(session.user.email)) {
    try {
      setSecuritySession(
        res,
        createSecuritySession(session.user.id, "admin-bypass")
      );
    } catch {
      return NextResponse.json(
        { ok: false, error: "Security session configuration is unavailable", errorType: "CONFIG_ERROR" },
        { status: 500 }
      );
    }
  } else {
    // A password login always requires a fresh user passcode verification.
    clearSecuritySession(res);
  }
  console.log("[AUTH API] Login cookie set, returning success response");
  return res;
}
