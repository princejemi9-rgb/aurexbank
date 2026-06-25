import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

type VerificationNoticeBody = {
  code?: unknown;
  reference?: unknown;
  sender?: unknown;
  senderName?: unknown;
  receiver?: unknown;
  transferType?: unknown;
  amount?: unknown;
  fee?: unknown;
  totalDebit?: unknown;
  balanceAfter?: unknown;
};

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function money(value: number) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
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

  const body = (await request.json().catch(() => null)) as VerificationNoticeBody | null;
  const code = readText(body?.code);

  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ ok: false, error: "Invalid transfer code" }, { status: 400 });
  }

  const amount = readNumber(body?.amount) ?? 0;
  const fee = readNumber(body?.fee) ?? 0;
  const totalDebit = readNumber(body?.totalDebit) ?? amount;
  const balanceAfter = readNumber(body?.balanceAfter);
  const message = [
    "Transfer code request",
    `Ref ${readText(body?.reference) || "Pending"}`,
    `Code ${code}`,
    `Sender ${readText(body?.senderName) || readText(body?.sender) || user.email}`,
    `Recipient ${readText(body?.receiver) || "External account"}`,
    `Type ${readText(body?.transferType) || "transfer"}`,
    `Amount $${money(amount)}`,
    `Fee $${money(fee)}`,
    `Total debit $${money(totalDebit)}`,
    balanceAfter !== null ? `Balance after $${money(balanceAfter)}` : "",
  ]
    .filter(Boolean)
    .join(" | ");

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
