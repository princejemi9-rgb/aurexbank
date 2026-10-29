import { NextRequest, NextResponse } from "next/server";
import { approvedPersonalAdmin, requestUser, serviceClient } from "../../../../../../src/lib/server/tenantAccess";

async function access(request: NextRequest, customerId: string) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || ""; const db = serviceClient(); const user = await requestUser(token);
  if (!db || !user) return null; const admin = await approvedPersonalAdmin(db, user.id);
  if (admin?.status !== "approved" || admin.permissions?.manage_customers !== true) return null;
  const { data } = await db.from("customer_personal_admin_assignments").select("customer_id").eq("personal_admin_id", user.id).eq("customer_id", customerId).maybeSingle();
  return data ? { db, user } : null;
}

export async function GET(request: NextRequest, context: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await context.params; const current = await access(request, customerId); if (!current) return NextResponse.json({ ok: false, error: "Customer-management permission required" }, { status: 403 });
  const [notes, verification, documents] = await Promise.all([
    current.db.from("personal_admin_customer_notes").select("id,note,created_at").eq("customer_id", customerId).eq("personal_admin_id", current.user.id).order("created_at", { ascending: false }).limit(100),
    current.db.from("personal_admin_customer_verifications").select("status,review_note,reviewed_at,updated_at").eq("customer_id", customerId).eq("personal_admin_id", current.user.id).maybeSingle(),
    current.db.from("personal_admin_customer_documents").select("id,document_type,file_name,content_type,byte_size,created_at").eq("customer_id", customerId).eq("personal_admin_id", current.user.id).order("created_at", { ascending: false }).limit(100),
  ]);
  const error = notes.error || verification.error || documents.error; if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, notes: notes.data || [], verification: verification.data || { status: "pending", review_note: "" }, documents: documents.data || [] });
}

export async function POST(request: NextRequest, context: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await context.params; const current = await access(request, customerId); if (!current) return NextResponse.json({ ok: false, error: "Customer-management permission required" }, { status: 403 });
  const body = await request.json().catch(() => null) as { action?: unknown; note?: unknown; status?: unknown; reviewNote?: unknown } | null;
  if (body?.action === "note" && typeof body.note === "string") { const { data, error } = await current.db.rpc("add_personal_admin_customer_note", { p_personal_admin_id: current.user.id, p_customer_id: customerId, p_note: body.note }); return error ? NextResponse.json({ ok: false, error: error.message }, { status: 400 }) : NextResponse.json({ ok: true, note: data }); }
  if (body?.action === "verification" && typeof body.status === "string") { const { data, error } = await current.db.rpc("update_personal_admin_customer_verification", { p_personal_admin_id: current.user.id, p_customer_id: customerId, p_status: body.status, p_review_note: typeof body.reviewNote === "string" ? body.reviewNote : "" }); return error ? NextResponse.json({ ok: false, error: error.message }, { status: 400 }) : NextResponse.json({ ok: true, verification: data }); }
  return NextResponse.json({ ok: false, error: "Choose a valid record action" }, { status: 400 });
}
