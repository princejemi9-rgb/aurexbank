import { createHash, randomBytes, randomInt } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { approvedPersonalAdmin, requestUser, serviceClient } from "../../../../../../src/lib/server/tenantAccess";

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
