import { createHmac, timingSafeEqual } from "crypto";
import type { NextResponse } from "next/server";

export const SECURITY_SESSION_COOKIE = "aurex_security_verified";
const MAX_AGE_SECONDS = 60 * 60 * 8;

type SecuritySession = { userId: string; revision: string; exp: number };

function secret() {
  return process.env.AUREX_SECURITY_SESSION_SECRET || "";
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSecuritySession(userId: string, revision: string) {
  if (!secret()) throw new Error("Missing AUREX_SECURITY_SESSION_SECRET");

  const payload = Buffer.from(
    JSON.stringify({
      userId,
      revision,
      exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS,
    })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readSecuritySession(cookie: string | undefined): SecuritySession | null {
  if (!cookie || !secret()) return null;

  const [payload, signature] = cookie.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const received = Buffer.from(signature);
  const valid =
    received.length === Buffer.from(expected).length &&
    timingSafeEqual(received, Buffer.from(expected));
  if (!valid) return null;

  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SecuritySession;
    return value.exp > Math.floor(Date.now() / 1000) ? value : null;
  } catch {
    return null;
  }
}

function cookieOptions(maxAge: number) {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge,
  };
}

export function setSecuritySession(response: NextResponse, value: string) {
  response.cookies.set(SECURITY_SESSION_COOKIE, value, cookieOptions(MAX_AGE_SECONDS));
}

export function clearSecuritySession(response: NextResponse) {
  response.cookies.set(SECURITY_SESSION_COOKIE, "", cookieOptions(0));
}
