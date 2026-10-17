import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const key = () => process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY || "";
const admins = () => (process.env.AUREX_ADMIN_EMAILS || "princejemi9@gmail.com").split(",").map(value => value.trim().toLowerCase());
export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, service = key();
  if (!url || !anon || !service) return NextResponse.json({ ok: false, error: "Support upload configuration is incomplete." }, { status: 500 });
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || ""; if (!token) return NextResponse.json({ ok: false, error: "Missing access token" }, { status: 401 });
  const auth = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } }); const { data: { user } } = await auth.auth.getUser(token); if (!user) return NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 });
  const form = await request.formData(); const messageId = String(form.get("messageId") || ""), file = form.get("file");
  if (!messageId || !(file instanceof File)) return NextResponse.json({ ok: false, error: "Message and file are required." }, { status: 400 });
  if (!TYPES.has(file.type) || file.size <= 0 || file.size > MAX_BYTES) return NextResponse.json({ ok: false, error: "Attach a JPG, PNG, WebP, or PDF up to 10 MB." }, { status: 400 });
  const db = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: message } = await db.from("support_messages").select("conversation_id,sender_id,support_conversations!inner(customer_id)").eq("id", messageId).maybeSingle();
  const admin = Boolean(user.email && admins().includes(user.email.toLowerCase())); const owner = (message as { support_conversations?: { customer_id?: string } } | null)?.support_conversations?.customer_id;
  if (!message || (!admin && message.sender_id !== user.id && owner !== user.id)) return NextResponse.json({ ok: false, error: "Message not found" }, { status: 404 });
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120); const storagePath = `${messageId}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await db.storage.from("support-attachments").upload(storagePath, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (uploadError) return NextResponse.json({ ok: false, error: uploadError.message }, { status: 500 });
  const { data, error } = await db.from("support_attachments").insert({ message_id: messageId, storage_path: storagePath, file_name: safeName, content_type: file.type, byte_size: file.size }).select().single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 }); return NextResponse.json({ ok: true, attachment: data });
}
