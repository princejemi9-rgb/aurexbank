/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient, type User } from "@supabase/supabase-js";
import { DEFAULT_SUPPORT_LANGUAGE, isSupportLanguage } from "../../../../src/lib/languages";

const MAX_MESSAGE_LENGTH = 5000;
const requestTimes = new Map<string, number[]>();
function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function serviceKey() { return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY || ""; }
function adminEmails() { return (process.env.AUREX_ADMIN_EMAILS || "princejemi9@gmail.com").split(",").map(value => value.trim().toLowerCase()).filter(Boolean); }
function permitted(user: User) { return Boolean(user.email && adminEmails().includes(user.email.toLowerCase())); }
function limited(userId: string) { const now = Date.now(); const hits = (requestTimes.get(userId) || []).filter(value => now - value < 60_000); if (hits.length >= 30) return true; hits.push(now); requestTimes.set(userId, hits); return false; }

async function auth(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const key = serviceKey();
  if (!url || !anon || !key) return { error: NextResponse.json({ ok: false, error: "Support server configuration is incomplete." }, { status: 500 }) };
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!token) return { error: NextResponse.json({ ok: false, error: "Missing access token" }, { status: 401 }) };
  const client = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) return { error: NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 }) };
  return { user, db: createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }) };
}

async function ownsConversation(db: any, conversationId: string, user: User, isAdmin: boolean) {
  const { data } = await db.from("support_conversations").select("*").eq("id", conversationId).maybeSingle();
  const conversation = data as { id: string; customer_id: string; customer_language: string } | null;
  if (!conversation || (!isAdmin && conversation.customer_id !== user.id)) return null;
  return conversation;
}

async function translateWithDeepL(originalText: string, targetLanguage: string) {
  const key = process.env.DEEPL_API_KEY;
  if (!key) return { error: "Translation service is not configured." };
  const endpoint = process.env.DEEPL_API_URL || "https://api-free.deepl.com/v2/translate";
  const body = new URLSearchParams({ text: originalText, target_lang: targetLanguage.toUpperCase() });
  const response = await fetch(endpoint, { method: "POST", headers: { Authorization: `DeepL-Auth-Key ${key}`, "Content-Type": "application/x-www-form-urlencoded" }, body, signal: AbortSignal.timeout(15_000) });
  const payload = await response.json().catch(() => null) as { translations?: Array<{ text?: string }>; message?: string } | null;
  const translatedText = payload?.translations?.[0]?.text?.trim();
  return response.ok && translatedText ? { translatedText } : { error: payload?.message || "Translation provider request failed." };
}

export async function GET(request: NextRequest) {
  const session = await auth(request); if ("error" in session) return session.error;
  const isAdmin = permitted(session.user); const conversationId = request.nextUrl.searchParams.get("conversationId") || "";
  if (conversationId) {
    const conversation = await ownsConversation(session.db, conversationId, session.user, isAdmin);
    if (!conversation) return NextResponse.json({ ok: false, error: "Conversation not found" }, { status: 404 });
    const { data, error } = await session.db.from("support_messages").select("*,support_message_translations(*),support_attachments(*) ").eq("conversation_id", conversationId).order("created_at");
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, conversation, messages: data ?? [] });
  }
  let query = session.db.from("support_conversations").select("*").order("last_message_at", { ascending: false }).limit(100);
  if (!isAdmin) query = query.eq("customer_id", session.user.id);
  const { data, error } = await query;
  return error ? NextResponse.json({ ok: false, error: error.message }, { status: 500 }) : NextResponse.json({ ok: true, conversations: data ?? [] });
}

export async function POST(request: NextRequest) {
  const session = await auth(request); if ("error" in session) return session.error;
  if (limited(session.user.id)) return NextResponse.json({ ok: false, error: "Too many support requests. Please wait a minute." }, { status: 429 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const originalText = text(body?.message); const subject = text(body?.subject) || "Support request"; const requestedLanguage = text(body?.language);
  const language = isSupportLanguage(requestedLanguage) ? requestedLanguage : DEFAULT_SUPPORT_LANGUAGE;
  if (originalText.length > MAX_MESSAGE_LENGTH) return NextResponse.json({ ok: false, error: "Messages must be 5,000 characters or fewer." }, { status: 400 });
  const isAdmin = permitted(session.user); let conversationId = text(body?.conversationId); let conversation;
  if (conversationId) conversation = await ownsConversation(session.db, conversationId, session.user, isAdmin);
  if (!conversation && !conversationId) {
    if (isAdmin) return NextResponse.json({ ok: false, error: "Select a customer conversation before replying." }, { status: 400 });
    const created = await session.db.from("support_conversations").insert({ customer_id: session.user.id, subject: subject.slice(0, 160), customer_language: language }).select().single();
    if (created.error || !created.data) return NextResponse.json({ ok: false, error: created.error?.message || "Could not start conversation" }, { status: 500 });
    conversation = created.data; conversationId = created.data.id;
  }
  if (!conversation || !conversationId) return NextResponse.json({ ok: false, error: "Conversation not found" }, { status: 404 });
  if (!originalText) return NextResponse.json({ ok: false, error: "Write a message or attach a file." }, { status: 400 });
  const inserted = await session.db.from("support_messages").insert({ conversation_id: conversationId, sender_id: session.user.id, sender_role: isAdmin ? "admin" : "customer", original_text: originalText, original_language: language }).select().single();
  if (inserted.error || !inserted.data) return NextResponse.json({ ok: false, error: inserted.error?.message || "Could not save message" }, { status: 500 });
  await session.db.from("support_conversations").update({ customer_language: isAdmin ? conversation.customer_language : language, last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", conversationId);
  return NextResponse.json({ ok: true, conversationId, message: inserted.data });
}

export async function PATCH(request: NextRequest) {
  const session = await auth(request); if ("error" in session) return session.error;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null; const messageId = text(body?.messageId); const target = text(body?.targetLanguage);
  if (!messageId || !isSupportLanguage(target)) return NextResponse.json({ ok: false, error: "Message and supported target language are required." }, { status: 400 });
  const { data: message } = await session.db.from("support_messages").select("*,support_conversations!inner(customer_id)").eq("id", messageId).maybeSingle();
  const isAdmin = permitted(session.user);
  if (!message || (!isAdmin && (message as { support_conversations: { customer_id: string } }).support_conversations.customer_id !== session.user.id)) return NextResponse.json({ ok: false, error: "Message not found" }, { status: 404 });
  const cached = await session.db.from("support_message_translations").select("*").eq("message_id", messageId).eq("target_language", target).maybeSingle();
  if (cached.data?.status === "completed") return NextResponse.json({ ok: true, translation: cached.data, cached: true });
  const result = await translateWithDeepL((message as { original_text: string }).original_text, target);
  const row = { message_id: messageId, target_language: target, translated_text: "translatedText" in result ? result.translatedText : null, provider: "deepl", status: "translatedText" in result ? "completed" : "failed", error_code: "error" in result ? result.error : null, updated_at: new Date().toISOString() };
  const saved = await session.db.from("support_message_translations").upsert(row, { onConflict: "message_id,target_language" }).select().single();
  if (saved.error) return NextResponse.json({ ok: false, error: saved.error.message }, { status: 500 });
  return "error" in result ? NextResponse.json({ ok: false, error: result.error, translation: saved.data }, { status: 503 }) : NextResponse.json({ ok: true, translation: saved.data });
}
