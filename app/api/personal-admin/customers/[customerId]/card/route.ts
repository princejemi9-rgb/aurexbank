import { NextRequest, NextResponse } from "next/server";
import { approvedPersonalAdmin, requestUser, serviceClient } from "../../../../../../src/lib/server/tenantAccess";

export async function POST(request: NextRequest, context: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await context.params;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const db = serviceClient(); const user = await requestUser(token);
  if (!db || !user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const admin = await approvedPersonalAdmin(db, user.id);
  if (admin?.status !== "approved" || admin.permissions?.manage_customers !== true) return NextResponse.json({ ok: false, error: "Customer-management permission required" }, { status: 403 });
  const { data: assignment } = await db.from("customer_personal_admin_assignments").select("customer_id").eq("customer_id", customerId).eq("personal_admin_id", user.id).maybeSingle();
  if (!assignment) return NextResponse.json({ ok: false, error: "Customer is outside your portfolio" }, { status: 403 });
  const body = await request.json().catch(() => null) as { action?: unknown } | null;
  const action = typeof body?.action === "string" ? body.action : "";
  if (!["issue", "freeze", "unfreeze", "replace"].includes(action)) return NextResponse.json({ ok: false, error: "Choose a valid virtual-card action." }, { status: 400 });
  const { data: result, error: targetError } = await db.auth.admin.getUserById(customerId);
  if (targetError || !result.user) return NextResponse.json({ ok: false, error: "Customer not found" }, { status: 404 });
  const metadata = result.user.user_metadata && typeof result.user.user_metadata === "object" ? result.user.user_metadata as Record<string, unknown> : {};
  const currentVersion = Number(metadata.card_display_version || 0);
  const patch: Record<string, unknown> = { ...metadata, card_display_updated_at: new Date().toISOString() };
  if (action === "issue") { patch.card_status = "active"; patch.card_issued_at = new Date().toISOString(); patch.card_display_version = Math.max(1, currentVersion + 1); }
  if (action === "freeze") patch.card_status = "frozen";
  if (action === "unfreeze") patch.card_status = "active";
  if (action === "replace") { patch.card_status = "active"; patch.card_replaced_at = new Date().toISOString(); patch.card_display_version = Math.max(1, currentVersion + 1); }
  const { error: updateError } = await db.auth.admin.updateUserById(customerId, { user_metadata: patch });
  if (updateError) return NextResponse.json({ ok: false, error: "Unable to update virtual-card controls." }, { status: 503 });
  await Promise.all([
    db.from("personal_admin_customer_activity").insert({ personal_admin_id: user.id, customer_id: customerId, actor_id: user.id, action: `virtual_card_${action}`, metadata: { demo_card: true, version: patch.card_display_version || currentVersion } }),
    db.from("personal_admin_audit_log").insert({ actor_id: user.id, personal_admin_id: user.id, target_user_id: customerId, action: `personal_admin_virtual_card_${action}`, metadata: { demo_card: true, version: patch.card_display_version || currentVersion } }),
  ]);
  return NextResponse.json({ ok: true, cardStatus: patch.card_status, cardVersion: patch.card_display_version || currentVersion });
}
