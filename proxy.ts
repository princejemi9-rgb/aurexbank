import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = new Set(["/login", "/auth/signin", "/auth/signup", "/auth/forgot-password", "/auth/reset-password"]);
const PUBLIC_API_PATHS = new Set(["/api/auth/signin", "/api/auth/session", "/api/auth/onboard"]);

function getAllowedAdminEmails() {
  return Array.from(
    new Set([
      "princejemi9@gmail.com",
      ...(process.env.AUREX_ADMIN_EMAILS || "")
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ])
  );
}

function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
}

function getSupabaseAnonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
}

function extractSupabaseAuthToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const bearerToken = authHeader.slice("Bearer ".length).trim();
    if (bearerToken) return bearerToken;
  }

  const authCookie = request.cookies.getAll().find((cookie) => cookie.name.startsWith("sb-") && cookie.name.endsWith("-auth-token"));
  if (!authCookie?.value) return null;

  try {
    const parsed = JSON.parse(authCookie.value);
    if (typeof parsed?.access_token === "string") return parsed.access_token;
    if (Array.isArray(parsed) && typeof parsed[0] === "string") return parsed[0];
  } catch {
    // Cookie value is not a JSON payload; fall back to raw token value.
  }

  const raw = authCookie.value.trim();
  return raw ? raw : null;
}

function isAdminUser(user: { email?: string | null; app_metadata?: Record<string, unknown> | null; user_metadata?: Record<string, unknown> | null } | null | undefined) {
  if (!user) return false;

  const email = typeof user.email === "string" ? user.email.trim().toLowerCase() : "";
  if (email) {
    const allowedAdmins = getAllowedAdminEmails();

    if (allowedAdmins.includes(email)) {
      return true;
    }
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

async function isAdminRequest(request: NextRequest) {
  const supabaseUrl = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  const token = extractSupabaseAuthToken(request);

  if (!supabaseUrl || !anonKey || !token) return false;

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
    },
  }).catch(() => null);

  if (!response?.ok) return false;

  const user = (await response.json().catch(() => null)) as { email?: string | null; app_metadata?: Record<string, unknown> | null; user_metadata?: Record<string, unknown> | null } | null;
  return isAdminUser(user);
}

const SECURITY_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Security-Policy":
    "object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-DNS-Prefetch-Control": "off",
  "X-Download-Options": "noopen",
  "X-Frame-Options": "DENY",
  "X-Permitted-Cross-Domain-Policies": "none",
} as const;

function applySecurityHeaders(response: NextResponse) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(name, value);
  }

  return response;
}

export async function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();

  if (url.pathname === "/") {
    url.pathname = extractSupabaseAuthToken(request) ? "/dashboard" : "/login";
    return applySecurityHeaders(NextResponse.redirect(url));
  }

  const isPublic = PUBLIC_PATHS.has(url.pathname) || PUBLIC_API_PATHS.has(url.pathname);
  const hasSession = Boolean(extractSupabaseAuthToken(request));

  if (!isPublic && !hasSession) {
    if (url.pathname.startsWith("/api/")) {
      return applySecurityHeaders(NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }));
    }
    url.pathname = "/login";
    return applySecurityHeaders(NextResponse.redirect(url));
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
