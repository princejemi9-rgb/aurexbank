import { NextRequest, NextResponse } from "next/server";
import { approvedPersonalAdmin, requestUser, serviceClient } from "../../../../src/lib/server/tenantAccess";

async function context(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const db = serviceClient(); const user = await requestUser(token);
  if (!db || !user) return null;
  const admin = await approvedPersonalAdmin(db, user.id);
  return admin?.status === "approved" && admin.permissions?.manage_support === true ? { db, user } : null;
}

async function assigned(contextValue: NonNullable<Awaited<ReturnType<typeof context>>>, customerId: string) {
  const { data } = await contextValue.db.from("customer_personal_admin_assignments").select("customer_id").eq("personal_admin_id", contextValue.user.id).eq("customer_id", customerId).maybeSingle();
  return Boolean(data);
}

export async function GET(request: NextRequest) {
  const current = await context(request); if (!current) return NextResponse.json({ ok: false, error: "Support-management permission required" }, { status: 403 });
  const conversationId = request.nextUrl.searchParams.get("conversationId") || "";
  if (conversationId) {
    const { data: conversation } = await current.db.from("support_conversations").select("id,customer_id,subject,status,last_message_at,customer_language").eq("id", conversationId).maybeSingle();
    if (!conversation || !await assigned(current, conversation.customer_id)) return NextResponse.json({ ok: false, error: "Conversation not found" }, { status: 404 });
    const { data, error } = await current.db.from("support_messages").select("id,conversation_id,sender_id,sender_role,original_text,original_language,created_at,support_message_translations(*),support_attachments(*)").eq("conversation_id", conversationId).order("created_at");
    return error ? NextResponse.json({ ok: false, error: error.message }, { status: 500 }) : NextResponse.json({ ok: true, conversation, messages: data || [] });
  }
  const { data: assignments, error: assignmentError } = await current.db.from("customer_personal_admin_assignments").select("customer_id").eq("personal_admin_id", current.user.id);
  if (assignmentError) return NextResponse.json({ ok: false, error: assignmentError.message }, { status: 500 });
  const ids = (assignments || []).map(row => row.customer_id); if (!ids.length) return NextResponse.json({ ok: true, conversations: [] });
  const { data, error } = await current.db.from("support_conversations").select("id,customer_id,subject,status,last_message_at,customer_language").in("customer_id", ids).order("last_message_at", { ascending: false }).limit(100);
  return error ? NextResponse.json({ ok: false, error: error.message }, { status: 500 }) : NextResponse.json({ ok: true, conversations: data || [] });
}

export async function POST(request: NextRequest) {
  const current = await context(request); if (!current) return NextResponse.json({ ok: false, error: "Support-management permission required" }, { status: 403 });
  const body = await request.json().catch(() => null) as { conversationId?: unknown; message?: unknown } | null;
  const conversationId = typeof body?.conversationId === "string" ? body.conversationId : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!conversationId || !message || message.length > 5000) return NextResponse.json({ ok: false, error: "A conversation and a message up to 5,000 characters are required" }, { status: 400 });
  const { data: conversation } = await current.db.from("support_conversations").select("id,customer_id,customer_language").eq("id", conversationId).maybeSingle();
  if (!conversation || !await assigned(current, conversation.customer_id)) return NextResponse.json({ ok: false, error: "Conversation not found" }, { status: 404 });
  const { data, error } = await current.db.from("support_messages").insert({ conversation_id: conversationId, sender_id: current.user.id, sender_role: "admin", original_text: message, original_language: conversation.customer_language }).select("id,conversation_id,sender_role,original_text,original_language,created_at").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  await current.db.from("support_conversations").update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString(), status: "pending" }).eq("id", conversationId);
  await current.db.from("personal_admin_audit_log").insert({ actor_id: current.user.id, personal_admin_id: current.user.id, target_user_id: conversation.customer_id, action: "support_reply_sent", metadata: { conversation_id: conversationId, message_id: data.id } });
  return NextResponse.json({ ok: true, message: data });
}
