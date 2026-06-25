import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

type UpdateBody = {
  first_name?: string;
  last_name?: string;
  phone?: string;
  country?: string;
  avatar_url?: string;
};

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function readAuthError(response: Response) {
  const data = (await response.json().catch(() => null)) as
    | { msg?: string; message?: string; error_description?: string; error?: string }
    | null;

  return (
    data?.msg ||
    data?.message ||
    data?.error_description ||
    data?.error ||
    "Failed to update profile"
  );
}

export async function POST(request: NextRequest) {
  try {
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

    const body = (await request.json().catch(() => null)) as UpdateBody | null;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
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

    const patch: Record<string, string> = {};
    const firstName = readText(body?.first_name);
    const lastName = readText(body?.last_name);
    const phone = readText(body?.phone);
    const country = readText(body?.country);
    const avatarUrl = readText(body?.avatar_url);

    if (firstName) patch.first_name = firstName;
    if (lastName) patch.last_name = lastName;
    if (phone) patch.phone = phone;
    if (country) patch.country = country;
    if (avatarUrl) patch.avatar_url = avatarUrl;

    const currentMetadata =
      user.user_metadata && typeof user.user_metadata === "object"
        ? user.user_metadata
        : {};
    const nextMetadata: Record<string, unknown> = {
      ...currentMetadata,
      ...patch,
    };

    if (patch.first_name || patch.last_name) {
      const nextFirstName = readText(nextMetadata.first_name);
      const nextLastName = readText(nextMetadata.last_name);
      const nextFullName = `${nextFirstName} ${nextLastName}`.trim();

      if (nextFullName) {
        nextMetadata.full_name = nextFullName;
      }
    }

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
      return NextResponse.json(
        { ok: false, error: await readAuthError(updateRes) },
        { status: updateRes.status }
      );
    }

    const {
      data: { user: updatedUser },
    } = await supabase.auth.getUser(accessToken);

    return NextResponse.json({
      ok: true,
      user_metadata: updatedUser?.user_metadata ?? {},
    });
  } catch (err) {
    const e = err as { message?: string };
    return NextResponse.json(
      { ok: false, error: e?.message || "server_error" },
      { status: 500 }
    );
  }
}


