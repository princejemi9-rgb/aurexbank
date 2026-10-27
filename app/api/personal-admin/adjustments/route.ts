import { NextRequest, NextResponse } from "next/server";
import { approvedPersonalAdmin, requestUser, serviceClient } from "../../../../src/lib/server/tenantAccess";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const db = serviceClient(); const user = await requestUser(accessToken);
  if (!db || !user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const admin = await approvedPersonalAdmin(db, user.id);
  if (admin?.status !== "approved" || admin.permissions?.manage_financial_adjustments !== true) return NextResponse.json({ ok: false, error: "Financial adjustment permission required" }, { status: 403 });
  const body = await request.json().catch(() => null) as { customerId?: unknown; idempotencyKey?: unknown; amount?: unknown; currency?: unknown; reason?: unknown } | null;
  const customerId = typeof body?.customerId === "string" ? body.customerId : "";
  const idempotencyKey = typeof body?.idempotencyKey === "string" ? body.idempotencyKey : "";
  const amount = typeof body?.amount === "number" ? body.amount : Number(body?.amount);
  const currency = typeof body?.currency === "string" ? body.currency.trim().toUpperCase() : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!UUID.test(customerId) || !UUID.test(idempotencyKey) || !Number.isFinite(amount) || !/^[A-Z]{3}$/.test(currency) || reason.length < 3 || reason.length > 500) return NextResponse.json({ ok: false, error: "Invalid adjustment request" }, { status: 400 });
  const { data, error } = await db.rpc("apply_personal_admin_adjustment", { p_personal_admin_id: user.id, p_customer_id: customerId, p_idempotency_key: idempotencyKey, p_amount: amount, p_currency: currency, p_reason: reason });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: error.code === "42501" ? 403 : 400 });
  return NextResponse.json({ ok: true, adjustment: data });
}
