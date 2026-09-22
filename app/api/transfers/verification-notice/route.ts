import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = getServiceRoleKey();

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return NextResponse.json(
      { ok: false, error: "Missing Supabase service configuration" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization") || "";
  const accessToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!accessToken) {
    return NextResponse.json({ ok: false, error: "Missing access token" }, { status: 401 });
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(accessToken);

  if (error || !user) {
    return NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 });
  }

  const message = "Transfer verification requested.";

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const rows = getAdminNotificationTargets().map((target) => ({
    username: target,
    message,
  }));

  await serviceClient.from("notifications").insert(rows).throwOnError();

  return NextResponse.json({ ok: true });
}
