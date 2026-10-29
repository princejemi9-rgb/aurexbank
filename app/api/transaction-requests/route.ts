import { NextRequest, NextResponse } from "next/server";
import { requestUser, serviceClient } from "../../../src/lib/server/tenantAccess";

function tokenFrom(request: NextRequest) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
}

export async function GET(request: NextRequest) {
  const db = serviceClient();
  const user = await requestUser(tokenFrom(request));
  if (!db || !user) return NextResponse.json({ ok: false, error: "Sign in to view account requests." }, { status: 401 });
  const { data, error } = await db.from("personal_admin_transaction_requests")
    .select("id,request_type,amount,currency,description,status,review_note,reviewed_at,created_at")
    .eq("customer_id", user.id).order("created_at", { ascending: false }).limit(100);
  return error ? NextResponse.json({ ok: false, error: error.message }, { status: 500 }) : NextResponse.json({ ok: true, requests: data || [] });
}

export async function POST(request: NextRequest) {
  const db = serviceClient();
  const user = await requestUser(tokenFrom(request));
  if (!db || !user) return NextResponse.json({ ok: false, error: "Sign in to submit a request." }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const requestType = typeof body?.requestType === "string" ? body.requestType : "";
  const description = typeof body?.description === "string" ? body.description : "";
  const amount = typeof body?.amount === "number" && Number.isFinite(body.amount) ? body.amount : null;
  const currency = typeof body?.currency === "string" ? body.currency : "";
  const { data, error } = await db.rpc("submit_customer_personal_admin_request", {
    p_customer_id: user.id, p_request_type: requestType, p_amount: amount, p_currency: currency, p_description: description,
  });
  return error ? NextResponse.json({ ok: false, error: error.message }, { status: 400 }) : NextResponse.json({ ok: true, request: data }, { status: 201 });
}
