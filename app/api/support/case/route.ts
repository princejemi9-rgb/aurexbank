import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

type SupportCaseBody = {
  caseId?: unknown;
  topic?: unknown;
  message?: unknown;
};

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getAllowedAdminEmails() {
  return (process.env.AUREX_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function getServiceRoleKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    ""
  );
}

function getUsernameFromEmail(email: string) {
  return email.split("@")[0]?.trim().toLowerCase() || email;
}

function getUserLabel(user: { email?: string; user_metadata?: Record<string, unknown> }) {
  const metadata = user.user_metadata ?? {};
  return (
    readText(metadata.full_name) ||
    `${readText(metadata.first_name)} ${readText(metadata.last_name)}`.trim() ||
    readText(metadata.username) ||
    readText(user.email) ||
    "Aurex customer"
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
    return NextResponse.json({ ok: false, error: "Missing access token" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as SupportCaseBody | null;
  const message = readText(body?.message);
  const topic = readText(body?.topic) || "Support request";
  const caseId = readText(body?.caseId) || `ARX-${Date.now().toString().slice(-6)}`;

  if (!message) {
    return NextResponse.json({ ok: false, error: "Missing support message" }, { status: 400 });
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
    return NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 });
  }

  const serviceRoleKey = getServiceRoleKey();
  const dbClient = createClient(supabaseUrl, serviceRoleKey || supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    ...(serviceRoleKey
      ? {}
      : {
          global: {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        }),
  });

  const sender = getUserLabel(user);
  const adminTargets = new Set<string>();

  getAllowedAdminEmails().forEach((email) => {
    adminTargets.add(email);
    adminTargets.add(getUsernameFromEmail(email));
  });

  if (!adminTargets.size && user.email) {
    adminTargets.add(getUsernameFromEmail(user.email));
  }

  const notification = `Support case ${caseId} from ${sender}: ${topic} - ${message}`;
  const rows = Array.from(adminTargets).map((username) => ({
    username,
    message: notification,
  }));

  if (rows.length) {
    const { error } = await dbClient.from("notifications").insert(rows);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    caseId,
    notified: Array.from(adminTargets),
  });
}
