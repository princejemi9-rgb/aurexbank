"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";

import { supabase } from "../lib/supabase";
import { accountTransferFilter } from "../lib/supabaseFilters";

export type BankAlert = {
  id: string;
  type: "Payment" | "Security" | "Crypto" | "Transfer" | "Savings";
  title: string;
  desc: string;
  time: string;
  status: string;
  unread: boolean;
};

export type BankTransaction = {
  id: string;
  name: string;
  type: string;
  amount: number;
  status: string;
  time: string;
  method: string;
};

export type BankingProfile = {
  userId: string;
  username: string;
  fullName: string;
  firstName: string;
  email: string;
  phone: string;
  country: string;
  accountType: string;
  currency: string;
  customerId: string;
  initials: string;
  avatar_url?: string;
};

type AccountStatus = "active" | "suspended";

type TransferInput = {
  transferType: string;
  accountType: string;
  receiver: string;
  amount: number;
  transferAmount?: number;
  fee?: number;
  totalDebit?: number;
  reference?: string;
  bankName?: string;
  accountNumber?: string;
  routingNumber?: string;
  recipientAccountType?: string;
  swift?: string;
  wallet?: string;
  memo?: string;
  recipientAddress?: string;
  wireCountry?: string;
  wireCurrency?: string;
  transferPurpose?: string;
};

type AdminMetricsInput = {
  balance?: number;
  reserve?: number;
  income?: number;
};

type AdminTransactionInput = {
  name: string;
  type: string;
  amount: number;
  status: string;
  method: string;
};

type AdminAlertInput = {
  type: BankAlert["type"];
  title: string;
  desc: string;
  status: string;
  unread: boolean;
};

type RemoteNotificationRecord = {
  id?: string | number;
  message?: string | null;
  created_at?: string | null;
};

type RemoteTransferResponse = {
  ok?: boolean;
  error?: string;
  balance?: number;
  balanceBefore?: number;
  transactionId?: string;
  transferAmount?: number;
  fee?: number;
  totalDebit?: number;
  receiverCredited?: boolean;
};

type RemoteAccountMetrics = {
  ok?: boolean;
  balance?: number;
  reserve?: number;
  income?: number;
};

type BankingContextValue = {
  balance: number;
  reserve: number;
  income: number;
  expenses: number;
  accountStatus: AccountStatus;
  transferFrozen: boolean;
  verificationStatus: string;
  currentUser: string;
  currentProfile: BankingProfile;
  alerts: BankAlert[];
  transactions: BankTransaction[];
  unreadCount: number;
  refreshBanking: () => Promise<void>;
  submitTransfer: (input: TransferInput) => Promise<{ ok: boolean; message: string }>;
  updateAdminMetrics: (input: AdminMetricsInput) => Promise<void>;
  addAdminTransaction: (input: AdminTransactionInput) => Promise<void>;
  addAdminAlert: (input: AdminAlertInput) => void;
  resetAdminData: () => Promise<void>;
  markAlertsRead: () => void;
};

const STARTING_BALANCE = 0;
const STARTING_RESERVE = 0;
const STARTING_INCOME = 0;
const FALLBACK_PROFILE: BankingProfile = {
  userId: "pending",
  username: "Aurex User",
  fullName: "Aurex User",
  firstName: "Aurex User",
  email: "user@aurexbank.demo",
  phone: "Not provided",
  country: "Not provided",
  accountType: "personal",
  currency: "USD",
  customerId: "ARX-PENDING",
  initials: "A",
  avatar_url: undefined,
};

const seedTransactions: BankTransaction[] = [
  {
    id: "legacy-2026-capital-distribution",
    name: "Crestline Capital Partners",
    type: "Investment Distribution",
    amount: 2850000,
    status: "Completed",
    time: "Jun 28, 2026",
    method: "Private Banking Wire",
  },
  {
    id: "legacy-2026-property-acquisition",
    name: "Meridian Property Group",
    type: "Property Acquisition",
    amount: -1275000,
    status: "Completed",
    time: "Jun 19, 2026",
    method: "Aurex Escrow",
  },
  {
    id: "legacy-2026-advisory",
    name: "Northstar Holdings",
    type: "Advisory Settlement",
    amount: -640000,
    status: "Completed",
    time: "May 30, 2026",
    method: "International Wire",
  },
  {
    id: "legacy-2025-private-equity",
    name: "Atlantic Private Equity",
    type: "Fund Redemption",
    amount: 1900000,
    status: "Completed",
    time: "Nov 14, 2025",
    method: "SWIFT Priority",
  },
  {
    id: "legacy-2025-family-office",
    name: "Westbridge Family Office",
    type: "Treasury Allocation",
    amount: -875000,
    status: "Completed",
    time: "Jan 24, 2025",
    method: "Private Client Transfer",
  },
  {
    id: "legacy-2024-commercial-exit",
    name: "Arden Commercial Ventures",
    type: "Business Exit Proceeds",
    amount: 3420000,
    status: "Completed",
    time: "Aug 8, 2024",
    method: "Institutional Clearing",
  },
  {
    id: "legacy-2023-estate",
    name: "Belgrave Estates",
    type: "Real Estate Settlement",
    amount: -1180000,
    status: "Completed",
    time: "Mar 16, 2023",
    method: "Aurex Escrow",
  },
  {
    id: "legacy-2022-dividend",
    name: "Sterling Infrastructure Fund",
    type: "Annual Dividend",
    amount: 760000,
    status: "Completed",
    time: "Dec 2, 2022",
    method: "Custody Account",
  },
  {
    id: "legacy-2021-acquisition",
    name: "Horizon Technology Group",
    type: "Strategic Acquisition",
    amount: -2150000,
    status: "Completed",
    time: "Sep 10, 2021",
    method: "Institutional Wire",
  },
  {
    id: "legacy-2020-liquidity",
    name: "Crown Liquidity Fund",
    type: "Portfolio Redemption",
    amount: 1650000,
    status: "Completed",
    time: "Jul 6, 2020",
    method: "Private Banking Wire",
  },
  {
    id: "legacy-2019-investment",
    name: "Oakmont Growth Fund",
    type: "Series C Investment",
    amount: -925000,
    status: "Completed",
    time: "Oct 21, 2019",
    method: "Capital Call",
  },
  {
    id: "legacy-2018-opening",
    name: "Founders Equity Trust",
    type: "Opening Portfolio Transfer",
    amount: 2400000,
    status: "Completed",
    time: "Apr 12, 2018",
    method: "Wealth Transfer",
  },
];
const retiredDemoTransactionIds = new Set([
  "seed-netflix",
  "seed-salary",
  "seed-apple",
]);

const seedAlerts: BankAlert[] = [
  {
    id: "seed-payment",
    type: "Payment",
    title: "Capital distribution settled",
    desc: "$2,850,000 credited to Aurex Checking",
    time: "Jun 28",
    status: "Completed",
    unread: true,
  },
  {
    id: "seed-security",
    type: "Security",
    title: "New login detected",
    desc: "Windows device signed into your account",
    time: "18 mins ago",
    status: "Secure",
    unread: true,
  },
  {
    id: "seed-crypto",
    type: "Crypto",
    title: "Bitcoin price alert",
    desc: "BTC moved above $68,000",
    time: "35 mins ago",
    status: "Market",
    unread: false,
  },
  {
    id: "seed-savings",
    type: "Savings",
    title: "Savings milestone reached",
    desc: "72% of Dubai savings goal completed",
    time: "3 hours ago",
    status: "Goal",
    unread: false,
  },
];

const BankingContext = createContext<BankingContextValue | null>(null);
const REMOTE_OPERATION_TIMEOUT_MS = 8000;
const ADMIN_ALERT_PREFIX = "__AUREX_ALERT__:";
const ADMIN_TRANSACTION_PREFIX = "__AUREX_TX__:";

function formatMoney(value: number) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

async function withRemoteTimeout<T>(
  operation: PromiseLike<T>,
  timeoutMs = REMOTE_OPERATION_TIMEOUT_MS
) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      Promise.resolve(operation),
      new Promise<T>((_resolve, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("Remote operation timed out")),
          timeoutMs
        );
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function getStorageKey(userId: string, key: string) {
  return `aurexbank:${userId}:${key}`;
}

function getProfileCacheKey(userId: string) {
  return getStorageKey(userId, "profile");
}

function readStoredProfile(userId: string) {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.localStorage.getItem(getProfileCacheKey(userId));
    return stored ? (JSON.parse(stored) as Partial<BankingProfile>) : null;
  } catch {
    return null;
  }
}

function storeProfile(profile: BankingProfile) {
  if (typeof window === "undefined" || profile.userId === FALLBACK_PROFILE.userId) return;

  window.localStorage.setItem(getProfileCacheKey(profile.userId), JSON.stringify(profile));
}

function getStoredBalance() {
  return STARTING_BALANCE;
}

function readStoredNumber(userId: string, key: string) {
  if (typeof window === "undefined") return null;

  const stored = window.localStorage.getItem(getStorageKey(userId, key));
  if (!stored) return null;

  const value = Number(stored);
  return Number.isFinite(value) ? value : null;
}

function getStoredNumber(userId: string, key: string, fallback: number) {
  return readStoredNumber(userId, key) ?? fallback;
}

function getStoredItems<T>(userId: string, key: string, fallback: T[]) {
  if (typeof window === "undefined") return fallback;

  const stored = window.localStorage.getItem(getStorageKey(userId, key));
  return stored ? (JSON.parse(stored) as T[]) : fallback;
}

function mergeTransactionHistory(transactions: BankTransaction[]) {
  const currentTransactions = transactions.filter(
    (transaction) => !retiredDemoTransactionIds.has(transaction.id)
  );
  const transactionIds = new Set(
    currentTransactions.map((transaction) => transaction.id)
  );

  return [
    ...currentTransactions,
    ...seedTransactions.filter((transaction) => !transactionIds.has(transaction.id)),
  ].slice(0, 24);
}

function mergeAlertHistory(alerts: BankAlert[]) {
  const seedAlertIds = new Set(seedAlerts.map((alert) => alert.id));
  const storedById = new Map(alerts.map((alert) => [alert.id, alert]));
  const currentAlerts = alerts.filter((alert) => !seedAlertIds.has(alert.id));

  return [
    ...currentAlerts,
    ...seedAlerts.map((alert) => ({
      ...alert,
      unread: storedById.get(alert.id)?.unread ?? alert.unread,
    })),
  ].slice(0, 12);
}

function titleCaseName(value: string) {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isPlaceholderText(value: string) {
  const normalized = value.trim().toLowerCase();
  return (
    !normalized ||
    normalized === "client" ||
    normalized === "aurex user" ||
    normalized === "aurex bank client"
  );
}

function chooseProfileText(nextValue: string, currentValue: string) {
  if (!isPlaceholderText(nextValue)) return nextValue;
  if (!isPlaceholderText(currentValue)) return currentValue;
  return nextValue || currentValue;
}

function mergeStableProfile(current: BankingProfile, next: BankingProfile) {
  if (
    next.userId === FALLBACK_PROFILE.userId ||
    current.userId !== next.userId ||
    current.userId === FALLBACK_PROFILE.userId
  ) {
    return next;
  }

  return {
    ...next,
    username: chooseProfileText(next.username, current.username),
    fullName: chooseProfileText(next.fullName, current.fullName),
    firstName: chooseProfileText(next.firstName, current.firstName),
    phone: next.phone === "Not provided" ? current.phone : next.phone,
    country: next.country === "Not provided" ? current.country : next.country,
    accountType: next.accountType || current.accountType,
    currency: next.currency || current.currency,
    initials: chooseProfileText(next.initials, current.initials),
    avatar_url: next.avatar_url ?? current.avatar_url,
  };
}

function setStableProfile(
  setCurrentProfile: React.Dispatch<React.SetStateAction<BankingProfile>>,
  nextProfile: BankingProfile
) {
  setCurrentProfile((currentProfile) => {
    const stableProfile = mergeStableProfile(currentProfile, nextProfile);
    storeProfile(stableProfile);
    return stableProfile;
  });
}

function readFiniteNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function readNonNegativeNumber(value: unknown) {
  const numberValue = readFiniteNumber(value);
  return numberValue === null ? null : Math.max(numberValue, 0);
}

function toWholeDatabaseMoney(value: number) {
  return Math.round(value);
}

function readMetadataBalance(user: User | null) {
  if (!user) return null;
  return readFiniteNumber(user.user_metadata?.balance);
}

function readMetadataNonNegativeNumber(user: User | null, key: string) {
  if (!user) return null;
  return readNonNegativeNumber(user.user_metadata?.[key]);
}

function readAccountStatus(user: User | null): AccountStatus {
  return user?.user_metadata?.account_status === "suspended" ? "suspended" : "active";
}

function readTransferFrozen(user: User | null) {
  return user?.user_metadata?.transfer_frozen === true;
}

function readVerificationStatus(user: User | null) {
  const value = user?.user_metadata?.verification_status;
  return typeof value === "string" && value.length ? value : "pending";
}

function formatRemoteAlertTime(value: string | null | undefined) {
  if (!value) return "Live";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Live";

  return date.toLocaleString([], {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  });
}

function inferRemoteAlertType(message: string): BankAlert["type"] {
  const normalized = message.toLowerCase();

  if (normalized.includes("transfer") || normalized.includes("sent")) return "Transfer";
  if (normalized.includes("payment") || normalized.includes("credited")) return "Payment";
  if (normalized.includes("security") || normalized.includes("login")) return "Security";
  if (normalized.includes("crypto") || normalized.includes("btc")) return "Crypto";
  return "Savings";
}

function parseAdminAlertMessage(
  message: string,
  record: RemoteNotificationRecord
): BankAlert | null {
  if (!message.startsWith(ADMIN_ALERT_PREFIX)) return null;

  try {
    const payload = JSON.parse(
      message.slice(ADMIN_ALERT_PREFIX.length)
    ) as Record<string, unknown>;
    const allowedTypes: BankAlert["type"][] = [
      "Payment",
      "Security",
      "Crypto",
      "Transfer",
      "Savings",
    ];
    const type = allowedTypes.includes(payload.type as BankAlert["type"])
      ? (payload.type as BankAlert["type"])
      : "Security";

    return {
      id: `remote-notification-${String(record.id ?? message)}`,
      type,
      title: readText(payload.title) || "Admin alert",
      desc: readText(payload.desc) || "Aurex operations published an account update.",
      time: formatRemoteAlertTime(record.created_at),
      status: readText(payload.status) || "Updated",
      unread: typeof payload.unread === "boolean" ? payload.unread : true,
    };
  } catch {
    return null;
  }
}

function parseAdminTransactionDetails(value: unknown) {
  const text = readText(value);
  if (!text.startsWith(ADMIN_TRANSACTION_PREFIX)) return null;

  try {
    const payload = JSON.parse(
      text.slice(ADMIN_TRANSACTION_PREFIX.length)
    ) as Record<string, unknown>;

    return {
      name: readText(payload.name),
      status: readText(payload.status),
      method: readText(payload.method),
    };
  } catch {
    return null;
  }
}

function mapRemoteNotification(record: RemoteNotificationRecord): BankAlert | null {
  const message = readText(record.message);
  if (!message) return null;

  const adminAlert = parseAdminAlertMessage(message, record);
  if (adminAlert) return adminAlert;

  return {
    id: `remote-notification-${String(record.id ?? message)}`,
    type: inferRemoteAlertType(message),
    title: "Account notification",
    desc: message,
    time: formatRemoteAlertTime(record.created_at),
    status: "Live",
    unread: true,
  };
}

function mergeAlertsWithRemote(localAlerts: BankAlert[], remoteAlerts: BankAlert[]) {
  const uniqueRemoteAlerts = remoteAlerts.filter((remoteAlert) => {
    return !localAlerts.some((localAlert) => {
      return (
        localAlert.desc.includes(remoteAlert.desc) ||
        remoteAlert.desc.includes(localAlert.desc)
      );
    });
  });
  const localById = new Map(localAlerts.map((alert) => [alert.id, alert]));
  const remoteIds = new Set(uniqueRemoteAlerts.map((alert) => alert.id));
  const mergedRemoteAlerts = uniqueRemoteAlerts.map((alert) => {
    const existing = localById.get(alert.id);
    return existing ? { ...alert, unread: existing.unread } : alert;
  });

  return [
    ...mergedRemoteAlerts,
    ...localAlerts.filter((alert) => !remoteIds.has(alert.id)),
  ].slice(0, 12);
}

async function getRemoteAlerts(username: string, localAlerts: BankAlert[]) {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, message, created_at")
    .eq("username", username)
    .order("created_at", { ascending: false })
    .limit(8);

  if (error || !data?.length) return localAlerts;

  const remoteAlerts = (data as RemoteNotificationRecord[])
    .map(mapRemoteNotification)
    .filter((alert): alert is BankAlert => Boolean(alert));

  return mergeAlertsWithRemote(localAlerts, remoteAlerts);
}

async function saveRemoteBalance(value: number) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token = session?.access_token;
  if (!token) return false;

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    REMOTE_OPERATION_TIMEOUT_MS
  );

  try {
    const response = await fetch("/api/account/balance", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ balance: value }),
      signal: controller.signal,
    });

    const data = (await response.json().catch(() => null)) as
      | { ok?: boolean }
      | null;

    return response.ok && data?.ok === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getRemoteAccountMetrics() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token = session?.access_token;
  if (!token) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    REMOTE_OPERATION_TIMEOUT_MS
  );

  try {
    const response = await fetch("/api/account/balance", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      signal: controller.signal,
    });
    const data = (await response.json().catch(() => null)) as
      | RemoteAccountMetrics
      | null;

    return response.ok && data?.ok === true ? data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function saveRemoteTransfer(input: TransferInput) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token = session?.access_token;
  if (!token) {
    return {
      ok: false,
      error: "Missing banking session. Sign in again.",
    } satisfies RemoteTransferResponse;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    REMOTE_OPERATION_TIMEOUT_MS
  );

  try {
    const response = await fetch("/api/transfers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
      signal: controller.signal,
    });

    const data = (await response.json().catch(() => null)) as
      | RemoteTransferResponse
      | null;

    if (!response.ok || data?.ok !== true) {
      return {
        ok: false,
        error: data?.error || "Unable to save transfer.",
        balance: data?.balance,
      } satisfies RemoteTransferResponse;
    }

    return data;
  } catch {
    return {
      ok: false,
      error: "Unable to reach banking systems. Please try again.",
    } satisfies RemoteTransferResponse;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function ensureRemoteProfile(profile: BankingProfile, balance: number) {
  if (profile.userId === FALLBACK_PROFILE.userId) return;

  const row = {
    username: profile.username,
    balance: toWholeDatabaseMoney(balance),
  };

  const { error } = await supabase
    .from("profiles")
    .upsert(row, { onConflict: "username" });

  if (!error) return;

  await supabase.from("profiles").insert([row]);
}

function cleanFirstName(value: string, lastName = "") {
  const firstToken = value.trim().split(/[\s._-]+/)[0] ?? "";
  let cleaned = firstToken.replace(/\d+$/g, "");
  const cleanedLastName = lastName.trim().replace(/\d+$/g, "").toLowerCase();
  const lowerCleaned = cleaned.toLowerCase();

  if (
    cleanedLastName &&
    lowerCleaned.endsWith(cleanedLastName) &&
    lowerCleaned.length > cleanedLastName.length
  ) {
    cleaned = cleaned.slice(0, -cleanedLastName.length);
  }

  const normalized = cleaned.toLowerCase();
  if (normalized.startsWith("prince") && normalized["prince".length] !== "s") {
    cleaned = cleaned.slice(0, "prince".length);
  }

  return titleCaseName(cleaned);
}

function buildProfile(user: User | null): BankingProfile {
  if (!user) return FALLBACK_PROFILE;

  const metadata = user.user_metadata ?? {};
  const cachedProfile = readStoredProfile(user.id);
  const metadataFirstName = readText(metadata.first_name);
  const lastName = readText(metadata.last_name);
  const metadataFullName = readText(metadata.full_name);
  const avatar_url =
    readText(metadata.avatar_url) || cachedProfile?.avatar_url || undefined;

  const email = user.email ?? cachedProfile?.email ?? FALLBACK_PROFILE.email;
  const emailName = email.split("@")[0] || "aurex-user";
  const cachedFullName = readText(cachedProfile?.fullName);
  const fullName =
    metadataFullName ||
    `${metadataFirstName} ${lastName}`.trim() ||
    cachedFullName ||
    emailName;
  const username = readText(metadata.username) || readText(cachedProfile?.username) || emailName;
  const displayFirstName =
    metadataFirstName ||
    fullName.split(" ")[0] ||
    readText(cachedProfile?.firstName) ||
    username;
  const firstName = cleanFirstName(displayFirstName, lastName) || displayFirstName;
  const safeFirstName = isPlaceholderText(firstName)
    ? readText(cachedProfile?.firstName) || FALLBACK_PROFILE.firstName
    : firstName;
  const safeFullName = isPlaceholderText(fullName)
    ? readText(cachedProfile?.fullName) || safeFirstName
    : fullName;
  const initials = safeFullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || username.slice(0, 1).toUpperCase();

  return {
    userId: user.id,
    username,
    fullName: safeFullName,
    // Dashboard should show the person's first name after account creation.
    // If metadata is partial, fall back to the last known good profile before using a neutral label.
    firstName: safeFirstName || safeFullName || FALLBACK_PROFILE.firstName,
    email,
    phone: readText(metadata.phone) || readText(cachedProfile?.phone) || "Not provided",
    country: readText(metadata.country) || readText(cachedProfile?.country) || "Not provided",
    accountType:
      readText(metadata.account_type) || readText(cachedProfile?.accountType) || "personal",
    currency:
      readText(metadata.currency).toUpperCase() ||
      readText(cachedProfile?.currency).toUpperCase() ||
      "USD",
    customerId: `ARX-${user.id.slice(0, 8).toUpperCase()}`,
    initials,
    avatar_url,
  };
}

export function BankingProvider({ children }: { children: React.ReactNode }) {
  const [currentProfile, setCurrentProfile] = useState(FALLBACK_PROFILE);
  const [balance, setBalance] = useState(() => getStoredBalance());
  const [accountStatus, setAccountStatus] = useState<AccountStatus>("active");
  const [transferFrozen, setTransferFrozen] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState("pending");
  const [reserve, setReserve] = useState(() =>
    getStoredNumber(FALLBACK_PROFILE.userId, "reserve", STARTING_RESERVE)
  );
  const [income, setIncome] = useState(() =>
    getStoredNumber(FALLBACK_PROFILE.userId, "income", STARTING_INCOME)
  );
  const [transactions, setTransactions] = useState<BankTransaction[]>(() =>
    getStoredItems(FALLBACK_PROFILE.userId, "transactions", seedTransactions)
  );
  const [alerts, setAlerts] = useState<BankAlert[]>(() =>
    getStoredItems(FALLBACK_PROFILE.userId, "alerts", seedAlerts)
  );

  const refreshBanking = useCallback(async () => {
    const authResult = await withRemoteTimeout(supabase.auth.getUser()).catch(() => null);
    const user = authResult?.data.user ?? null;

    const profileInfo = buildProfile(user);
    const username = profileInfo.username;
    const metadataBalance = readMetadataBalance(user);
    const metadataReserve = readMetadataNonNegativeNumber(user, "reserve");
    const metadataIncome = readMetadataNonNegativeNumber(user, "income");

    setStableProfile(setCurrentProfile, profileInfo);
    setAccountStatus(readAccountStatus(user));
    setTransferFrozen(readTransferFrozen(user));
    setVerificationStatus(readVerificationStatus(user));

    if (!user) {
      setBalance(getStoredBalance());
      setReserve(getStoredNumber(FALLBACK_PROFILE.userId, "reserve", STARTING_RESERVE));
      setIncome(getStoredNumber(FALLBACK_PROFILE.userId, "income", STARTING_INCOME));
      setTransactions(getStoredItems(FALLBACK_PROFILE.userId, "transactions", seedTransactions));
      setAlerts(getStoredItems(FALLBACK_PROFILE.userId, "alerts", seedAlerts));
      return;
    }

    const [{ data: profile }, remoteMetrics] = await Promise.all([
      supabase
        .from("profiles")
        .select("balance")
        .eq("username", username)
        .limit(1)
        .maybeSingle(),
      getRemoteAccountMetrics(),
    ]);

    const profileBalance = readFiniteNumber(profile?.balance);
    const remoteBalance = readNonNegativeNumber(remoteMetrics?.balance);
    const remoteReserve = readNonNegativeNumber(remoteMetrics?.reserve);
    const remoteIncome = readNonNegativeNumber(remoteMetrics?.income);
    // The profiles ledger is updated by admin actions and transfers. Auth
    // metadata is retained as a fallback for older accounts, but can remain
    // stale in an already-issued session.
    const resolvedBalance =
      remoteBalance ?? profileBalance ?? metadataBalance ?? STARTING_BALANCE;
    const storedAlerts = mergeAlertHistory(
      getStoredItems(profileInfo.userId, "alerts", seedAlerts)
    );
    const storedTransactions = mergeTransactionHistory(
      getStoredItems(profileInfo.userId, "transactions", seedTransactions)
    );

    setBalance(resolvedBalance);
    setReserve(
      remoteReserve ??
        metadataReserve ??
        getStoredNumber(profileInfo.userId, "reserve", STARTING_RESERVE)
    );
    setIncome(
      remoteIncome ??
        metadataIncome ??
        getStoredNumber(profileInfo.userId, "income", STARTING_INCOME)
    );
    setTransactions(storedTransactions);
    setAlerts(storedAlerts);

    if (profileBalance !== null && metadataBalance === null) {
      await saveRemoteBalance(profileBalance).catch(() => {});
    }

    if (profileBalance === null) {
      await ensureRemoteProfile(profileInfo, resolvedBalance).catch(() => {});
    }

    const remoteAlerts = await getRemoteAlerts(username, storedAlerts).catch(() => storedAlerts);
    setAlerts(remoteAlerts);

    const { data: transferData } = await supabase
      .from("transfers")
      .select("id, sender, receiver, amount, type, account_type, bank_name, created_at")
      .or(accountTransferFilter(username))
      .order("created_at", { ascending: false })
      .limit(12);

    if (transferData?.length) {
      const mapped = transferData.map((item) => {
        const sent = item.sender === username;
        const accountType = String(item.account_type ?? "");
        const rawAmount = Number(item.amount);
        const amount = accountType.endsWith(":cents") ? rawAmount / 100 : rawAmount;
        const adminDetails = parseAdminTransactionDetails(item.bank_name);
        return {
          id: String(item.id),
          name:
            adminDetails?.name ||
            (sent ? String(item.receiver) : String(item.sender)),
          type: `${String(item.type ?? "Transfer")} transfer`,
          amount: sent ? -amount : amount,
          status: adminDetails?.status || "Completed",
          time: item.created_at
            ? new Date(String(item.created_at)).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "Live",
          method:
            adminDetails?.method ||
            (item.bank_name ? String(item.bank_name) : "Aurex Secure"),
        };
      });

      setTransactions(mergeTransactionHistory(mapped));
    }
  }, []);

  useEffect(() => {
    let active = true;

    const scheduleRefresh = () => {
      window.setTimeout(() => {
        if (active) {
          refreshBanking();
        }
      }, 0);
    };

    const timer = window.setTimeout(() => {
      if (active) {
        refreshBanking();
      }
    }, 0);
    const refreshInterval = window.setInterval(() => {
      if (active && document.visibilityState === "visible") {
        refreshBanking();
      }
    }, 15000);
    const refreshOnFocus = () => {
      if (active) {
        refreshBanking();
      }
    };
    const refreshOnVisibility = () => {
      if (active && document.visibilityState === "visible") {
        refreshBanking();
      }
    };

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnVisibility);

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setStableProfile(setCurrentProfile, buildProfile(session.user));
        setAccountStatus(readAccountStatus(session.user));
        setTransferFrozen(readTransferFrozen(session.user));
        setVerificationStatus(readVerificationStatus(session.user));
      } else {
        setAccountStatus("active");
        setTransferFrozen(false);
        setVerificationStatus("pending");
      }

      scheduleRefresh();
    });

    const profileChannel = supabase
      .channel("banking-profile-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => refreshBanking()
      )
      .subscribe();

    const transferChannel = supabase
      .channel("banking-transfer-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transfers" },
        () => refreshBanking()
      )
      .subscribe();

    const notificationChannel = supabase
      .channel("banking-notification-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => refreshBanking()
      )
      .subscribe();

    return () => {
      active = false;
      window.clearTimeout(timer);
      window.clearInterval(refreshInterval);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnVisibility);
      authListener.subscription.unsubscribe();
      supabase.removeChannel(profileChannel);
      supabase.removeChannel(transferChannel);
      supabase.removeChannel(notificationChannel);
    };
  }, [refreshBanking]);

  useEffect(() => {
    window.localStorage.setItem(getStorageKey(currentProfile.userId, "reserve"), String(reserve));
  }, [currentProfile.userId, reserve]);

  useEffect(() => {
    window.localStorage.setItem(getStorageKey(currentProfile.userId, "income"), String(income));
  }, [currentProfile.userId, income]);

  useEffect(() => {
    window.localStorage.setItem(getStorageKey(currentProfile.userId, "transactions"), JSON.stringify(transactions));
  }, [currentProfile.userId, transactions]);

  useEffect(() => {
    window.localStorage.setItem(getStorageKey(currentProfile.userId, "alerts"), JSON.stringify(alerts));
  }, [alerts, currentProfile.userId]);

  const submitTransfer = useCallback(async (input: TransferInput) => {
    const debitAmount = input.totalDebit ?? input.amount;
    const sentAmount =
      input.transferAmount ?? Math.max(debitAmount - (input.fee ?? 0), 0);
    const feeAmount = input.fee ?? Math.max(debitAmount - sentAmount, 0);

    if (!debitAmount || debitAmount <= 0 || !sentAmount || sentAmount <= 0) {
      return { ok: false, message: "Enter a valid transfer amount." };
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const metadata = user?.user_metadata ?? {};

    if (metadata.account_status === "suspended") {
      return { ok: false, message: "Account is suspended. Contact Aurex support." };
    }

    if (metadata.transfer_frozen === true) {
      return { ok: false, message: "Transfers are frozen for this account." };
    }

    if (metadata.verification_status === "rejected") {
      return { ok: false, message: "Account verification must be approved before transfers." };
    }

    const receiver =
      input.receiver ||
      input.accountNumber ||
      input.swift ||
      input.wallet ||
      "External account";
    let availableBalance = balance;
    let nextBalance = Math.max(availableBalance - debitAmount, 0);
    let transactionId = `local-${Date.now()}`;

    if (user) {
      const remoteTransfer = await saveRemoteTransfer({
        ...input,
        amount: debitAmount,
        transferAmount: sentAmount,
        fee: feeAmount,
        totalDebit: debitAmount,
      });

      if (remoteTransfer.ok !== true) {
        const serverBalance = readFiniteNumber(remoteTransfer.balance);

        if (serverBalance !== null) {
          setBalance(serverBalance);
        }

        return {
          ok: false,
          message: remoteTransfer.error || "Unable to complete transfer.",
        };
      }

      availableBalance = readFiniteNumber(remoteTransfer.balanceBefore) ?? balance;
      nextBalance =
        readFiniteNumber(remoteTransfer.balance) ??
        Math.max(availableBalance - debitAmount, 0);
      transactionId = remoteTransfer.transactionId || transactionId;
    } else if (availableBalance < debitAmount) {
      setBalance(availableBalance);
      return { ok: false, message: "Insufficient available balance." };
    }

    const transferLabel = input.transferType || "transfer";
    const title = `${transferLabel[0].toUpperCase()}${transferLabel.slice(1)} transfer sent`;
    const money = `$${formatMoney(sentAmount)}`;

    setBalance(nextBalance);
    setTransactions((current) => [
      {
        id: transactionId,
        name: receiver,
        type: `${transferLabel} transfer`,
        amount: -debitAmount,
        status: "Completed",
        time: "Just now",
        method: input.bankName || input.accountType || "Aurex Secure",
      },
      ...current,
    ]);
    setAlerts((current) => [
      {
        id: `alert-${Date.now()}`,
        type: "Transfer",
        title,
        desc: `${money} sent to ${receiver}. New balance is $${formatMoney(nextBalance)}.`,
        time: "Just now",
        status: "Completed",
        unread: true,
      },
      ...current,
    ]);

    return {
      ok: true,
      message: "Transfer completed successfully.",
    };
  }, [balance]);

  const updateAdminMetrics = useCallback(async (input: AdminMetricsInput) => {
    const nextBalance = readNonNegativeNumber(input.balance);
    const nextReserve = readNonNegativeNumber(input.reserve);
    const nextIncome = readNonNegativeNumber(input.income);

    if (nextBalance !== null) {
      setBalance(nextBalance);
      await saveRemoteBalance(nextBalance).catch(() => {});

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await supabase
          .from("profiles")
          .update({ balance: toWholeDatabaseMoney(nextBalance) })
          .eq("username", buildProfile(user).username);
      }
    }

    if (nextReserve !== null) {
      setReserve(nextReserve);
      window.localStorage.setItem(
        getStorageKey(currentProfile.userId, "reserve"),
        String(nextReserve)
      );
    }

    if (nextIncome !== null) {
      setIncome(nextIncome);
      window.localStorage.setItem(
        getStorageKey(currentProfile.userId, "income"),
        String(nextIncome)
      );
    }
  }, [currentProfile.userId]);

  const addAdminTransaction = useCallback(async (input: AdminTransactionInput) => {
    if (!Number.isFinite(input.amount) || input.amount === 0) {
      return;
    }

    const transaction: BankTransaction = {
      id: `admin-transaction-${Date.now()}`,
      name: input.name,
      type: input.type,
      amount: input.amount,
      status: input.status,
      time: "Admin entry",
      method: input.method,
    };

    const nextBalance = Math.max(balance + input.amount, 0);

    setBalance(nextBalance);
    setTransactions((current) => [transaction, ...current].slice(0, 12));
    await saveRemoteBalance(nextBalance).catch(() => {});

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await supabase
        .from("profiles")
        .update({ balance: toWholeDatabaseMoney(nextBalance) })
        .eq("username", buildProfile(user).username);
    }
  }, [balance]);

  const addAdminAlert = useCallback((input: AdminAlertInput) => {
    const alert: BankAlert = {
      id: `admin-alert-${Date.now()}`,
      type: input.type,
      title: input.title,
      desc: input.desc,
      time: "Admin update",
      status: input.status,
      unread: input.unread,
    };

    setAlerts((current) => [alert, ...current].slice(0, 12));
  }, []);

  const resetAdminData = useCallback(async () => {
    setBalance(STARTING_BALANCE);
    setReserve(STARTING_RESERVE);
    setIncome(STARTING_INCOME);
    setTransactions(seedTransactions);
    setAlerts(seedAlerts);

    window.localStorage.setItem(
      getStorageKey(currentProfile.userId, "reserve"),
      String(STARTING_RESERVE)
    );
    window.localStorage.setItem(
      getStorageKey(currentProfile.userId, "income"),
      String(STARTING_INCOME)
    );
    window.localStorage.setItem(
      getStorageKey(currentProfile.userId, "transactions"),
      JSON.stringify(seedTransactions)
    );
    window.localStorage.setItem(
      getStorageKey(currentProfile.userId, "alerts"),
      JSON.stringify(seedAlerts)
    );

    await saveRemoteBalance(STARTING_BALANCE).catch(() => {});

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await supabase
        .from("profiles")
        .update({ balance: toWholeDatabaseMoney(STARTING_BALANCE) })
        .eq("username", buildProfile(user).username);
    }
  }, [currentProfile.userId]);

  function markAlertsRead() {
    setAlerts((current) => current.map((item) => ({ ...item, unread: false })));
  }

  const value = useMemo(
    () => ({
      balance,
      reserve,
      income,
      expenses: Math.abs(
        transactions
          .filter((item) => item.amount < 0)
          .reduce((total, item) => total + item.amount, 0)
      ),
      accountStatus,
      transferFrozen,
      verificationStatus,
      currentUser: currentProfile.firstName,
      currentProfile,
      alerts,
      transactions,
      unreadCount: alerts.filter((item) => item.unread).length,
      refreshBanking,
      submitTransfer,
      updateAdminMetrics,
      addAdminTransaction,
      addAdminAlert,
      resetAdminData,
      markAlertsRead,
    }),
    [
      addAdminAlert,
      addAdminTransaction,
      accountStatus,
      alerts,
      balance,
      currentProfile,
      income,
      refreshBanking,
      reserve,
      resetAdminData,
      submitTransfer,
      transactions,
      transferFrozen,
      updateAdminMetrics,
      verificationStatus,
    ]
  );

  return (
    <BankingContext.Provider value={value}>{children}</BankingContext.Provider>
  );
}

export function useBanking() {
  const context = useContext(BankingContext);

  if (!context) {
    throw new Error("useBanking must be used within BankingProvider");
  }

  return context;
}
