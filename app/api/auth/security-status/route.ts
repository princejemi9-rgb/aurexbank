import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const hasSession = Boolean(request.headers.get("authorization") || request.cookies.get("sb_logged_in"));
  return NextResponse.json({ ok: true, configured: false, verified: true, disabled: true, hasSession }, { status: 200 });
}
