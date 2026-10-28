import { NextRequest, NextResponse } from "next/server";
import { approvedPersonalAdmin, requestUser, serviceClient } from "../../../src/lib/server/tenantAccess";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SupabaseRouteUser } from "../../../src/lib/server/supabaseAuth";

function code() { return `PA-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`; }
function token(request: NextRequest) { return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || ""; }

type PersonalAdminProfile = { user_id: string; status: string; referral_code: string; full_name: string; email: string; phone: string; permissions: Record<string, boolean> };

function registrationDetails(user: SupabaseRouteUser) {
  const metadata = user.user_metadata || {};
  if (metadata.personal_admin_registration !== true || !user.email) return null;
  const fullName = typeof metadata.full_name === "string" ? metadata.full_name.trim().slice(0, 120) : "";
  const phone = typeof metadata.phone === "string" ? metadata.phone.trim().slice(0, 40) : "";
  return fullName && phone ? { fullName, phone } : null;
}

async function createActiveProfile(db: SupabaseClient, user: SupabaseRouteUser, fullName: string, phone: string) {
  const existing = await approvedPersonalAdmin(db, user.id);
  if (existing) return { profile: existing as PersonalAdminProfile, error: null };
  if (!user.email) return { profile: null, error: "Your account does not have an email address." };

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const referralCode = code();
    const { data, error } = await db.rpc("register_active_personal_admin_profile", {
      p_user_id: user.id,
      p_full_name: fullName,
      p_email: user.email,
      p_phone: phone,
      p_referral_code: referralCode,
    });
    if (!error && data) {
      return { profile: data as PersonalAdminProfile, error: null };
    }
    if (!error || !/unique/i.test(error.message)) return { profile: null, error: error?.message || "Unable to activate the Personal Admin registration." };
    const concurrentlyCreated = await approvedPersonalAdmin(db, user.id);
    if (concurrentlyCreated) return { profile: concurrentlyCreated as PersonalAdminProfile, error: null };
  }
  return { profile: null, error: "Unable to reserve a referral code. Please try again." };
}

export async function GET(request: NextRequest) {
  const db = serviceClient(); const user = await requestUser(token(request));
  if (!db || !user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  let profile = await approvedPersonalAdmin(db, user.id);
  // Email-confirmation sign-ups have no browser session when the form submits.
  // Complete their request on first authenticated visit using the server-verified user.
  if (!profile) {
    const details = registrationDetails(user);
    if (details) {
      const created = await createActiveProfile(db, user, details.fullName, details.phone);
      if (created.error) return NextResponse.json({ ok: false, error: created.error }, { status: 400 });
      profile = created.profile;
    }
  }
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
  const created = await createActiveProfile(db, user, fullName, phone);
  if (created.error) return NextResponse.json({ ok: false, error: created.error }, { status: 409 });
  return NextResponse.json({ ok: true, personalAdmin: created.profile });
}
