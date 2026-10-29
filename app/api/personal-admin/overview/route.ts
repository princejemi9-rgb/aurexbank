import { NextRequest, NextResponse } from "next/server";
import { approvedPersonalAdmin, requestUser, serviceClient } from "../../../../src/lib/server/tenantAccess";

export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const db = serviceClient(); const user = await requestUser(token);
  if (!db || !user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const admin = await approvedPersonalAdmin(db, user.id);
  if (admin?.status !== "approved") return NextResponse.json({ ok: false, error: "Active Personal Admin access required" }, { status: 403 });
  const { data: assignments, error } = await db.from("customer_personal_admin_assignments").select("customer_id").eq("personal_admin_id", user.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const ids = (assignments || []).map(item => item.customer_id);
  if (!ids.length) return NextResponse.json({ ok: true, metrics: { assignedCustomers: 0, activeCustomers: 0, suspendedCustomers: 0, portfolioBalance: 0, pendingRequests: 0, openSupport: 0, adjustments: 0 }, activity: [] });
  const users = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) return NextResponse.json({ ok: false, error: users.error.message }, { status: 500 });
  const emails = users.data.users.filter(item => ids.includes(item.id)).map(item => item.email).filter((email): email is string => Boolean(email));
  const [profiles, requests, support, adjustments, activity] = await Promise.all([
    emails.length ? db.from("profiles").select("balance,account_status").in("username", emails) : Promise.resolve({ data: [], error: null }),
    db.from("personal_admin_transaction_requests").select("id", { count: "exact", head: true }).eq("personal_admin_id", user.id).eq("status", "pending"),
    db.from("support_conversations").select("id", { count: "exact", head: true }).in("customer_id", ids).in("status", ["open", "pending"]),
    db.from("personal_admin_financial_adjustments").select("id", { count: "exact", head: true }).eq("personal_admin_id", user.id),
    db.from("personal_admin_customer_activity").select("id,customer_id,action,created_at").eq("personal_admin_id", user.id).order("created_at", { ascending: false }).limit(12),
  ]);
  const queryError = profiles.error || requests.error || support.error || adjustments.error || activity.error;
  if (queryError) return NextResponse.json({ ok: false, error: queryError.message }, { status: 500 });
  const rows = profiles.data || [];
  return NextResponse.json({ ok: true, metrics: { assignedCustomers: ids.length, activeCustomers: rows.filter(row => row.account_status === "active").length, suspendedCustomers: rows.filter(row => row.account_status === "suspended").length, portfolioBalance: rows.reduce((total, row) => total + Number(row.balance || 0), 0), pendingRequests: requests.count || 0, openSupport: support.count || 0, adjustments: adjustments.count || 0 }, activity: activity.data || [] });
}
