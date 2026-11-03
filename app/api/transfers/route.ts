import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readSecuritySession, SECURITY_SESSION_COOKIE } from "../../../src/lib/server/securitySession";

type Body = { transferType?: unknown; challengeId?: unknown; reference?: unknown };
const token = (request: NextRequest) => request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""; const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""; const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY || "";
  if (!url || !anon) return NextResponse.json({ ok: false, error: "Transfer service is unavailable." }, { status: 503 });
  const accessToken = token(request); const auth = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } }); const { data: { user }, error: authError } = await auth.auth.getUser(accessToken);
  if (authError || !user) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  const securitySession = readSecuritySession(request.cookies.get(SECURITY_SESSION_COOKIE)?.value);
  if (!securitySession || securitySession.userId !== user.id) return NextResponse.json({ ok: false, error: "Re-enter your security passcode to authorize this transfer." }, { status: 403 });
  const body = await request.json().catch(() => null) as Body | null;
  if (!body) return NextResponse.json({ ok: false, error: "Missing transfer details." }, { status: 400 });
  if (!serviceKey) return NextResponse.json({ ok: false, error: "Transfer service is unavailable." }, { status: 503 });
  const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const transferType = typeof body?.transferType === "string" ? body.transferType : "";
  const challengeId = typeof body?.challengeId === "string" ? body.challengeId : "";
  const reference = typeof body?.reference === "string" ? body.reference : "";
  if (transferType !== "internal") return NextResponse.json({ ok: false, error: "External transfers require a configured settlement provider and cannot be marked complete here." }, { status: 409 });
  if (!challengeId || !reference) return NextResponse.json({ ok: false, error: "A verified transfer authorization is required." }, { status: 400 });
  const { data: challenge } = await db.from("transfer_authorization_challenges").select("verified_at").eq("id", challengeId).eq("sender_id", user.id).maybeSingle();
  if (!challenge?.verified_at || (securitySession.iat || 0) < Math.floor(Date.parse(challenge.verified_at) / 1000)) return NextResponse.json({ ok: false, error: "Re-enter your security passcode after OTP verification to finalize this transfer." }, { status: 403 });
  const { data, error } = await db.rpc("process_verified_virtual_transfer", { p_sender_id: user.id, p_challenge_id: challengeId, p_idempotency_key: reference });
  if (error || !data) return NextResponse.json({ ok: false, error: error?.message || "Transfer processing failed." }, { status: 400 });
  const transfer = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({ ok: true, transactionId: transfer.id, transferAmount: Number(transfer.amount), totalDebit: Number(transfer.amount), receipt: { id: transfer.id, status: transfer.status, completedAt: transfer.completed_at } }, { headers: { "Cache-Control": "no-store" } });
}
