import { NextRequest, NextResponse } from "next/server";
import { isSuperAdmin, requestUser, serviceClient } from "../../../../src/lib/server/tenantAccess";
import { normalizeBrandingConfig } from "../../../../src/lib/branding";

function token(request: NextRequest) { return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || ""; }
async function authorize(request: NextRequest) { const db = serviceClient(); const user = await requestUser(token(request)); return db && isSuperAdmin(user) ? { db, user } : null; }

export async function GET(request: NextRequest) {
  const context = await authorize(request); if (!context) return NextResponse.json({ ok: false, error: "Super Admin access required" }, { status: 403 });
  const requestedId = request.nextUrl.searchParams.get("personalAdminId");
  if (requestedId) {
    const { data, error } = await context.db.from("personal_admin_audit_log").select("id,action,target_user_id,metadata,created_at").eq("personal_admin_id", requestedId).order("created_at", { ascending: false }).limit(50);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, audit: data || [] });
  }
  const { data, error } = await context.db.from("personal_admin_profiles").select("user_id,full_name,email,phone,status,referral_code,permissions,created_at,last_login_at,personal_admin_branding(configuration),customer_personal_admin_assignments(count)").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, personalAdmins: data || [] });
}

export async function POST(request: NextRequest) {
  const context = await authorize(request); if (!context) return NextResponse.json({ ok: false, error: "Super Admin access required" }, { status: 403 });
  const body = await request.json().catch(() => null) as { action?: string; personalAdminId?: string; customerId?: string; branding?: unknown; permissions?: unknown } | null;
  const id = body?.personalAdminId || "";
  if (!id) return NextResponse.json({ ok: false, error: "Select a Personal Admin." }, { status: 400 });
  if (body?.action === "setStatus") {
    const status = (body as { status?: string }).status;
    if (!status || !["approved", "rejected", "suspended", "pending_approval"].includes(status)) return NextResponse.json({ ok: false, error: "Invalid status." }, { status: 400 });
    const patch = status === "approved" ? { status, approved_by: context.user!.id, approved_at: new Date().toISOString() } : { status };
    const { error } = await context.db.from("personal_admin_profiles").update(patch).eq("user_id", id); if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    await context.db.from("personal_admin_audit_log").insert({ actor_id: context.user!.id, personal_admin_id: id, action: `personal_admin_${status}` });
    return NextResponse.json({ ok: true });
  }
  if (body?.action === "assignCustomer") {
    if (!body.customerId) return NextResponse.json({ ok: false, error: "Select a customer." }, { status: 400 });
    const { data: admin } = await context.db.from("personal_admin_profiles").select("status,referral_code").eq("user_id", id).maybeSingle();
    if (!admin || admin.status !== "approved") return NextResponse.json({ ok: false, error: "Personal Admin must be approved." }, { status: 400 });
    const { error } = await context.db.from("customer_personal_admin_assignments").upsert({ customer_id: body.customerId, personal_admin_id: id, referral_code: admin.referral_code, assigned_by: context.user!.id, reassigned_at: new Date().toISOString() });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    await context.db.from("personal_admin_audit_log").insert({ actor_id: context.user!.id, personal_admin_id: id, target_user_id: body.customerId, action: "customer_assigned" });
    return NextResponse.json({ ok: true });
  }
  if (body?.action === "setBranding") {
    const config = normalizeBrandingConfig(body.branding);
    const { data: current } = await context.db.from("personal_admin_branding").select("version").eq("personal_admin_id", id).maybeSingle();
    const { error } = await context.db.from("personal_admin_branding").upsert({ personal_admin_id: id, configuration: config, version: (current?.version || 0) + 1, updated_by: context.user!.id, updated_at: new Date().toISOString() });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    await context.db.from("personal_admin_audit_log").insert({ actor_id: context.user!.id, personal_admin_id: id, action: "branding_published", metadata: { version: (current?.version || 0) + 1 } });
    return NextResponse.json({ ok: true, branding: config });
  }
  if (body?.action === "setPermissions") {
    const incoming = body.permissions && typeof body.permissions === "object" ? body.permissions as Record<string, unknown> : {};
    const permissions = { manage_customers: incoming.manage_customers === true, manage_support: incoming.manage_support === true, manage_reports: incoming.manage_reports === true };
    const { error } = await context.db.from("personal_admin_profiles").update({ permissions, updated_at: new Date().toISOString() }).eq("user_id", id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    await context.db.from("personal_admin_audit_log").insert({ actor_id: context.user!.id, personal_admin_id: id, action: "permissions_updated", metadata: permissions });
    return NextResponse.json({ ok: true, permissions });
  }
  return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
}
