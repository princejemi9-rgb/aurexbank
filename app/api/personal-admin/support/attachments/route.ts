import { NextRequest, NextResponse } from "next/server";
import { approvedPersonalAdmin, requestUser, serviceClient } from "../../../../../src/lib/server/tenantAccess";

const ALLOWED = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"], ["application/pdf", "pdf"]]);
const MAX_BYTES = 10 * 1024 * 1024;

async function context(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const db = serviceClient(); const user = await requestUser(token);
  if (!db || !user) return null;
  const admin = await approvedPersonalAdmin(db, user.id);
  return admin?.status === "approved" && admin.permissions?.manage_support === true ? { db, user } : null;
}

async function ownedMessage(current: NonNullable<Awaited<ReturnType<typeof context>>>, messageId: string) {
  const { data } = await current.db.from("support_messages").select("id,conversation_id,support_conversations!inner(customer_id)").eq("id", messageId).maybeSingle();
  const customerId = (data as { support_conversations?: { customer_id?: string } } | null)?.support_conversations?.customer_id;
  if (!customerId) return null;
  const { data: assignment } = await current.db.from("customer_personal_admin_assignments").select("customer_id").eq("personal_admin_id", current.user.id).eq("customer_id", customerId).maybeSingle();
  return assignment ? { customerId, messageId } : null;
}

export async function POST(request: NextRequest) {
  const current = await context(request); if (!current) return NextResponse.json({ ok: false, error: "Support-management permission required" }, { status: 403 });
  const form = await request.formData().catch(() => null); const messageId = typeof form?.get("messageId") === "string" ? String(form.get("messageId")) : ""; const file = form?.get("file");
  if (!messageId || !(file instanceof File) || !ALLOWED.has(file.type) || file.size < 1 || file.size > MAX_BYTES) return NextResponse.json({ ok: false, error: "Upload a JPG, PNG, WebP, or PDF up to 10 MB." }, { status: 400 });
  const message = await ownedMessage(current, messageId); if (!message) return NextResponse.json({ ok: false, error: "Message not found" }, { status: 404 });
  const extension = ALLOWED.get(file.type)!; const path = `${message.customerId}/${messageId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await current.db.storage.from("support-attachments").upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (uploadError) return NextResponse.json({ ok: false, error: uploadError.message }, { status: 503 });
  const { data, error } = await current.db.from("support_attachments").insert({ message_id: messageId, storage_path: path, file_name: file.name.slice(0, 200), content_type: file.type, byte_size: file.size }).select("id,file_name,content_type,byte_size,created_at").single();
  if (error) { await current.db.storage.from("support-attachments").remove([path]); return NextResponse.json({ ok: false, error: error.message }, { status: 500 }); }
  await current.db.from("personal_admin_audit_log").insert({ actor_id: current.user.id, personal_admin_id: current.user.id, target_user_id: message.customerId, action: "support_attachment_uploaded", metadata: { message_id: messageId, attachment_id: data.id, content_type: file.type, byte_size: file.size } });
  return NextResponse.json({ ok: true, attachment: data });
}

export async function GET(request: NextRequest) {
  const current = await context(request); if (!current) return NextResponse.json({ ok: false, error: "Support-management permission required" }, { status: 403 });
  const attachmentId = request.nextUrl.searchParams.get("attachmentId") || "";
  const { data } = await current.db.from("support_attachments").select("id,storage_path,message_id").eq("id", attachmentId).maybeSingle();
  if (!data || !await ownedMessage(current, data.message_id)) return NextResponse.json({ ok: false, error: "Attachment not found" }, { status: 404 });
  const { data: signed, error } = await current.db.storage.from("support-attachments").createSignedUrl(data.storage_path, 60);
  if (error || !signed?.signedUrl) return NextResponse.json({ ok: false, error: error?.message || "Unable to open attachment" }, { status: 503 });
  return NextResponse.json({ ok: true, url: signed.signedUrl });
}
