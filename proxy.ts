import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = new Set(["/login", "/auth/signin", "/auth/signup", "/auth/forgot-password", "/auth/reset-password", "/security/verify"]);
const PUBLIC_API_PATHS = new Set(["/api/auth/signin", "/api/auth/session", "/api/auth/onboard", "/api/auth/security-status", "/api/auth/security-verify"]);

const SECURITY_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Security-Policy":
    "object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-DNS-Prefetch-Control": "off",
  "X-Download-Options": "noopen",
  "X-Frame-Options": "DENY",
  "X-Permitted-Cross-Domain-Policies": "none",
} as const;

function applySecurityHeaders(response: NextResponse, request: NextRequest) {
  const host = request.headers.get("host") || "";
  const hostname = host.split(":")[0].toLowerCase();
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";

  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(name, value);
  }

  if (!isLocalhost && process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  return response;
}

function base64Url(bytes: ArrayBuffer) {
  const array = new Uint8Array(bytes);
  let binary = "";
  array.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hasVerifiedSecuritySession(request: NextRequest) {
  const secret = process.env.AUREX_SECURITY_SESSION_SECRET;
  const cookie = request.cookies.get("aurex_security_verified")?.value;
  if (!secret || !cookie) return false;

  const [payload, signature] = cookie.split(".");
  if (!payload || !signature) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const expected = base64Url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
  if (expected.length !== signature.length) return false;

  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  }
  if (mismatch) return false;

  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (payload.length % 4)) % 4));
    const value = JSON.parse(json) as { exp?: unknown };
    return typeof value.exp === "number" && value.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();

  if (url.pathname === "/") {
    url.pathname = await hasVerifiedSecuritySession(request)
      ? "/dashboard"
      : request.cookies.get("sb_logged_in")?.value === "1"
        ? "/security/verify"
        : "/login";
    return applySecurityHeaders(NextResponse.redirect(url), request);
  }

  const isPublic = PUBLIC_PATHS.has(url.pathname) || PUBLIC_API_PATHS.has(url.pathname);
  const hasSession = await hasVerifiedSecuritySession(request);

  if (!isPublic && !hasSession) {
    if (url.pathname.startsWith("/api/")) {
      return applySecurityHeaders(
        NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }),
        request
      );
    }
    url.pathname = "/login";
    return applySecurityHeaders(NextResponse.redirect(url), request);
  }

  return applySecurityHeaders(NextResponse.next(), request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
