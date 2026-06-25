// Backwards-compat shim (if needed later). Kept intentionally empty for now.
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ ok: false, error: "Use /api/profile/upload-avatar" }, { status: 400 });
}

