import { NextRequest, NextResponse } from "next/server";
import { approvedPersonalAdmin, requestUser, serviceClient } from "../../../../src/lib/server/tenantAccess";

export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const db = serviceClient(); const user = await requestUser(token);
  if (!db || !user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const admin = await approvedPersonalAdmin(db, user.id);
  if (admin?.status !== "approved" || admin.permissions?.manage_reports !== true) return NextResponse.json({ ok: false, error: "Report permission required" }, { status: 403 });
  const from = request.nextUrl.searchParams.get("from") || ""; const to = request.nextUrl.searchParams.get("to") || ""; const action = request.nextUrl.searchParams.get("action") || "";
  if ((from && Number.isNaN(Date.parse(from))) || (to && Number.isNaN(Date.parse(to))) || (from && to && from > to) || action.length > 120) return NextResponse.json({ ok: false, error: "Invalid report filters." }, { status: 400 });
  let auditQuery = db.from("personal_admin_audit_log").select("id,action,target_user_id,metadata,created_at").eq("personal_admin_id", user.id).order("created_at", { ascending: false }).limit(500);
  if (from) auditQuery = auditQuery.gte("created_at", `${from}T00:00:00.000Z`); if (to) auditQuery = auditQuery.lte("created_at", `${to}T23:59:59.999Z`); if (action) auditQuery = auditQuery.eq("action", action);
  const [assignments, audit, adjustments] = await Promise.all([
    db.from("customer_personal_admin_assignments").select("customer_id").eq("personal_admin_id", user.id),
    auditQuery,
    db.from("personal_admin_financial_adjustments").select("id,customer_id,amount,currency,reason,created_at").eq("personal_admin_id", user.id).order("created_at", { ascending: false }).limit(100),
  ]);
  if (assignments.error || audit.error || adjustments.error) return NextResponse.json({ ok: false, error: "Portfolio report is temporarily unavailable." }, { status: 503 });
  const ids = (assignments.data || []).map(row => row.customer_id);
  const { data: profiles, error: profileError } = ids.length ? await db.from("profiles").select("id,balance,account_status").in("id", ids) : { data: [], error: null };
  if (profileError) return NextResponse.json({ ok: false, error: "Portfolio report is temporarily unavailable." }, { status: 503 });
  const portfolio = (profiles || []).reduce((sum, profile) => sum + Number(profile.balance || 0), 0);
  return NextResponse.json({ ok: true, metrics: { assignedCustomers: ids.length, activeCustomers: (profiles || []).filter(row => row.account_status === "active").length, portfolioBalance: portfolio, adjustments: (adjustments.data || []).length }, audit: audit.data || [] });
}
