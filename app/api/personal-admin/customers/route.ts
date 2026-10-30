import { NextRequest, NextResponse } from "next/server";
import { approvedPersonalAdmin, requestUser, serviceClient } from "../../../../src/lib/server/tenantAccess";

export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const db = serviceClient(); const user = await requestUser(token);
  if (!db || !user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const admin = await approvedPersonalAdmin(db, user.id);
  if (admin?.status !== "approved" || admin.permissions?.manage_customers !== true) return NextResponse.json({ ok: false, error: "Customer-management permission required" }, { status: 403 });
  const { data: assignments, error } = await db.from("customer_personal_admin_assignments").select("customer_id,assigned_at,referral_code").eq("personal_admin_id", user.id).order("assigned_at", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const ids = (assignments || []).map(item => item.customer_id);
  if (!ids.length) return NextResponse.json({ ok: true, customers: [] });
  const { data: users, error: userError } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (userError) return NextResponse.json({ ok: false, error: userError.message }, { status: 500 });
  const byId = new Map(users.users.filter(item => ids.includes(item.id)).map(item => [item.id, item]));
  const emails = [...byId.values()].map(item => item.email).filter((value): value is string => Boolean(value));
  const { data: profiles } = emails.length ? await db.from("profiles").select("username,balance,account_status,currency").in("username", emails) : { data: [] };
  const profileByEmail = new Map((profiles || []).map(profile => [String(profile.username).toLowerCase(), profile]));
  return NextResponse.json({ ok: true, customers: (assignments || []).map(item => { const customer = byId.get(item.customer_id); const email = customer?.email || ""; const profile = profileByEmail.get(email.toLowerCase()); return { id: item.customer_id, email, fullName: String(customer?.user_metadata?.full_name || email || "Customer"), assignedAt: item.assigned_at, referralCode: item.referral_code, balance: Number(profile?.balance || 0), currency: profile?.currency || "USD", accountStatus: profile?.account_status || "active" }; }) });
}

type CreateCustomerBody = { fullName?: unknown; email?: unknown; phone?: unknown; initialPassword?: unknown; country?: unknown; accountType?: unknown; address?: unknown; openingBalance?: unknown };

function text(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }

export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const db = serviceClient(); const user = await requestUser(token);
  if (!db || !user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const admin = await approvedPersonalAdmin(db, user.id);
  if (admin?.status !== "approved" || admin.permissions?.manage_customers !== true) return NextResponse.json({ ok: false, error: "Customer-management permission required" }, { status: 403 });
  const body = await request.json().catch(() => null) as CreateCustomerBody | null;
  const fullName = text(body?.fullName, 120); const email = text(body?.email, 254).toLowerCase();
  const initialPassword = text(body?.initialPassword, 256);
  const phone = text(body?.phone, 40); const country = text(body?.country, 80);
  const accountType = text(body?.accountType, 20).toLowerCase() || "personal"; const address = text(body?.address, 500);
  const openingBalance = typeof body?.openingBalance === "number" ? body.openingBalance : Number(body?.openingBalance || 0);
  if (fullName.length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !phone || !country || !["personal", "business"].includes(accountType)) {
    return NextResponse.json({ ok: false, error: "Enter a full name, valid email, phone, country, and account type." }, { status: 400 });
  }
  if (initialPassword.length < 10 || !/[A-Z]/.test(initialPassword) || !/[a-z]/.test(initialPassword) || !/\d/.test(initialPassword)) return NextResponse.json({ ok: false, error: "The initial password must be at least 10 characters and include uppercase, lowercase, and a number." }, { status: 400 });
  if (!Number.isFinite(openingBalance) || openingBalance < 0 || openingBalance > 100000) return NextResponse.json({ ok: false, error: "Opening balance must be between 0 and 100,000." }, { status: 400 });

  const [firstName, ...lastNameParts] = fullName.split(/\s+/);
  const { data: createdUser, error: createUserError } = await db.auth.admin.createUser({
    email, password: initialPassword, email_confirm: true,
    user_metadata: { full_name: fullName, first_name: firstName, last_name: lastNameParts.join(" "), phone, country, account_type: accountType, personal_admin_created: true, email_verification_status: "administratively_confirmed_not_proof_of_ownership", onboarded_at: new Date().toISOString(), referral_code: admin.referral_code },
  });
  const customerId = createdUser.user?.id;
  if (createUserError || !customerId) {
    const message = createUserError?.message || "Unable to create the customer login.";
    return NextResponse.json({ ok: false, error: /already|registered|exists/i.test(message) ? "An account already exists for this email address." : message }, { status: 409 });
  }
  const { data: created, error: createError } = await db.rpc("create_personal_admin_customer_account", {
    p_personal_admin_id: user.id, p_customer_id: customerId, p_email: email, p_full_name: fullName,
    p_phone: phone, p_country: country, p_account_type: accountType, p_address: address, p_opening_balance: openingBalance,
  });
  if (createError) {
    // The auth user created in this request has no valid banking profile. Remove
    // only that new auth user so a retry cannot create an orphaned account.
    await db.auth.admin.deleteUser(customerId).catch(() => null);
    return NextResponse.json({ ok: false, error: createError.message || "Unable to create the customer account." }, { status: 503 });
  }
  return NextResponse.json({ ok: true, customer: { id: customerId, email, initialPasswordChangeRequired: true, ...created } }, { status: 201 });
}
