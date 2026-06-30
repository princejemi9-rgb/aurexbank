import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

async function readAuthError(response: Response) {
  const data = (await response.json().catch(() => null)) as
    | { msg?: string; message?: string; error_description?: string; error?: string }
    | null;

  return (
    data?.msg ||
    data?.message ||
    data?.error_description ||
    data?.error ||
    "Failed to save balance"
  );
}

function getServiceRoleKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    ""
  );
}

function toWholeDatabaseMoney(value: number) {
  return Math.round(value);
}

const PROTECTED_METRICS_KEY = "aurex_metrics";

function readNonNegativeNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.max(numberValue, 0) : null;
}

function readUsername(user: { id: string; email?: string | null; user_metadata?: unknown }) {
  const metadata =
    user.user_metadata && typeof user.user_metadata === "object"
      ? (user.user_metadata as Record<string, unknown>)
      : {};

  return typeof metadata.username === "string" && metadata.username.trim()
    ? metadata.username.trim()
    : user.email ?? user.id;
}

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { ok: false, error: "Missing Supabase env vars" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization") || "";
  const accessToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!accessToken) {
    return NextResponse.json(
      { ok: false, error: "Missing access token" },
      { status: 401 }
    );
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser(accessToken);

  if (userError || !user) {
    return NextResponse.json(
      { ok: false, error: "Invalid session" },
      { status: 401 }
    );
  }

  const serviceRoleKey = getServiceRoleKey();
  const accountClient = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      });
  const freshUserResult = serviceRoleKey
    ? await accountClient.auth.admin.getUserById(user.id)
    : null;
  const freshUser = freshUserResult?.data.user ?? user;
  const metadata =
    freshUser.user_metadata && typeof freshUser.user_metadata === "object"
      ? (freshUser.user_metadata as Record<string, unknown>)
      : {};
  const protectedMetricsValue = freshUser.app_metadata?.[PROTECTED_METRICS_KEY];
  const protectedMetrics =
    protectedMetricsValue && typeof protectedMetricsValue === "object"
      ? (protectedMetricsValue as Record<string, unknown>)
      : {};
  const username = readUsername(freshUser);
  const { data: profile } = await accountClient
    .from("profiles")
    .select("balance")
    .eq("username", username)
    .limit(1)
    .maybeSingle();
  const profileBalance = readNonNegativeNumber(
    (profile as { balance?: unknown } | null)?.balance
  );

  return NextResponse.json(
    {
      ok: true,
      balance: profileBalance ?? readNonNegativeNumber(metadata.balance) ?? 0,
      reserve:
        readNonNegativeNumber(protectedMetrics.reserve) ??
        readNonNegativeNumber(metadata.reserve) ??
        0,
      income:
        readNonNegativeNumber(protectedMetrics.income) ??
        readNonNegativeNumber(metadata.income) ??
        0,
      updatedAt:
        typeof protectedMetrics.updated_at === "string"
          ? protectedMetrics.updated_at
          : typeof metadata.admin_updated_at === "string"
            ? metadata.admin_updated_at
          : null,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { ok: false, error: "Missing Supabase env vars" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization") || "";
  const accessToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!accessToken) {
    return NextResponse.json(
      { ok: false, error: "Missing access token" },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => null)) as { balance?: unknown } | null;
  const balance = Number(body?.balance);

  if (!Number.isFinite(balance) || balance < 0) {
    return NextResponse.json(
      { ok: false, error: "Invalid balance" },
      { status: 400 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser(accessToken);

  if (userErr || !user) {
    return NextResponse.json(
      { ok: false, error: "Invalid session" },
      { status: 401 }
    );
  }

  const currentMetadata =
    user.user_metadata && typeof user.user_metadata === "object"
      ? user.user_metadata
      : {};
  const savedAt = new Date().toISOString();
  const username = readUsername(user);
  const serviceRoleKey = getServiceRoleKey();
  const profileClient = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : supabase;
  const { error: profileError } = await profileClient
    .from("profiles")
    .upsert(
      { username, balance: toWholeDatabaseMoney(balance) },
      { onConflict: "username" }
    );

  if (profileError) {
    return NextResponse.json(
      { ok: false, error: profileError.message },
      { status: 500 }
    );
  }

  const nextMetadata = {
    ...currentMetadata,
    balance,
    balance_updated_at: savedAt,
  };

  const updateRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: "PUT",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data: nextMetadata }),
  });

  if (!updateRes.ok) {
    return NextResponse.json({
      ok: true,
      balance,
      savedAt,
      warning: await readAuthError(updateRes),
    });
  }

  return NextResponse.json({ ok: true, balance, savedAt });
}
