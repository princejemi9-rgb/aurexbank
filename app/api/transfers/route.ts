import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

type TransferBody = {
  transferType?: unknown;
  accountType?: unknown;
  receiver?: unknown;
  amount?: unknown;
  transferAmount?: unknown;
  fee?: unknown;
  totalDebit?: unknown;
  bankName?: unknown;
  accountNumber?: unknown;
  routingNumber?: unknown;
  recipientAccountType?: unknown;
  swift?: unknown;
  wallet?: unknown;
  memo?: unknown;
  recipientAddress?: unknown;
  wireCountry?: unknown;
  wireCurrency?: unknown;
  transferPurpose?: unknown;
  reference?: unknown;
};

type ProfileRecord = {
  username?: string | null;
  balance?: number | string | null;
};

const STARTING_BALANCE = 0;

function getServiceRoleKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    ""
  );
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readFiniteNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function readNonNegativeNumber(value: unknown) {
  const numberValue = readFiniteNumber(value);
  return numberValue === null ? null : Math.max(numberValue, 0);
}

function readMoney(value: unknown, fallback = 0) {
  const numberValue = readNonNegativeNumber(value);
  return numberValue === null ? fallback : Math.round(numberValue * 100) / 100;
}

function toWholeDatabaseMoney(value: number) {
  return Math.round(value);
}

function toDatabaseCents(value: number) {
  return Math.round(value * 100);
}

function money(value: number) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

function getUsernameFromUser(user: User) {
  return (
    readText(user.user_metadata?.username) ||
    readText(user.email).toLowerCase() ||
    user.id
  );
}

function getProfileBalance(profile: ProfileRecord | null | undefined) {
  return readFiniteNumber(profile?.balance);
}

async function getProfileByUsername(dbClient: SupabaseClient, username: string) {
  const { data, error } = await dbClient
    .from("profiles")
    .select("username,balance")
    .eq("username", username)
    .limit(1)
    .maybeSingle();

  if (error) return { error };
  return { profile: (data as ProfileRecord | null) ?? null };
}

async function updateProfileBalance(
  dbClient: SupabaseClient,
  username: string,
  balance: number
) {
  const profileBalance = toWholeDatabaseMoney(balance);
  const { error: upsertError } = await dbClient
    .from("profiles")
    .upsert({ username, balance: profileBalance }, { onConflict: "username" });

  if (!upsertError) return { profile: { username, balance } };

  const { error: updateError } = await dbClient
    .from("profiles")
    .update({ balance: profileBalance })
    .eq("username", username);

  if (!updateError) return { profile: { username, balance } };

  const { error: insertError } = await dbClient
    .from("profiles")
    .insert([{ username, balance: profileBalance }]);

  if (insertError) return { error: insertError };

  return { profile: { username, balance } };
}

async function insertNotification(
  dbClient: SupabaseClient,
  username: string,
  message: string
) {
  await dbClient.from("notifications").insert([{ username, message }]).throwOnError();
}

async function updateUserBalanceMetadata(
  dbClient: SupabaseClient,
  hasServiceRole: boolean,
  user: User,
  balance: number,
  accessToken: string,
  supabaseUrl: string,
  supabaseAnonKey: string
) {
  const currentMetadata =
    user.user_metadata && typeof user.user_metadata === "object"
      ? user.user_metadata
      : {};
  const nextMetadata = {
    ...currentMetadata,
    username: getUsernameFromUser(user),
    balance,
    balance_updated_at: new Date().toISOString(),
  };

  if (hasServiceRole) {
    await dbClient.auth.admin.updateUserById(user.id, {
      user_metadata: nextMetadata,
    });
    return;
  }

  await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: "PUT",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data: nextMetadata }),
  });
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonError("Missing Supabase env vars", 500);
  }

  const authHeader = request.headers.get("authorization") || "";
  const accessToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!accessToken) {
    return jsonError("Missing access token", 401);
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
    return jsonError("Invalid session", 401);
  }

  const metadata = user.user_metadata ?? {};

  if (metadata.account_status === "suspended") {
    return jsonError("Account is suspended. Contact Aurex support.", 403);
  }

  if (metadata.transfer_frozen === true) {
    return jsonError("Transfers are frozen for this account.", 403);
  }

  if (metadata.verification_status === "rejected") {
    return jsonError("Account verification must be approved before transfers.", 403);
  }

  const body = (await request.json().catch(() => null)) as TransferBody | null;

  if (!body) {
    return jsonError("Missing transfer details", 400);
  }

  const debitAmount = readMoney(body.totalDebit, readMoney(body.amount));
  const transferAmount = readMoney(body.transferAmount, debitAmount);
  const fee = readMoney(body.fee, Math.max(debitAmount - transferAmount, 0));
  const transferType = readText(body.transferType) || "transfer";
  const accountType = readText(body.accountType) || "checking";
  const receiver =
    readText(body.receiver) ||
    readText(body.accountNumber) ||
    readText(body.swift) ||
    readText(body.wallet) ||
    "External account";

  if (debitAmount <= 0 || transferAmount <= 0 || transferAmount > debitAmount) {
    return jsonError("Enter a valid transfer amount.", 400);
  }

  const serviceRoleKey = getServiceRoleKey();
  const hasServiceRole = Boolean(serviceRoleKey);
  const dbClient = createClient(supabaseUrl, serviceRoleKey || supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: hasServiceRole
      ? undefined
      : {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
  });

  const sender = getUsernameFromUser(user);
  const senderProfileResult = await getProfileByUsername(dbClient, sender).catch(() => ({
    profile: null,
  }));

  const currentBalance =
    readNonNegativeNumber(metadata.balance) ??
    getProfileBalance(senderProfileResult.profile) ??
    STARTING_BALANCE;

  if (currentBalance < debitAmount) {
    return NextResponse.json(
      {
        ok: false,
        error: "Insufficient available balance.",
        balance: currentBalance,
      },
      { status: 400 }
    );
  }

  const nextBalance = Math.round((currentBalance - debitAmount) * 100) / 100;
  const senderUpdate = await updateProfileBalance(dbClient, sender, nextBalance);

  if (senderUpdate.error) {
    return jsonError(senderUpdate.error.message, 500);
  }

  let receiverCredited = false;
  let receiverBalance: number | null = null;
  const postTransferTasks: Promise<unknown>[] = [
    updateUserBalanceMetadata(
      dbClient,
      hasServiceRole,
      user,
      nextBalance,
      accessToken,
      supabaseUrl,
      supabaseAnonKey
    ),
  ];

  if (transferType === "internal") {
    const receiverProfileResult = await getProfileByUsername(dbClient, receiver);
    const existingReceiverBalance = getProfileBalance(receiverProfileResult.profile);

    if (!receiverProfileResult.error && existingReceiverBalance !== null) {
      receiverBalance = Math.round((existingReceiverBalance + transferAmount) * 100) / 100;
      const receiverUpdate = await updateProfileBalance(dbClient, receiver, receiverBalance);
      receiverCredited = !receiverUpdate.error;

      if (receiverCredited) {
        postTransferTasks.push(
          insertNotification(
            dbClient,
            receiver,
            `$${money(transferAmount)} received from ${sender}. Available balance is $${money(
              receiverBalance
            )}.`
          )
        );
      }
    }
  }

  const transactionId = `ARX-${Date.now()}`;

  postTransferTasks.push(
    Promise.resolve(
      dbClient.from("transfers").insert([
        {
          sender,
          receiver,
          amount: toDatabaseCents(transferAmount),
          type: transferType,
          account_type: `${accountType}:cents`,
          bank_name: readText(body.bankName),
        },
      ])
    ),
    insertNotification(
      dbClient,
      sender,
      `$${money(transferAmount)} sent to ${receiver}. Fee $${money(
        fee
      )}. Available balance is $${money(nextBalance)}.`
    )
  );

  await Promise.allSettled(postTransferTasks);

  return NextResponse.json({
    ok: true,
    balance: nextBalance,
    balanceBefore: currentBalance,
    receiverCredited,
    receiverBalance,
    transactionId,
    transferAmount,
    fee,
    totalDebit: debitAmount,
  });
}
