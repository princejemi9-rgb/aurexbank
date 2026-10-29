import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requestUser, serviceClient } from "../../../src/lib/server/tenantAccess";

export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || ""; const db = serviceClient(); const user = await requestUser(token);
  if (!db || !user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const { data, error } = await db.from("personal_admin_otp_challenges").select("id,purpose,status,attempts,max_attempts,expires_at,created_at").eq("customer_id", user.id).order("created_at", { ascending: false }).limit(10);
  return error ? NextResponse.json({ ok: false, error: error.message }, { status: 500 }) : NextResponse.json({ ok: true, challenges: data || [] });
}

export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || ""; const db = serviceClient(); const user = await requestUser(token);
  if (!db || !user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { challengeId?: unknown; code?: unknown } | null;
  const challengeId = typeof body?.challengeId === "string" ? body.challengeId : ""; const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!challengeId || !/^\d{6}$/.test(code)) return NextResponse.json({ ok: false, error: "Enter the six-digit OTP." }, { status: 400 });
  const { data: challenge } = await db.from("personal_admin_otp_challenges").select("code_salt").eq("id", challengeId).eq("customer_id", user.id).maybeSingle();
  if (!challenge) return NextResponse.json({ ok: false, error: "OTP challenge not found." }, { status: 404 });
  const codeHash = createHash("sha256").update(`${challenge.code_salt}:${code}`).digest("hex");
  const { data, error } = await db.rpc("verify_customer_personal_admin_otp", { p_customer_id: user.id, p_challenge_id: challengeId, p_code_hash: codeHash });
  return error ? NextResponse.json({ ok: false, error: error.message }, { status: 400 }) : NextResponse.json({ ok: true, challenge: data });
}
