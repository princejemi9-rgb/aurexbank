import { NextRequest, NextResponse } from "next/server";
import { approvedPersonalAdmin, requestUser, serviceClient } from "../../../src/lib/server/tenantAccess";

function code() { return `PA-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`; }
function token(request: NextRequest) { return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || ""; }

export async function GET(request: NextRequest) {
  const db = serviceClient(); const user = await requestUser(token(request));
  if (!db || !user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const profile = await approvedPersonalAdmin(db, user.id);
  if (!profile) return NextResponse.json({ ok: true, personalAdmin: null });
  const { count } = await db.from("customer_personal_admin_assignments").select("customer_id", { count: "exact", head: true }).eq("personal_admin_id", user.id);
  return NextResponse.json({ ok: true, personalAdmin: profile, customerCount: count || 0 });
}

export async function POST(request: NextRequest) {
  const db = serviceClient(); const user = await requestUser(token(request));
  if (!db || !user?.email) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { fullName?: unknown; phone?: unknown } | null;
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim().slice(0, 120) : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim().slice(0, 40) : "";
  if (!fullName || !phone) return NextResponse.json({ ok: false, error: "Full name and phone are required." }, { status: 400 });
  const existing = await approvedPersonalAdmin(db, user.id);
  if (existing) return NextResponse.json({ ok: true, personalAdmin: existing });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const referralCode = code();
    const { data, error } = await db.from("personal_admin_profiles").insert({ user_id: user.id, full_name: fullName, email: user.email.toLowerCase(), phone, referral_code: referralCode }).select("user_id,status,referral_code,full_name,email,phone,permissions").maybeSingle();
    if (!error && data) {
      await db.from("personal_admin_audit_log").insert({ actor_id: user.id, personal_admin_id: user.id, action: "personal_admin_registered" });
      return NextResponse.json({ ok: true, personalAdmin: data });
    }
    if (!error) break;
    if (!/unique/i.test(error.message)) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: false, error: "Unable to reserve a referral code. Please try again." }, { status: 409 });
}
