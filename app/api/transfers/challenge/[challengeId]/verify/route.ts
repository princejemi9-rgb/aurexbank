import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requestUser, serviceClient } from "../../../../../../../src/lib/server/tenantAccess";

export async function POST(request: NextRequest, context: { params: Promise<{ challengeId: string }> }) {
  const db = serviceClient(); const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || ""; const user = await requestUser(token);
  if (!db || !user) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  const { challengeId } = await context.params; const body = await request.json().catch(() => null) as { code?: unknown } | null; const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!/^\d{6}$/.test(code)) return NextResponse.json({ ok: false, error: "Enter the six-digit OTP." }, { status: 400 });
  const { data: challenge } = await db.from("transfer_authorization_challenges").select("code_salt").eq("id", challengeId).eq("sender_id", user.id).maybeSingle();
  if (!challenge) return NextResponse.json({ ok: false, error: "Transfer authorization was not found." }, { status: 404 });
  const codeHash = createHash("sha256").update(`${challenge.code_salt}:${code}`).digest("hex");
  const { data, error } = await db.rpc("verify_transfer_authorization_challenge", { p_sender_id: user.id, p_challenge_id: challengeId, p_code_hash: codeHash });
  return error ? NextResponse.json({ ok: false, error: error.message }, { status: 400 }) : NextResponse.json({ ok: true, challenge: data }, { headers: { "Cache-Control": "no-store" } });
}
