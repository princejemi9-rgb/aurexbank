import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

type ProfileRecord = {
  username?: string | null;
  balance?: number | string | null;
};

type AdminActionBody = {
  action?: string;
  userId?: string;
  username?: string;
  balance?: unknown;
  reserve?: unknown;
  income?: unknown;
  amount?: unknown;
  name?: unknown;
  type?: unknown;
  status?: unknown;
  method?: unknown;
  alertType?: unknown;
  title?: unknown;
  desc?: unknown;
  unread?: unknown;
  accountStatus?: unknown;
  transferFrozen?: unknown;
  verificationStatus?: unknown;
};

const STARTING_BALANCE = 0;
const STARTING_RESERVE = 0;
const STARTING_INCOME = 0;

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

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readFiniteNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function readNonNegativeNumber(value: unknown, fallback: number) {
  const numberValue = readFiniteNumber(value);
  return numberValue === null ? fallback : Math.max(numberValue, 0);
}

function toWholeDatabaseMoney(value: number) {
  return Math.round(value);
}

function toDatabaseCents(value: number) {
  return Math.round(value * 100);
}

function readMetadataNumber(user: User | null, key: string, fallback: number) {
  return readNonNegativeNumber(user?.user_metadata?.[key], fallback);
}

function readMetadataText(user: User | null, key: string) {
  return readText(user?.user_metadata?.[key]);
}

function readAccountStatus(user: User | null) {
  const status = readMetadataText(user, "account_status").toLowerCase();
  if (status === "suspended") return "suspended";
  if (status === "pending") return "pending";
  return user ? "active" : "pending";
}

function readVerificationStatus(user: User | null) {
  const status = readMetadataText(user, "verification_status").toLowerCase();
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  return "pending";
}

function readTransferFrozen(user: User | null) {
  return user?.user_metadata?.transfer_frozen === true;
}

function readIsoDate(value: unknown) {
  const text = readText(value);
  if (!text) return "";

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function isFutureIsoDate(value: unknown) {
  const text = readText(value);
  if (!text) return false;

  const date = new Date(text);
  return !Number.isNaN(date.getTime()) && date.getTime() > Date.now();
}

function getUsernameFromUser(user: User | null) {
  if (!user) return "";

  return (
    readText(user.user_metadata?.username) ||
    readText(user.email).toLowerCase() ||
    user.id
  );
}

function getFullNameFromUser(user: User | null, username: string) {
  if (!user) return username;

  const firstName = readText(user.user_metadata?.first_name);
  const lastName = readText(user.user_metadata?.last_name);

  return (
    readText(user.user_metadata?.full_name) ||
    `${firstName} ${lastName}`.trim() ||
    readText(user.email) ||
    username
  );
}

function getFirstNameFromUser(user: User | null, fullName: string) {
  return (
    readText(user?.user_metadata?.first_name) ||
    fullName.split(" ").filter(Boolean)[0] ||
    fullName
  );
}

function getCustomerId(userId: string | undefined, username: string) {
  if (userId) return `ARX-${userId.slice(0, 8).toUpperCase()}`;
  return `ARX-${username.replace(/\W/g, "").slice(0, 8).toUpperCase() || "USER"}`;
}

function getProfileBalance(profile: ProfileRecord | null | undefined) {
  return readFiniteNumber(profile?.balance);
}

function buildAdminUser(user: User | null, profile?: ProfileRecord | null) {
  const username = getUsernameFromUser(user) || readText(profile?.username);
  const fullName = getFullNameFromUser(user, username);
  const profileBalance = getProfileBalance(profile);
  const metadataBalance = readFiniteNumber(user?.user_metadata?.balance);

  return {
    userId: user?.id ?? "",
    username,
    email: readText(user?.email) || username,
    fullName,
    firstName: getFirstNameFromUser(user, fullName),
    phone: readText(user?.user_metadata?.phone) || "Not provided",
    country: readText(user?.user_metadata?.country) || "Not provided",
    customerId: getCustomerId(user?.id, username),
    balance:
      metadataBalance ??
      profileBalance ??
      STARTING_BALANCE,
    reserve: readMetadataNumber(user, "reserve", STARTING_RESERVE),
    income: readMetadataNumber(user, "income", STARTING_INCOME),
    accountStatus: readAccountStatus(user),
    transferFrozen: readTransferFrozen(user),
    verificationStatus: readVerificationStatus(user),
    signedIn: isFutureIsoDate(user?.user_metadata?.online_until),
    lastSeenAt: readIsoDate(user?.user_metadata?.last_seen_at),
    onlineUntil: readIsoDate(user?.user_metadata?.online_until),
    lastSignInAt: readIsoDate(user?.last_sign_in_at),
    createdAt: user?.created_at ?? "",
    source: user ? "auth" : "profile",
  };
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

async function requireAdmin(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return { error: jsonError("Missing Supabase env vars", 500) };
  }

  const authHeader = request.headers.get("authorization") || "";
  const accessToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!accessToken) {
    return { error: jsonError("Missing access token", 401) };
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

  if (error || !user?.email) {
    return { error: jsonError("Invalid session", 401) };
  }

  const isAdmin = getAllowedAdminEmails().includes(user.email.toLowerCase());

  if (!isAdmin) {
    return { error: jsonError("Admin access required", 403) };
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

  return {
    adminUser: user,
    dbClient,
    hasServiceRole,
  };
}

async function getProfilesByUsername(dbClient: SupabaseClient) {
  const { data, error } = await dbClient
    .from("profiles")
    .select("username,balance")
    .limit(500);

  if (error) return [];

  return (data ?? [])
    .map((profile) => profile as ProfileRecord)
    .filter((profile) => readText(profile.username));
}

async function getAuthUsers(dbClient: SupabaseClient, hasServiceRole: boolean) {
  if (!hasServiceRole) return [];

  const users: User[] = [];
  let page = 1;

  while (page <= 10) {
    const { data, error } = await dbClient.auth.admin.listUsers({
      page,
      perPage: 100,
    });

    if (error || !data?.users?.length) break;

    users.push(...data.users);

    if (data.users.length < 100) break;
    page += 1;
  }

  return users;
}

async function findTargetUser(
  dbClient: SupabaseClient,
  hasServiceRole: boolean,
  userId: string,
  username: string
) {
  if (hasServiceRole && userId) {
    const {
      data: { user },
    } = await dbClient.auth.admin.getUserById(userId);

    if (user) return user;
  }

  if (!hasServiceRole || !username) return null;

  const users = await getAuthUsers(dbClient, hasServiceRole);
  return (
    users.find((user) => {
      const userUsername = getUsernameFromUser(user);
      return userUsername === username || user.email?.toLowerCase() === username.toLowerCase();
    }) ?? null
  );
}

async function getProfileByUsername(dbClient: SupabaseClient, username: string) {
  const { data } = await dbClient
    .from("profiles")
    .select("username,balance")
    .eq("username", username)
    .limit(1)
    .maybeSingle();

  return (data as ProfileRecord | null) ?? null;
}

async function updateTargetMetadata(
  dbClient: SupabaseClient,
  hasServiceRole: boolean,
  user: User | null,
  metrics: { balance: number; reserve: number; income: number }
) {
  if (!hasServiceRole || !user) return;

  const currentMetadata =
    user.user_metadata && typeof user.user_metadata === "object"
      ? user.user_metadata
      : {};

  await dbClient.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...currentMetadata,
      username: getUsernameFromUser(user),
      balance: metrics.balance,
      reserve: metrics.reserve,
      income: metrics.income,
      admin_updated_at: new Date().toISOString(),
    },
  });
}

async function updateTargetControls(
  dbClient: SupabaseClient,
  hasServiceRole: boolean,
  user: User | null,
  controls: {
    accountStatus: string;
    transferFrozen: boolean;
    verificationStatus: string;
  }
) {
  if (!hasServiceRole || !user) {
    return { error: jsonError("Service role key is required for account controls", 403) };
  }

  const currentMetadata =
    user.user_metadata && typeof user.user_metadata === "object"
      ? user.user_metadata
      : {};

  await dbClient.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...currentMetadata,
      username: getUsernameFromUser(user),
      account_status: controls.accountStatus,
      transfer_frozen: controls.transferFrozen,
      verification_status: controls.verificationStatus,
      admin_updated_at: new Date().toISOString(),
    },
  });

  const {
    data: { user: updatedUser },
  } = await dbClient.auth.admin.getUserById(user.id);

  return { user: updatedUser ?? user };
}

async function updateTargetProfileBalance(
  dbClient: SupabaseClient,
  username: string,
  balance: number
) {
  const { data, error } = await dbClient
    .from("profiles")
    .update({ balance: toWholeDatabaseMoney(balance) })
    .eq("username", username)
    .select("username,balance")
    .maybeSingle();

  if (error) return { error };
  if (data) return { profile: data as ProfileRecord };

  const { data: insertedProfile, error: insertError } = await dbClient
    .from("profiles")
    .insert([{ username, balance: toWholeDatabaseMoney(balance) }])
    .select("username,balance")
    .maybeSingle();

  if (insertError) return { error: insertError };

  return { profile: (insertedProfile as ProfileRecord | null) ?? null };
}

async function insertNotification(
  dbClient: SupabaseClient,
  username: string,
  message: string
) {
  await dbClient
    .from("notifications")
    .insert([{ username, message }])
    .throwOnError();
}

async function updateMetricsForTarget(
  dbClient: SupabaseClient,
  hasServiceRole: boolean,
  body: AdminActionBody,
  metrics: { balance: number; reserve: number; income: number }
) {
  const userId = readText(body.userId);
  const username = readText(body.username);
  const targetUser = await findTargetUser(dbClient, hasServiceRole, userId, username);
  const resolvedUsername = getUsernameFromUser(targetUser) || username;

  if (!resolvedUsername) {
    return { error: jsonError("Select a target user", 400) };
  }

  const existingProfile = await getProfileByUsername(dbClient, resolvedUsername);
  const profileResult = await updateTargetProfileBalance(
    dbClient,
    resolvedUsername,
    metrics.balance
  );

  if (profileResult.error && (existingProfile || !hasServiceRole || !targetUser)) {
    return { error: jsonError(profileResult.error.message, 500) };
  }

  await updateTargetMetadata(dbClient, hasServiceRole, targetUser, metrics);

  const profile = await getProfileByUsername(dbClient, resolvedUsername);

  return {
    user: {
      ...buildAdminUser(
        targetUser,
        profile ?? { username: resolvedUsername, balance: metrics.balance }
      ),
      balance: metrics.balance,
      reserve: metrics.reserve,
      income: metrics.income,
    },
  };
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if ("error" in admin) return admin.error;

  const profiles = await getProfilesByUsername(admin.dbClient);
  const authUsers = await getAuthUsers(admin.dbClient, admin.hasServiceRole);
  const profilesByUsername = new Map(
    profiles.map((profile) => [readText(profile.username), profile])
  );

  const usersByUsername = new Map<string, ReturnType<typeof buildAdminUser>>();

  authUsers.forEach((user) => {
    const username = getUsernameFromUser(user);
    if (!username) return;

    usersByUsername.set(
      username,
      buildAdminUser(user, profilesByUsername.get(username))
    );
  });

  profiles.forEach((profile) => {
    const username = readText(profile.username);
    if (!username || usersByUsername.has(username)) return;

    usersByUsername.set(username, buildAdminUser(null, profile));
  });

  const users = [...usersByUsername.values()].sort((first, second) =>
    first.fullName.localeCompare(second.fullName)
  );

  return NextResponse.json({
    ok: true,
    users,
    serviceRoleConfigured: admin.hasServiceRole,
  });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if ("error" in admin) return admin.error;

  const body = (await request.json().catch(() => null)) as AdminActionBody | null;
  const action = readText(body?.action);

  if (!body || !action) {
    return jsonError("Missing admin action", 400);
  }

  const userId = readText(body.userId);
  const username = readText(body.username);

  if (!userId && !username) {
    return jsonError("Select a target user", 400);
  }

  const targetUser = await findTargetUser(
    admin.dbClient,
    admin.hasServiceRole,
    userId,
    username
  );
  const resolvedUsername = getUsernameFromUser(targetUser) || username;
  const targetProfile = resolvedUsername
    ? await getProfileByUsername(admin.dbClient, resolvedUsername)
    : null;
  const target = buildAdminUser(targetUser, targetProfile ?? { username: resolvedUsername });

  if (!target.username) {
    return jsonError("Target user not found", 404);
  }

  if (action === "updateMetrics") {
    const nextMetrics = {
      balance: readNonNegativeNumber(body.balance, target.balance),
      reserve: readNonNegativeNumber(body.reserve, target.reserve),
      income: readNonNegativeNumber(body.income, target.income),
    };

    const result = await updateMetricsForTarget(
      admin.dbClient,
      admin.hasServiceRole,
      body,
      nextMetrics
    );

    if ("error" in result) return result.error;

    await insertNotification(
      admin.dbClient,
      result.user.username,
      `Admin updated account metrics. Available balance is $${nextMetrics.balance.toLocaleString("en-US")}.`
    ).catch(() => {});

    return NextResponse.json({ ok: true, user: result.user });
  }

  if (action === "postTransaction") {
    const amount = readFiniteNumber(body.amount);

    if (!amount || amount === 0) {
      return jsonError("Enter a valid transaction amount", 400);
    }

    const nextBalance = Math.max(target.balance + amount, 0);
    const nextMetrics = {
      balance: nextBalance,
      reserve: target.reserve,
      income: target.income,
    };
    const result = await updateMetricsForTarget(
      admin.dbClient,
      admin.hasServiceRole,
      body,
      nextMetrics
    );

    if ("error" in result) return result.error;

    const absAmount = Math.abs(amount);
    const entryName = readText(body.name) || "Admin transaction";
    const entryType = readText(body.type) || "Administrative posting";
    const method = readText(body.method) || "Aurex Admin";

    try {
      await admin.dbClient
        .from("transfers")
        .insert([
          {
            sender: amount < 0 ? result.user.username : "Aurex Admin",
            receiver: amount < 0 ? "Aurex Admin" : result.user.username,
            amount: toDatabaseCents(absAmount),
            type: entryType,
            account_type: "admin:cents",
            bank_name: method,
          },
        ])
        .throwOnError();
    } catch {}

    await insertNotification(
      admin.dbClient,
      result.user.username,
      `${entryName}: ${amount >= 0 ? "+" : "-"}$${absAmount.toLocaleString("en-US")} posted by Aurex Admin.`
    ).catch(() => {});

    return NextResponse.json({ ok: true, user: result.user });
  }

  if (action === "publishAlert") {
    const title = readText(body.title) || "Admin alert";
    const desc =
      readText(body.desc) || "Aurex operations published an account update.";

    await insertNotification(admin.dbClient, target.username, `${title}: ${desc}`);

    return NextResponse.json({ ok: true, user: target });
  }

  if (action === "controlAccount") {
    const accountStatus = readText(body.accountStatus).toLowerCase();
    const verificationStatus = readText(body.verificationStatus).toLowerCase();
    const nextAccountStatus =
      accountStatus === "suspended" || accountStatus === "pending"
        ? accountStatus
        : "active";
    const nextVerificationStatus =
      verificationStatus === "approved" || verificationStatus === "rejected"
        ? verificationStatus
        : "pending";
    const nextTransferFrozen =
      typeof body.transferFrozen === "boolean"
        ? body.transferFrozen
        : target.transferFrozen;

    const result = await updateTargetControls(
      admin.dbClient,
      admin.hasServiceRole,
      targetUser,
      {
        accountStatus: nextAccountStatus,
        transferFrozen: nextTransferFrozen,
        verificationStatus: nextVerificationStatus,
      }
    );

    if ("error" in result) return result.error;

    const profile = await getProfileByUsername(admin.dbClient, target.username);
    const nextUser = buildAdminUser(result.user, profile ?? { username: target.username });

    await insertNotification(
      admin.dbClient,
      nextUser.username,
      `Admin updated account controls. Status: ${nextAccountStatus}. Transfers ${
        nextTransferFrozen ? "frozen" : "active"
      }. Verification: ${nextVerificationStatus}.`
    ).catch(() => {});

    return NextResponse.json({ ok: true, user: nextUser });
  }

  if (action === "resetDemoData") {
    const nextMetrics = {
      balance: STARTING_BALANCE,
      reserve: STARTING_RESERVE,
      income: STARTING_INCOME,
    };
    const result = await updateMetricsForTarget(
      admin.dbClient,
      admin.hasServiceRole,
      body,
      nextMetrics
    );

    if ("error" in result) return result.error;

    await insertNotification(
      admin.dbClient,
      result.user.username,
      "Aurex Admin reset account metrics."
    ).catch(() => {});

    return NextResponse.json({ ok: true, user: result.user });
  }

  return jsonError("Unknown admin action", 400);
}
