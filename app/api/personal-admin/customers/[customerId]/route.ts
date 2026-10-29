import { NextRequest, NextResponse } from "next/server";
import { approvedPersonalAdmin, requestUser, serviceClient } from "../../../../../src/lib/server/tenantAccess";

async function access(request: NextRequest, customerId: string) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const db = serviceClient(); const user = await requestUser(token);
  if (!db || !user) return { error: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  const admin = await approvedPersonalAdmin(db, user.id);
  if (admin?.status !== "approved" || admin.permissions?.manage_customers !== true) return { error: NextResponse.json({ ok: false, error: "Customer-management permission required" }, { status: 403 }) };
  const { data: assignment } = await db.from("customer_personal_admin_assignments").select("customer_id").eq("customer_id", customerId).eq("personal_admin_id", user.id).maybeSingle();
  if (!assignment) return { error: NextResponse.json({ ok: false, error: "Customer is outside your portfolio" }, { status: 403 }) };
  return { db, user };
}

export async function GET(request: NextRequest, context: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await context.params; const result = await access(request, customerId); if (result.error) return result.error;
  const [details, profile, activity, auth] = await Promise.all([
    result.db!.from("personal_admin_customer_details").select("full_name,phone,country,account_type,address,avatar_url").eq("customer_id", customerId).maybeSingle(),
    result.db!.from("profiles").select("balance,currency,account_status").eq("id", customerId).maybeSingle(),
    result.db!.from("personal_admin_customer_activity").select("id,action,metadata,created_at").eq("customer_id", customerId).order("created_at", { ascending: false }).limit(50),
    result.db!.auth.admin.getUserById(customerId),
  ]);
  if (!auth.data.user || !details.data || !profile.data) return NextResponse.json({ ok: false, error: "Customer not found" }, { status: 404 });
  const metadata = auth.data.user.user_metadata && typeof auth.data.user.user_metadata === "object"
    ? auth.data.user.user_metadata as Record<string, unknown>
    : {};
  return NextResponse.json({ ok: true, customer: {
    id: customerId, email: auth.data.user.email, ...details.data, ...profile.data,
    cardStatus: typeof metadata.card_status === "string" ? metadata.card_status : "not_issued",
    cardVersion: Number(metadata.card_display_version || 0),
  }, activity: activity.data || [] });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await context.params; const result = await access(request, customerId); if (result.error) return result.error;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const text = (key: string, max: number) => typeof body?.[key] === "string" ? body[key].trim().slice(0, max) : "";
  const fullName = text("fullName", 120), phone = text("phone", 40), country = text("country", 80), address = text("address", 500), accountType = text("accountType", 20).toLowerCase(), accountStatus = text("accountStatus", 20).toLowerCase();
  const target = await result.db!.auth.admin.getUserById(customerId); const metadata = target.data.user?.user_metadata || {};
  if (!target.data.user) return NextResponse.json({ ok: false, error: "Customer not found" }, { status: 404 });
  const [first_name, ...last] = fullName.split(/\s+/);
  const { error: authError } = await result.db!.auth.admin.updateUserById(customerId, { user_metadata: { ...metadata, full_name: fullName, first_name, last_name: last.join(" "), phone, country, account_type: accountType, account_status: accountStatus } });
  if (authError) return NextResponse.json({ ok: false, error: "Authentication profile sync failed; no lifecycle change was saved." }, { status: 503 });
  const { data, error } = await result.db!.rpc("update_personal_admin_customer_lifecycle", { p_personal_admin_id: result.user!.id, p_customer_id: customerId, p_full_name: fullName, p_phone: phone, p_country: country, p_account_type: accountType, p_address: address, p_account_status: accountStatus });
  if (error) {
    await result.db!.auth.admin.updateUserById(customerId, { user_metadata: metadata });
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, customer: data });
}
