import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  fetchWithRemoteTimeout,
} from "../../../../src/lib/server/remoteTimeout";
import { getSupabaseUser } from "../../../../src/lib/server/supabaseAuth";

async function readAuthError(response: Response) {
  const data = (await response.json().catch(() => null)) as
    | { msg?: string; message?: string; error_description?: string; error?: string }
    | null;

  return (
    data?.msg ||
    data?.message ||
    data?.error_description ||
    data?.error ||
    "Failed to update presence"
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

  const userResult = await getSupabaseUser(
    supabaseUrl,
    supabaseAnonKey,
    accessToken
  );
  const user = userResult.user;

  if (!user) {
    return NextResponse.json(
      { ok: false, error: userResult.error || "Invalid session" },
      { status: userResult.status }
    );
  }

  const now = new Date();
  const onlineUntil = new Date(now.getTime() + 2 * 60 * 1000);
  const currentMetadata =
    user.user_metadata && typeof user.user_metadata === "object"
      ? user.user_metadata
      : {};
  const nextMetadata = {
    ...currentMetadata,
    last_seen_at: now.toISOString(),
    online_until: onlineUntil.toISOString(),
  };

  const updateRes = await fetchWithRemoteTimeout(
    `${supabaseUrl}/auth/v1/user`,
    {
      method: "PUT",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: nextMetadata }),
    }
  ).catch(() => null);

  if (!updateRes) {
    return NextResponse.json(
      { ok: false, error: "Unable to update presence" },
      { status: 503 }
    );
  }

  if (!updateRes.ok) {
    return NextResponse.json(
      { ok: false, error: await readAuthError(updateRes) },
      { status: updateRes.status }
    );
  }

  return NextResponse.json({
    ok: true,
    lastSeenAt: nextMetadata.last_seen_at,
    onlineUntil: nextMetadata.online_until,
  });
}
