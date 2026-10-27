import { NextRequest, NextResponse } from "next/server";
import { approvedPersonalAdmin, requestUser, serviceClient } from "../../../../src/lib/server/tenantAccess";

export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const db = serviceClient(); const user = await requestUser(token);
  if (!db || !user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const admin = await approvedPersonalAdmin(db, user.id);
  if (admin?.status !== "approved" || admin.permissions?.manage_customers !== true) return NextResponse.json({ ok: false, error: "Customer-management permission required" }, { status: 403 });
  const { data: assignments, error: assignmentError } = await db.from("customer_personal_admin_assignments").select("customer_id").eq("personal_admin_id", user.id);
  if (assignmentError) return NextResponse.json({ ok: false, error: assignmentError.message }, { status: 500 });
  const ids = (assignments || []).map(row => row.customer_id);
  if (!ids.length) return NextResponse.json({ ok: true, notifications: [] });
  const users = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) return NextResponse.json({ ok: false, error: users.error.message }, { status: 500 });
  const emails = users.data.users.filter(item => ids.includes(item.id)).map(item => item.email).filter((email): email is string => Boolean(email));
  if (!emails.length) return NextResponse.json({ ok: true, notifications: [] });
  const { data, error } = await db.from("notifications").select("id,username,message,created_at").in("username", emails).order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, notifications: data || [] });
}
