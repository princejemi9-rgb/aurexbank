import { createHash, randomBytes, randomInt, randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requestUser, serviceClient } from "../../../../src/lib/server/tenantAccess";

type Body = { recipient?: unknown; amount?: unknown; currency?: unknown; memo?: unknown; reference?: unknown };
const token = (request: NextRequest) => request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
function parseAmount(value: unknown) {
  const raw = typeof value === "number" ? String(value) : text(value);
  if (!/^\d{1,13}(?:\.\d{1,2})?$/.test(raw)) return null;
  const amount = Number(raw);
  return Number.isSafeInteger(Math.round(amount * 100)) && amount > 0 ? amount : null;
}
function configuredTransferLimit() {
  const configured = Number(process.env.AUREX_INTERNAL_TRANSFER_MAX_AMOUNT || "1000000");
  return Number.isFinite(configured) && configured > 0 ? Math.round(configured * 100) / 100 : 1000000;
}
async function deliverOtp(payload: Record<string, unknown>) {
  const endpoint = process.env.AUREX_OTP_DELIVERY_WEBHOOK; const secret = process.env.AUREX_OTP_DELIVERY_WEBHOOK_SECRET;
  if (!endpoint || !secret) throw new Error("OTP delivery is not configured.");
  const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` }, body: JSON.stringify(payload), cache: "no-store" });
  if (!response.ok) throw new Error("OTP delivery failed.");
}
export async function POST(request: NextRequest) {
  const db = serviceClient(); const user = await requestUser(token(request));
  if (!db || !user) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  const body = await request.json().catch(() => null) as Body | null;
  const recipient = text(body?.recipient).toLowerCase(); const amount = parseAmount(body?.amount); const currency = (text(body?.currency) || "USD").toUpperCase(); const memo = text(body?.memo); const reference = text(body?.reference) || randomUUID();
  if (!recipient || amount === null || !/^[A-Z]{3}$/.test(currency) || memo.length > 280) return NextResponse.json({ ok: false, error: "Enter a valid amount with no more than two decimal places and valid internal recipient details." }, { status: 400 });
  const [{ data: sender }, { data: receiver }] = await Promise.all([db.from("profiles").select("id,balance,currency,account_status").eq("id", user.id).maybeSingle(), db.from("profiles").select("id,username,currency,account_status").eq("username", recipient).maybeSingle()]);
  if (!sender || sender.account_status !== "active") return NextResponse.json({ ok: false, error: "Your account is restricted from transfers." }, { status: 403 });
  if (!receiver || receiver.account_status !== "active" || receiver.id === user.id) return NextResponse.json({ ok: false, error: "Recipient is unavailable for internal transfers." }, { status: 400 });
  if (sender.currency !== currency || receiver.currency !== currency) return NextResponse.json({ ok: false, error: "Recipient currency does not match this account." }, { status: 400 });
  if (Number(sender.balance) < amount) return NextResponse.json({ ok: false, error: "Insufficient available balance." }, { status: 400 });
  const transferLimit = configuredTransferLimit();
  if (amount > transferLimit) {
    const { error: reviewError } = await db.from("transfer_review_requests").insert({ sender_id: user.id, recipient_id: receiver.id, amount, currency, memo, idempotency_key: reference, status: "pending" });
    if (reviewError) return NextResponse.json({ ok: false, error: "This transfer exceeds your authorized limit and could not be submitted for review." }, { status: 503 });
    return NextResponse.json({ ok: true, reviewRequired: true, message: `This amount exceeds your ${currency} ${transferLimit.toLocaleString("en-US", { minimumFractionDigits: 2 })} authorization limit and has been submitted for review. No funds were moved.` }, { status: 202 });
  }
  const code = String(randomInt(100000, 1_000_000)); const salt = randomBytes(24).toString("base64url"); const hash = createHash("sha256").update(`${salt}:${code}`).digest("hex");
  const { data: challenge, error } = await db.from("transfer_authorization_challenges").insert({ sender_id: user.id, recipient_id: receiver.id, amount, currency, memo, idempotency_key: reference, code_salt: salt, code_hash: hash, expires_at: new Date(Date.now() + 600000).toISOString() }).select("id,expires_at,status").single();
  if (error || !challenge) return NextResponse.json({ ok: false, error: error?.code === "23505" ? "This transfer is already awaiting authorization." : error?.message || "Unable to create transfer authorization." }, { status: 400 });
  try { await deliverOtp({ purpose: "transfer_confirmation", customerId: user.id, challengeId: challenge.id, code, expiresAt: challenge.expires_at }); }
  catch (deliveryError) { await db.from("transfer_authorization_challenges").update({ status: "cancelled" }).eq("id", challenge.id); return NextResponse.json({ ok: false, error: deliveryError instanceof Error ? deliveryError.message : "OTP delivery failed." }, { status: 503 }); }
  return NextResponse.json({ ok: true, challenge: { id: challenge.id, expiresAt: challenge.expires_at, recipient: receiver.username, delivery: "verified_channel" } }, { headers: { "Cache-Control": "no-store" } });
}
