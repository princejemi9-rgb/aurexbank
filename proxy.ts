import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = new Set(["/login", "/auth/signin", "/auth/signup", "/auth/forgot-password", "/security/verify"]);
const PUBLIC_API_PATHS = new Set(["/api/auth/signin", "/api/auth/session", "/api/auth/onboard", "/api/auth/security-status", "/api/auth/security-verify"]);

function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
}

function getSupabaseAnonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
}

function extractSupabaseAuthToken(request: NextRequest) {
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

  const user = (await response.json().catch(() => null)) as { email?: string | null } | null;
  const email = typeof user?.email === "string" ? user.email.trim().toLowerCase() : "";
  if (!email) return false;

  const allowedAdmins = (process.env.AUREX_ADMIN_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return allowedAdmins.includes(email);
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

function base64Url(bytes: ArrayBuffer) {
  const array = new Uint8Array(bytes);
  let binary = "";
  array.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hasVerifiedSecuritySession(request: NextRequest) {
  const secret = process.env.AUREX_SECURITY_SESSION_SECRET;
  const cookie = request.cookies.get("aurex_security_verified")?.value;
  if (!secret || !cookie) return false;
  const [payload, signature] = cookie.split(".");
  if (!payload || !signature) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = base64Url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) mismatch |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  if (mismatch) return false;
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - payload.length % 4) % 4));
    return (JSON.parse(json) as { exp?: unknown }).exp && Number((JSON.parse(json) as { exp: unknown }).exp) > Math.floor(Date.now() / 1000);
  } catch { return false; }
}

export async function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();

  if (await isAdminRequest(request)) {
    return applySecurityHeaders(NextResponse.next());
  }

  if (url.pathname === "/") {
    url.pathname = request.cookies.get("sb_logged_in")?.value === "1"
      ? "/security/verify"
      : "/login";
    return applySecurityHeaders(NextResponse.redirect(url));
  }

  const isPublic = PUBLIC_PATHS.has(url.pathname) || PUBLIC_API_PATHS.has(url.pathname);
  if (!isPublic && !(await hasVerifiedSecuritySession(request))) {
    if (url.pathname.startsWith("/api/")) {
      return applySecurityHeaders(NextResponse.json({ ok: false, error: "Security verification required" }, { status: 403 }));
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
