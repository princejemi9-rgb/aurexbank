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
  const metadataRecord = currentMetadata as Record<string, unknown>;
  const savedAt = new Date().toISOString();
  const username =
    typeof metadataRecord.username === "string" && metadataRecord.username.trim()
      ? metadataRecord.username.trim()
      : user.email ?? user.id;
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
