import { NextRequest, NextResponse } from "next/server";
import { approvedPersonalAdmin, requestUser, serviceClient } from "../../../../src/lib/server/tenantAccess";

async function context(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const db = serviceClient(); const user = await requestUser(token);
  if (!db || !user) return null;
  const admin = await approvedPersonalAdmin(db, user.id);
  return admin?.status === "approved" && admin.permissions?.manage_customers === true ? { db, user } : null;
}

export async function GET(request: NextRequest) {
  const current = await context(request);
  if (!current) return NextResponse.json({ ok: false, error: "Customer-management permission required" }, { status: 403 });
  const { data, error } = await current.db.from("personal_admin_transaction_requests")
    .select("id,customer_id,request_type,amount,currency,description,status,review_note,reviewed_at,created_at")
    .eq("personal_admin_id", current.user.id).order("created_at", { ascending: false }).limit(100);
  return error ? NextResponse.json({ ok: false, error: error.message }, { status: 500 }) : NextResponse.json({ ok: true, requests: data || [] });
}

export async function PATCH(request: NextRequest) {
  const current = await context(request);
  if (!current) return NextResponse.json({ ok: false, error: "Customer-management permission required" }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const requestId = typeof body?.requestId === "string" ? body.requestId : "";
  const status = typeof body?.status === "string" ? body.status : "";
  const reviewNote = typeof body?.reviewNote === "string" ? body.reviewNote : "";
  const { data, error } = await current.db.rpc("review_personal_admin_transaction_request", {
    p_personal_admin_id: current.user.id, p_request_id: requestId, p_status: status, p_review_note: reviewNote,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, request: data });
}
