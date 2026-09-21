import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

type OnboardBody = {
  userId?: unknown;
  email?: unknown;
};

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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
  return ["princejemi9@gmail.com"];
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

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!token) return NextResponse.json({ ok: false, error: "Sign in to finish account setup" }, { status: 401 });


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
  } = await serviceClient.auth.getUser(token).catch(() => ({ data: { user: null }, error: true }));

  if (userError || !user || user.id !== userId || readText(user.email).toLowerCase() !== email) {
    return NextResponse.json(
      { ok: false, error: "Unable to verify new account" },
      { status: 403 }
    );
  }

  const currentMetadata: Record<string, unknown> =
    user?.user_metadata && typeof user.user_metadata === "object"
      ? (user.user_metadata as Record<string, unknown>)
      : {};
  if (currentMetadata.onboarded_at) return NextResponse.json({ ok: true });
  const firstName = readText(currentMetadata.first_name);
  const lastName = readText(currentMetadata.last_name);
  const fullName = readText(currentMetadata.full_name) || `${firstName} ${lastName}`.trim() || email;
  try {
    const { error: profileError } = await serviceClient
      .from("profiles")
      .upsert(
        {
          username,
          balance: 0,
          first_name: firstName,
          last_name: lastName,
          full_name: fullName,
          email,
          phone: readText(currentMetadata.phone) || "",
          country: readText(currentMetadata.country) || "",
          account_type: readText(currentMetadata.account_type) || "personal",
          currency: readText(currentMetadata.currency) || "USD",
          account_status: "active",
          verification_status: "pending",
          onboarded_at: now,
        },
        { onConflict: "username", ignoreDuplicates: true }
      );
    if (profileError) return NextResponse.json({ ok: false, error: "Account created, but profile setup needs to be retried" }, { status: 503 });
  } catch {
    return NextResponse.json({ ok: false, error: "Profile setup is temporarily unavailable" }, { status: 503 });
  }
  const { error: metadataError } = await serviceClient.auth.admin.updateUserById(userId, {
    user_metadata: { ...currentMetadata, username, onboarded_at: now },
  }).catch(() => ({ error: true }));
  if (metadataError) return NextResponse.json({ ok: false, error: "Account setup needs to be retried" }, { status: 503 });

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
