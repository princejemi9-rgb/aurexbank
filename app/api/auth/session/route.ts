import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body?.action;

    const res = NextResponse.json({ ok: true });

    if (action === "set") {
      res.cookies.set("sb_logged_in", "1", {
        path: "/",
        httpOnly: true,
        maxAge: 60 * 60 * 24, // 1 day
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
      });
      return res;
    }

    if (action === "clear") {
      res.cookies.set("sb_logged_in", "", {
        path: "/",
        httpOnly: true,
        maxAge: 0,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
      });
      return res;
    }

    return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
