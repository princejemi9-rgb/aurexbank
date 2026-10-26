import { NextRequest, NextResponse } from "next/server";
import { approvedPersonalAdmin, requestUser, serviceClient } from "../../../../src/lib/server/tenantAccess";

export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const db = serviceClient(); const user = await requestUser(token);
  if (!db || !user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const admin = await approvedPersonalAdmin(db, user.id);
  if (admin?.status !== "approved") return NextResponse.json({ ok: false, error: "Approved Personal Admin access required" }, { status: 403 });
  const { data: assignments, error } = await db.from("customer_personal_admin_assignments").select("customer_id,assigned_at,referral_code").eq("personal_admin_id", user.id).order("assigned_at", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const ids = (assignments || []).map(item => item.customer_id);
  if (!ids.length) return NextResponse.json({ ok: true, customers: [] });
  const { data: users, error: userError } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (userError) return NextResponse.json({ ok: false, error: userError.message }, { status: 500 });
  const byId = new Map(users.users.filter(item => ids.includes(item.id)).map(item => [item.id, item]));
  return NextResponse.json({ ok: true, customers: (assignments || []).map(item => { const customer = byId.get(item.customer_id); return { id: item.customer_id, email: customer?.email || "", fullName: String(customer?.user_metadata?.full_name || customer?.email || "Customer"), assignedAt: item.assigned_at, referralCode: item.referral_code }; }) });
}
