import { createHash, randomBytes, randomInt } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { approvedPersonalAdmin, requestUser, serviceClient } from "../../../../../../src/lib/server/tenantAccess";

async function context(request: NextRequest, customerId: string) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const db = serviceClient(); const user = await requestUser(token);
  if (!db || !user) return null;
  const admin = await approvedPersonalAdmin(db, user.id);
  if (admin?.status !== "approved" || (admin.permissions?.manage_otp_challenges !== true && admin.permissions?.manage_customers !== true)) return null;
  const { data: assignment } = await db.from("customer_personal_admin_assignments").select("customer_id").eq("customer_id", customerId).eq("personal_admin_id", user.id).maybeSingle();
  return assignment ? { db, user } : null;
}

export async function GET(request: NextRequest, contextValue: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await contextValue.params; const current = await context(request, customerId);
  if (!current) return NextResponse.json({ ok: false, error: "OTP-challenge permission and assigned customer access are required" }, { status: 403 });
  const { data, error } = await current.db.from("personal_admin_otp_challenges").select("id,purpose,status,attempts,max_attempts,expires_at,created_at,verified_at").eq("customer_id", customerId).order("created_at", { ascending: false }).limit(25);
  return error ? NextResponse.json({ ok: false, error: error.message }, { status: 500 }) : NextResponse.json({ ok: true, challenges: data || [] });
}

export async function POST(request: NextRequest, context: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await context.params;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const db = serviceClient(); const user = await requestUser(token);
  if (!db || !user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const admin = await approvedPersonalAdmin(db, user.id);
  if (admin?.status !== "approved" || admin.permissions?.manage_customers !== true) return NextResponse.json({ ok: false, error: "Customer-management permission required" }, { status: 403 });
  const body = await request.json().catch(() => null) as { purpose?: unknown } | null;
  const purpose = typeof body?.purpose === "string" ? body.purpose : "";
  const code = String(randomInt(100000, 1_000_000)); const salt = randomBytes(24).toString("hex"); const hash = createHash("sha256").update(`${salt}:${code}`).digest("hex");
  const { data, error } = await db.rpc("issue_personal_admin_otp", { p_personal_admin_id: user.id, p_customer_id: customerId, p_purpose: purpose, p_code_salt: salt, p_code_hash: hash });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  // A Personal Admin may administer the challenge, never see or select its secret.
  // Delivery is delegated to the configured verified-channel provider.
  const endpoint = process.env.AUREX_OTP_DELIVERY_WEBHOOK;
  const secret = process.env.AUREX_OTP_DELIVERY_WEBHOOK_SECRET;
  if (!endpoint || !secret) {
    await db.from("personal_admin_otp_challenges").update({ status: "cancelled" }).eq("id", data.id);
    return NextResponse.json({ ok: false, error: "OTP delivery is not configured." }, { status: 503 });
  }
  const delivery = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` }, body: JSON.stringify({ purpose, customerId, challengeId: data.id, code, expiresAt: data.expires_at }), cache: "no-store" }).catch(() => null);
  if (!delivery?.ok) { await db.from("personal_admin_otp_challenges").update({ status: "cancelled" }).eq("id", data.id); return NextResponse.json({ ok: false, error: "OTP delivery failed." }, { status: 503 }); }
  return NextResponse.json({ ok: true, challengeId: data.id, expiresAt: data.expires_at, delivery: "verified_channel" }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: NextRequest, contextValue: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await contextValue.params; const current = await context(request, customerId);
  if (!current) return NextResponse.json({ ok: false, error: "OTP-challenge permission and assigned customer access are required" }, { status: 403 });
  const challengeId = request.nextUrl.searchParams.get("challengeId") || "";
  if (!challengeId) return NextResponse.json({ ok: false, error: "Select an OTP challenge to revoke." }, { status: 400 });
  const { data, error } = await current.db.from("personal_admin_otp_challenges").update({ status: "cancelled" }).eq("id", challengeId).eq("customer_id", customerId).eq("status", "open").select("id").maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, error: "Only an active assigned-customer OTP challenge can be revoked." }, { status: 409 });
  await current.db.from("personal_admin_audit_log").insert({ actor_id: current.user.id, personal_admin_id: current.user.id, target_user_id: customerId, action: "personal_admin_otp_revoked", metadata: { challenge_id: challengeId } });
  return NextResponse.json({ ok: true });
}
