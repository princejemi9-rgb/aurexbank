import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

type OnboardBody = {
  userId?: unknown;
  email?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  fullName?: unknown;
  phone?: unknown;
  country?: unknown;
};

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readNonNegativeNumber(value: unknown, fallback: number) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.max(numberValue, 0) : fallback;
}

function getServiceRoleKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    ""
  );
}

function getAllowedAdminEmails() {
  return (process.env.AUREX_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function getAdminNotificationTargets() {
  const targets = new Set(["admin"]);

  getAllowedAdminEmails().forEach((email) => {
    targets.add(email);
    targets.add(email.split("@")[0] || email);
  });

  return [...targets];
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = getServiceRoleKey();

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { ok: false, error: "Missing Supabase service configuration" },
      { status: 500 }
    );
  }

  const body = (await request.json().catch(() => null)) as OnboardBody | null;
  const userId = readText(body?.userId);
  const email = readText(body?.email).toLowerCase();

  if (!userId || !email) {
    return NextResponse.json(
      { ok: false, error: "Missing user details" },
      { status: 400 }
    );
  }

  const firstName = readText(body?.firstName);
  const lastName = readText(body?.lastName);
  const fullName = readText(body?.fullName) || `${firstName} ${lastName}`.trim() || email;
  const username = email;
  const now = new Date().toISOString();
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const {
    data: { user },
    error: userError,
  } = await serviceClient.auth.admin.getUserById(userId);

  if (userError || !user || readText(user.email).toLowerCase() !== email) {
    return NextResponse.json(
      { ok: false, error: "Unable to verify new account" },
      { status: 403 }
    );
  }

  const currentMetadata: Record<string, unknown> =
    user?.user_metadata && typeof user.user_metadata === "object"
      ? (user.user_metadata as Record<string, unknown>)
      : {};
  const existingBalance = readNonNegativeNumber(currentMetadata.balance, 0);
  const existingReserve = readNonNegativeNumber(currentMetadata.reserve, 0);
  const existingIncome = readNonNegativeNumber(currentMetadata.income, 0);

  await serviceClient.auth.admin
    .updateUserById(userId, {
      user_metadata: {
        ...currentMetadata,
        username,
        first_name: firstName || readText(currentMetadata.first_name) || "",
        last_name: lastName || readText(currentMetadata.last_name) || "",
        full_name: fullName,
        phone: readText(body?.phone) || readText(currentMetadata.phone) || "",
        country: readText(body?.country) || readText(currentMetadata.country) || "",
        balance: existingBalance,
        reserve: existingReserve,
        income: existingIncome,
        account_status: "active",
        transfer_frozen: false,
        verification_status: readText(currentMetadata.verification_status) || "pending",
        onboarded_at: readText(currentMetadata.onboarded_at) || now,
      },
    })
    .catch(() => null);

  let profileBalance = existingBalance;

  try {
    const { data: existingProfile } = await serviceClient
      .from("profiles")
      .select("balance")
      .eq("username", username)
      .limit(1)
      .maybeSingle();

    profileBalance = readNonNegativeNumber(
      (existingProfile as { balance?: unknown } | null)?.balance,
      existingBalance
    );
  } catch {}

  try {
    await serviceClient
      .from("profiles")
      .upsert({ username, balance: profileBalance }, { onConflict: "username" });
  } catch {}

  const notification = `New user registered: ${fullName} (${email}). Account balance starts at $0.`;
  const rows = getAdminNotificationTargets().map((target) => ({
    username: target,
    message: notification,
  }));

  if (rows.length) {
    try {
      await serviceClient.from("notifications").insert(rows);
    } catch {}
  }

  return NextResponse.json({ ok: true });
}
