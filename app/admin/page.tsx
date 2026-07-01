"use client";

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import AdminGate from "../../src/components/auth/AdminGate";
import DesktopSidebar from "../../src/components/layout/DesktopSidebar";
import BottomNav from "../../src/components/navigation/BottomNav";
import AppIcon from "../../src/components/ui/AppIcon";
import AurexBrand from "../../src/components/brand/AurexBrand";
import { PrivateAmount } from "../../src/components/ui/PrivateAmount";
import { useBanking, type BankAlert } from "../../src/context/BankingContext";
import { useBranding } from "../../src/context/BrandingContext";
import { DEFAULT_BRANDING, type BrandingConfig } from "../../src/lib/branding";
import { supabase } from "../../src/lib/supabase";
import {
  deleteTransferVerificationRequest,
  getTransferVerificationServerSnapshot,
  getTransferVerificationSnapshot,
  issueTransferVerificationCode,
  markTransferVerificationSuspicious,
  pruneTransferVerificationRequests,
  rejectTransferVerificationRequest,
  subscribeTransferVerificationRequests,
  type TransferVerificationRequest,
} from "../../src/lib/transferVerification";

type AdminBankUser = {
  userId: string;
  username: string;
  email: string;
  fullName: string;
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  avatarUrl: string;
  accountType: string;
  currency: string;
  customerId: string;
  balance: number;
  reserve: number;
  income: number;
  accountStatus: "active" | "suspended" | "pending";
  transferFrozen: boolean;
  verificationStatus: "pending" | "approved" | "rejected";
  signedIn: boolean;
  lastSeenAt: string;
  onlineUntil: string;
  lastSignInAt: string;
  createdAt: string;
  source: "auth" | "profile";
};

type UserFilter = "all" | "new" | "online" | "active" | "suspended" | "pending";

type AdminUsersResponse = {
  ok?: boolean;
  users?: AdminBankUser[];
  user?: AdminBankUser;
  deletedUsername?: string;
  serviceRoleConfigured?: boolean;
  error?: string;
};

type BrandingResponse = {
  ok?: boolean;
  branding?: BrandingConfig;
  error?: string;
};

const alertTypes: BankAlert["type"][] = [
  "Payment",
  "Security",
  "Crypto",
  "Transfer",
  "Savings",
];
const MAX_AVATAR_UPLOAD_SIZE = 5 * 1024 * 1024;
const MAX_LOGO_UPLOAD_SIZE = 2 * 1024 * 1024;
const AVATAR_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];

function money(value: number) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function readNumber(value: FormDataEntryValue | null) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function readFormText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function isAllowedAvatarUpload(file: File) {
  if (file.type.startsWith("image/")) return true;

  const lowerName = file.name.toLowerCase();
  return AVATAR_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
}

function formatRequestTime(value: string) {
  return new Date(value).toLocaleString([], {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  });
}

function formatPresence(user: AdminBankUser) {
  if (user.signedIn) return "Signed in now";

  const lastSeen = user.lastSeenAt || user.lastSignInAt;
  if (!lastSeen) return "Not seen yet";

  const date = new Date(lastSeen);
  if (Number.isNaN(date.getTime())) return "Not seen yet";

  return `Last seen ${date.toLocaleString([], {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  })}`;
}

function isNewUser(user: AdminBankUser) {
  if (!user.createdAt) return false;

  const created = new Date(user.createdAt);
  if (Number.isNaN(created.getTime())) return false;

  return Date.now() - created.getTime() <= 7 * 24 * 60 * 60 * 1000;
}

function formatDate(value: string) {
  if (!value) return "Not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatAccountType(value: string) {
  const normalized = value.trim().toLowerCase();

  if (normalized === "business") return "Business";
  if (normalized === "premium") return "Premium";
  if (normalized === "personal") return "Personal";
  return value || "Personal";
}

function formatRequestStatus(request: TransferVerificationRequest) {
  if (request.status === "pending_admin_code") return "Awaiting admin";
  if (request.status === "pending_code") return "Code active";
  if (request.status === "approved") return "Approved";
  if (request.status === "completed") return "Completed";
  if (request.status === "rejected") return "Rejected";
  if (request.status === "suspicious") return "Suspicious";
  return "Pending";
}

function transferRequestDetails(request: TransferVerificationRequest) {
  const receiver =
    request.receiver ||
    request.accountNumber ||
    request.swift ||
    request.wallet ||
    "External account";
  const transferAmount = request.transferAmount ?? request.amount;
  const totalDebit = request.totalDebit ?? request.amount;
  const fee = request.fee ?? Math.max(totalDebit - transferAmount, 0);

  const details = [
    request.reference && { label: "Reference", value: request.reference },
    { label: "Status", value: formatRequestStatus(request) },
    { label: "Sender", value: request.senderName || request.sender },
    request.senderName && { label: "Username", value: request.sender },
    { label: "Recipient", value: receiver },
    { label: "Transfer Amount", value: `$${money(transferAmount)}` },
    { label: "Fee", value: `$${money(fee)}` },
    { label: "Total Debit", value: `$${money(totalDebit)}` },
    request.balanceBefore !== undefined && {
      label: "Balance Before",
      value: `$${money(request.balanceBefore)}`,
    },
    request.balanceAfter !== undefined && {
      label: "Balance After",
      value: `$${money(request.balanceAfter)}`,
    },
    request.bankName && {
      label: request.transferType === "crypto" ? "Network" : "Bank",
      value: request.bankName,
    },
    request.accountNumber && {
      label: request.transferType === "wire" ? "IBAN / Account" : "Account Number",
      value: request.accountNumber,
    },
    request.routingNumber && {
      label: "Routing / Sort Code",
      value: request.routingNumber,
    },
    request.recipientAccountType && {
      label: "Account Type",
      value: request.recipientAccountType,
    },
    request.swift && { label: "SWIFT / BIC", value: request.swift },
    request.wireCountry && { label: "Country", value: request.wireCountry },
    request.wireCurrency && { label: "Currency", value: request.wireCurrency },
    request.transferPurpose && { label: "Purpose", value: request.transferPurpose },
    request.recipientAddress && { label: "Address", value: request.recipientAddress },
    request.recipientContact && { label: "Contact", value: request.recipientContact },
    request.memo && { label: "Note", value: request.memo },
    { label: "Created", value: formatRequestTime(request.createdAt) },
  ];

  return details.filter((item): item is { label: string; value: string } => Boolean(item));
}

export default function AdminPage() {
  const { currentProfile, refreshBanking, alerts } = useBanking();
  const { branding, updateBranding } = useBranding();
  const transferVerificationRequests = useSyncExternalStore(
    subscribeTransferVerificationRequests,
    getTransferVerificationSnapshot,
    getTransferVerificationServerSnapshot
  );
  const pendingTransferCodes = transferVerificationRequests
    .filter((request) =>
      ["pending_admin_code", "pending_code", "pending", "approved"].includes(request.status)
    )
    .sort(
      (first, second) =>
        new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()
    )
    .slice(0, 1);
  const remoteTransferCodeAlerts = useMemo(
    () =>
      alerts
        .filter((alert) => alert.desc.toLowerCase().startsWith("transfer code request"))
        .slice(0, 3),
    [alerts]
  );

  const [users, setUsers] = useState<AdminBankUser[]>([]);
  const [selectedUsername, setSelectedUsername] = useState("");
  const [search, setSearch] = useState("");
  const [userFilter, setUserFilter] = useState<UserFilter>("all");
  const [notice, setNotice] = useState("");
  const [copiedTransferCodeId, setCopiedTransferCodeId] = useState("");
  const [usersLoading, setUsersLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [serviceRoleConfigured, setServiceRoleConfigured] = useState(true);
  const [brandingBusy, setBrandingBusy] = useState(false);
  const [brandingNotice, setBrandingNotice] = useState("");

  const [alertType, setAlertType] = useState<BankAlert["type"]>("Security");
  const [alertTitle, setAlertTitle] = useState("Manual review completed");
  const [alertDesc, setAlertDesc] = useState("Account activity was reviewed by Aurex operations.");
  const [alertStatus, setAlertStatus] = useState("Secure");
  const [alertUnread, setAlertUnread] = useState(true);

  const [transactionName, setTransactionName] = useState("Treasury Adjustment");
  const [transactionType, setTransactionType] = useState("Administrative posting");
  const [transactionDirection, setTransactionDirection] = useState<"credit" | "debit">("credit");
  const [transactionAmount, setTransactionAmount] = useState("2500");
  const [transactionMethod, setTransactionMethod] = useState("Aurex Admin");
  const [transactionStatus, setTransactionStatus] = useState("Completed");

  const selectedUser =
    users.find((user) => user.username === selectedUsername) ?? users[0] ?? null;
  const noticeIsError =
    notice.startsWith("Enter ") ||
    notice.startsWith("Unable ") ||
    notice.startsWith("Missing ") ||
    notice.startsWith("Upload ") ||
    notice.startsWith("Profile photo ") ||
    notice.startsWith("Admin access") ||
    notice.startsWith("Service role") ||
    notice.startsWith("Cannot ");

  function handleTransferCodeAction(
    request: TransferVerificationRequest,
    action: "issue" | "reject" | "suspicious"
  ) {
    if (action === "issue") {
      issueTransferVerificationCode(request.id);
      setNotice(`Secure code activated for ${request.reference ?? request.id}.`);
      return;
    }

    if (action === "reject") {
      rejectTransferVerificationRequest(request.id);
      setNotice(`Transfer request ${request.reference ?? request.id} was rejected.`);
      return;
    }

    markTransferVerificationSuspicious(request.id);
    setNotice(`Transfer request ${request.reference ?? request.id} was marked suspicious.`);
  }

  function deleteTransferCode(request: TransferVerificationRequest) {
    deleteTransferVerificationRequest(request.id);
    setNotice(`Transfer code ${request.reference ?? request.id} removed.`);
  }

  async function copyTransferCode(request: TransferVerificationRequest) {
    const text = request.code;
    const wasActivated = request.status !== "pending_code";

    if (wasActivated) {
      issueTransferVerificationCode(request.id);
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopiedTransferCodeId(request.id);
      setNotice(
        `Secure code ${text} copied and activated for ${request.reference ?? request.id}.`
      );
    } catch {
      setCopiedTransferCodeId(request.id);
      setNotice(`Secure code activated: ${text}`);
    }
  }

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesFilter =
        userFilter === "all" ||
        (userFilter === "new" && isNewUser(user)) ||
        (userFilter === "online" && user.signedIn) ||
        (userFilter === "active" && user.accountStatus === "active") ||
        (userFilter === "suspended" && user.accountStatus === "suspended") ||
        (userFilter === "pending" && user.verificationStatus === "pending");

      if (!matchesFilter) return false;
      if (!query) return true;

      return [
        user.fullName,
        user.email,
        user.username,
        user.customerId,
        user.accountStatus,
        user.verificationStatus,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [search, userFilter, users]);

  const userCounts = useMemo(
    () => ({
      all: users.length,
      new: users.filter(isNewUser).length,
      online: users.filter((user) => user.signedIn).length,
      active: users.filter((user) => user.accountStatus === "active").length,
      suspended: users.filter((user) => user.accountStatus === "suspended").length,
      pending: users.filter((user) => user.verificationStatus === "pending").length,
    }),
    [users]
  );

  const directoryFilters: Array<{ label: string; value: UserFilter; count: number }> = [
    { label: "All users", value: "all", count: userCounts.all },
    { label: "New users", value: "new", count: userCounts.new },
    { label: "Online now", value: "online", count: userCounts.online },
    { label: "Account active", value: "active", count: userCounts.active },
    { label: "Suspended", value: "suspended", count: userCounts.suspended },
    { label: "Pending verification", value: "pending", count: userCounts.pending },
  ];

  async function getAdminToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token ?? "";
  }

  const loadUsers = useCallback(
    async (preferredUsername?: string) => {
      setUsersLoading(true);

      try {
        const token = await getAdminToken();

        if (!token) {
          setNotice("Missing admin session. Sign in again.");
          setUsers([]);
          return;
        }

        const response = await fetch("/api/admin/users", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = (await response.json().catch(() => null)) as AdminUsersResponse | null;

        if (!response.ok || !data?.ok) {
          setNotice(data?.error || "Unable to load admin users.");
          setUsers([]);
          return;
        }

        const nextUsers = data.users ?? [];
        setUsers(nextUsers);
        setServiceRoleConfigured(data.serviceRoleConfigured !== false);

        const nextSelectedUsername =
          preferredUsername ||
          nextUsers.find((user) => user.username !== currentProfile.username)?.username ||
          nextUsers[0]?.username ||
          "";

        setSelectedUsername(nextSelectedUsername);
        if (!nextUsers.length) {
          setNotice("No banking profiles found yet.");
        }
      } finally {
        setUsersLoading(false);
      }
    },
    [currentProfile.username]
  );

  useEffect(() => {
    pruneTransferVerificationRequests();
  }, []);

  useEffect(() => {
    if (!copiedTransferCodeId) return;

    const timer = window.setTimeout(() => {
      setCopiedTransferCodeId("");
    }, 2200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [copiedTransferCodeId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadUsers();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadUsers]);

  async function runAdminAction(
    action: string,
    body: Record<string, unknown>,
    successMessage: string
  ) {
    if (!selectedUser) {
      setNotice("Select a target user first.");
      return;
    }

    setBusyAction(action);
    setNotice("");

    try {
      const token = await getAdminToken();

      if (!token) {
        setNotice("Missing admin session. Sign in again.");
        return;
      }

      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action,
          userId: selectedUser.userId,
          username: selectedUser.username,
          ...body,
        }),
      });
      const data = (await response.json().catch(() => null)) as AdminUsersResponse | null;

      if (!response.ok || !data?.ok) {
        setNotice(data?.error || "Unable to complete admin action.");
        return;
      }

      const nextUser = data.user;
      if (nextUser) {
        setUsers((currentUsers) => {
          const hasUser = currentUsers.some((user) => user.username === nextUser.username);
          const nextUsers = hasUser
            ? currentUsers.map((user) =>
                user.username === nextUser.username ? nextUser : user
              )
            : [nextUser, ...currentUsers];

          return nextUsers.sort((first, second) =>
            first.fullName.localeCompare(second.fullName)
          );
        });
        setSelectedUsername(nextUser.username);

        if (nextUser.username === currentProfile.username) {
          await refreshBanking();
        }

        await loadUsers(nextUser.username);
      }

      setNotice(successMessage);
    } finally {
      setBusyAction("");
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const firstName = readFormText(formData.get("firstName"));
    const lastName = readFormText(formData.get("lastName"));
    const fullName =
      readFormText(formData.get("fullName")) || `${firstName} ${lastName}`.trim();
    const phone = readFormText(formData.get("phone"));
    const country = readFormText(formData.get("country"));
    const accountType = readFormText(formData.get("accountType"));
    const currency = readFormText(formData.get("currency")).toUpperCase();

    if (!fullName) {
      setNotice("Enter an account name.");
      return;
    }

    await runAdminAction(
      "updateProfile",
      {
        firstName,
        lastName,
        fullName,
        phone,
        country,
        accountType,
        currency,
      },
      `Profile details updated for ${selectedUser?.fullName}.`
    );
  }

  async function uploadSelectedAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!file || !selectedUser) return;

    if (!selectedUser.userId) {
      setNotice("Unable to upload a photo for profile-only records.");
      return;
    }

    if (!isAllowedAvatarUpload(file)) {
      setNotice("Upload a JPG, PNG, WebP, HEIC, or HEIF image.");
      return;
    }

    if (file.size > MAX_AVATAR_UPLOAD_SIZE) {
      setNotice("Profile photo must be 5 MB or smaller.");
      return;
    }

    setBusyAction("uploadAvatar");
    setNotice("");

    try {
      const token = await getAdminToken();

      if (!token) {
        setNotice("Missing admin session. Sign in again.");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", selectedUser.userId);

      const response = await fetch("/api/admin/users/avatar", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; avatarUrl?: string; error?: string }
        | null;

      if (!response.ok || !data?.ok || !data.avatarUrl) {
        setNotice(data?.error || "Unable to upload profile photo.");
        return;
      }

      setUsers((currentUsers) =>
        currentUsers.map((user) =>
          user.username === selectedUser.username
            ? { ...user, avatarUrl: data.avatarUrl ?? user.avatarUrl }
            : user
        )
      );

      if (selectedUser.username === currentProfile.username) {
        await refreshBanking();
      }

      await loadUsers(selectedUser.username);
      setNotice(`Profile photo updated for ${selectedUser.fullName}.`);
    } finally {
      setBusyAction("");
    }
  }

  async function saveMetrics(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const nextBalance = readNumber(formData.get("balance"));
    const nextReserve = readNumber(formData.get("reserve"));
    const nextIncome = readNumber(formData.get("income"));

    if (
      nextBalance === null ||
      nextReserve === null ||
      nextIncome === null ||
      nextBalance < 0 ||
      nextReserve < 0 ||
      nextIncome < 0
    ) {
      setNotice("Enter valid non-negative numbers for all account metrics.");
      return;
    }

    await runAdminAction(
      "updateMetrics",
      {
        balance: nextBalance,
        reserve: nextReserve,
        income: nextIncome,
      },
      `Account metrics updated for ${selectedUser?.fullName}.`
    );
  }

  async function publishAlert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await runAdminAction(
      "publishAlert",
      {
        alertType,
        title: alertTitle.trim() || "Admin alert",
        desc: alertDesc.trim() || "Aurex operations published an account update.",
        status: alertStatus.trim() || "Updated",
        unread: alertUnread,
      },
      `Alert published to ${selectedUser?.fullName}.`
    );
  }

  async function postTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const rawAmount = Math.abs(Number(transactionAmount));

    if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
      setNotice("Enter a valid transaction amount greater than zero.");
      return;
    }

    await runAdminAction(
      "postTransaction",
      {
        name: transactionName.trim() || "Admin transaction",
        type: transactionType.trim() || "Administrative posting",
        amount: transactionDirection === "debit" ? -rawAmount : rawAmount,
        status: transactionStatus.trim() || "Completed",
        method: transactionMethod.trim() || "Aurex Admin",
      },
      `Transaction posted for ${selectedUser?.fullName}.`
    );
  }

  async function resetTarget() {
    await runAdminAction(
      "resetDemoData",
      {},
      `Account metrics reset for ${selectedUser?.fullName}.`
    );
  }

  async function deleteSelectedUser() {
    if (!selectedUser) {
      setNotice("Select a target user first.");
      return;
    }

    if (selectedUser.username === currentProfile.username) {
      setNotice("Cannot delete the signed-in admin account.");
      return;
    }

    const confirmed = window.confirm(
      `Delete ${selectedUser.fullName}? This removes the user's login, profile, cards, transfers, and notifications. This cannot be undone.`
    );

    if (!confirmed) return;

    setBusyAction("deleteUser");
    setNotice("");

    try {
      const token = await getAdminToken();

      if (!token) {
        setNotice("Missing admin session. Sign in again.");
        return;
      }

      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "deleteUser",
          userId: selectedUser.userId,
          username: selectedUser.username,
        }),
      });
      const data = (await response.json().catch(() => null)) as AdminUsersResponse | null;

      if (!response.ok || !data?.ok) {
        setNotice(data?.error || "Unable to delete user.");
        return;
      }

      const deletedUsername = data.deletedUsername || selectedUser.username;
      const remainingUsers = users.filter((user) => user.username !== deletedUsername);
      const nextSelectedUsername =
        remainingUsers.find((user) => user.username !== currentProfile.username)?.username ||
        remainingUsers[0]?.username ||
        "";

      setUsers(remainingUsers);
      setSelectedUsername(nextSelectedUsername);
      await loadUsers(nextSelectedUsername || undefined);
      setNotice(`${selectedUser.fullName} was deleted from Aurex Bank.`);
    } finally {
      setBusyAction("");
    }
  }

  async function updateAccountControls(
    controls: Partial<
      Pick<AdminBankUser, "accountStatus" | "transferFrozen" | "verificationStatus">
    >,
    message: string
  ) {
    if (!selectedUser) return;

    await runAdminAction(
      "controlAccount",
      {
        accountStatus: controls.accountStatus ?? selectedUser.accountStatus,
        transferFrozen: controls.transferFrozen ?? selectedUser.transferFrozen,
        verificationStatus: controls.verificationStatus ?? selectedUser.verificationStatus,
      },
      message
    );
  }

  async function saveBranding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (brandingBusy) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const logo = formData.get("logo");
    if (logo instanceof File && logo.size > MAX_LOGO_UPLOAD_SIZE) {
      setBrandingNotice("Bank logo must be 2 MB or smaller.");
      return;
    }

    setBrandingBusy(true);
    setBrandingNotice("");

    try {
      const token = await getAdminToken();
      if (!token) {
        setBrandingNotice("Missing admin session. Sign in again.");
        return;
      }

      const response = await fetch("/api/branding", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = (await response.json().catch(() => null)) as BrandingResponse | null;

      if (!response.ok || !data?.ok || !data.branding) {
        setBrandingNotice(data?.error || "Unable to update bank branding.");
        return;
      }

      updateBranding(data.branding);
      setBrandingNotice("Branding updated for every user and device.");
      form.reset();
    } catch {
      setBrandingNotice("Unable to update bank branding.");
    } finally {
      setBrandingBusy(false);
    }
  }

  async function restoreDefaultBranding() {
    if (brandingBusy) return;
    if (
      !window.confirm(
        "Restore the original Aurex logo and default app colors on every device?"
      )
    ) {
      return;
    }

    setBrandingBusy(true);
    setBrandingNotice("");

    try {
      const token = await getAdminToken();
      if (!token) {
        setBrandingNotice("Missing admin session. Sign in again.");
        return;
      }

      const formData = new FormData();
      formData.set("bankName", branding.bankName);
      formData.set("primaryColor", DEFAULT_BRANDING.primaryColor);
      formData.set("backgroundColor", DEFAULT_BRANDING.backgroundColor);
      formData.set("restoreDefaults", "true");

      const response = await fetch("/api/branding", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = (await response.json().catch(() => null)) as BrandingResponse | null;

      if (!response.ok || !data?.ok || !data.branding) {
        setBrandingNotice(data?.error || "Unable to restore the default branding.");
        return;
      }

      updateBranding(data.branding);
      setBrandingNotice("Original logo and default app colors restored everywhere.");
    } catch {
      setBrandingNotice("Unable to restore the default branding.");
    } finally {
      setBrandingBusy(false);
    }
  }

  return (
    <AdminGate>
      <main className="bank-shell min-h-screen overflow-x-hidden text-white">
        <DesktopSidebar />

        <div className="app-content desktop-page-content">
          <div className="app-inner">
            <section className="mb-6 border-b border-white/10 pb-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-400/10 text-green-300">
                      <AppIcon name="admin" className="h-5 w-5" />
                    </span>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-green-400">
                      Admin Operations
                    </p>
                  </div>
                  <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                    User Control Center
                  </h1>
                  <p className="mt-3 max-w-3xl text-base leading-relaxed text-zinc-400">
                    Select any registered or online customer, then update the dashboard name,
                    balance, profile photo, account status, and profile personal details.
                  </p>
                </div>

                <div className="grid w-full grid-cols-2 gap-3 sm:w-auto lg:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => loadUsers(selectedUser?.username)}
                    disabled={usersLoading}
                    className="bank-button rounded-lg px-4 py-3 text-sm font-black text-zinc-200 disabled:opacity-60"
                  >
                    {usersLoading ? "Refreshing..." : "Refresh Users"}
                  </button>
                  <button
                    type="button"
                    onClick={resetTarget}
                    disabled={!selectedUser || Boolean(busyAction)}
                    className="rounded-lg border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-black text-red-200 transition-all hover:bg-red-500/15 disabled:opacity-60"
                  >
                    Reset Metrics
                  </button>
                  <button
                    type="button"
                    onClick={deleteSelectedUser}
                    disabled={
                      !selectedUser ||
                      Boolean(busyAction) ||
                      selectedUser.username === currentProfile.username
                    }
                    className="rounded-lg bg-red-500 px-4 py-3 text-sm font-black text-white transition-all hover:bg-red-400 disabled:opacity-60"
                  >
                    {busyAction === "deleteUser" ? "Deleting..." : "Delete User"}
                  </button>
                </div>
              </div>

              {!serviceRoleConfigured && (
                <div className="mt-5 rounded-lg border border-yellow-300/20 bg-yellow-300/10 px-4 py-3 text-sm font-semibold text-yellow-100">
                  Service role key is not configured. Admin can only manage users visible through the profiles table.
                </div>
              )}

              {notice && (
                <div
                  className={`mt-5 rounded-lg border px-4 py-3 text-sm font-semibold ${
                    noticeIsError
                      ? "border-red-400/20 bg-red-500/10 text-red-200"
                      : "border-green-300/15 bg-green-400/10 text-green-200"
                  }`}
                >
                  {notice}
                </div>
              )}
            </section>

            <form
              key={`branding-${branding.updatedAt}`}
              onSubmit={saveBranding}
              className="bank-surface mb-6 rounded-lg p-5 sm:p-6"
            >
              <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(240px,0.75fr)_minmax(0,1.25fr)]">
                <div className="min-w-0 rounded-lg border border-white/10 bg-black/20 p-4 sm:p-5">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-green-400">
                    Live Brand Preview
                  </p>
                  <div className="mt-5">
                    <AurexBrand
                      markClassName="h-16 w-16 rounded-lg"
                      titleClassName="text-2xl sm:text-3xl"
                    />
                  </div>
                  <div className="mt-5 flex gap-2">
                    <span
                      className="h-10 flex-1 rounded-lg border border-white/10"
                      style={{ backgroundColor: branding.primaryColor }}
                      title="Primary color"
                    />
                    <span
                      className="h-10 flex-1 rounded-lg border border-white/10"
                      style={{ backgroundColor: branding.backgroundColor }}
                      title="Background color"
                    />
                  </div>
                </div>

                <div className="min-w-0">
                  <p className="text-sm font-semibold text-green-400">Bank Branding</p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
                    Name, Logo and Colors
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                    Changes apply globally to desktop, mobile, login pages, navigation, and customer dashboards.
                  </p>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <label className="block sm:col-span-2">
                      <span className="text-sm text-zinc-400">Bank Name</span>
                      <input
                        name="bankName"
                        required
                        minLength={2}
                        maxLength={48}
                        defaultValue={branding.bankName}
                        className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-sm font-semibold outline-none transition-all focus:border-green-400"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm text-zinc-400">Primary Accent</span>
                      <span className="mt-2 flex h-12 items-center gap-3 rounded-lg border border-white/10 bg-black/30 px-3">
                        <input
                          name="primaryColor"
                          type="color"
                          defaultValue={branding.primaryColor}
                          className="h-8 w-12 cursor-pointer rounded border-0 bg-transparent p-0"
                        />
                        <span className="text-xs font-black uppercase text-zinc-400">
                          Buttons, links and status colors
                        </span>
                      </span>
                    </label>

                    <label className="block">
                      <span className="text-sm text-zinc-400">Dark Background</span>
                      <span className="mt-2 flex h-12 items-center gap-3 rounded-lg border border-white/10 bg-black/30 px-3">
                        <input
                          name="backgroundColor"
                          type="color"
                          defaultValue={branding.backgroundColor}
                          className="h-8 w-12 cursor-pointer rounded border-0 bg-transparent p-0"
                        />
                        <span className="text-xs font-black uppercase text-zinc-400">
                          App background and navigation
                        </span>
                      </span>
                    </label>

                    <label className="block sm:col-span-2">
                      <span className="text-sm text-zinc-400">New Bank Logo</span>
                      <input
                        name="logo"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="mt-2 block w-full rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-green-400 file:px-3 file:py-2 file:text-xs file:font-black file:text-black"
                      />
                      <span className="mt-2 block text-xs text-zinc-600">
                        PNG, JPG, or WebP. Maximum 2 MB. Leave empty to keep the current logo.
                      </span>
                    </label>

                    <div className="rounded-lg border border-white/10 bg-black/20 p-4 sm:col-span-2">
                      <p className="text-sm font-black text-white">
                        Need the original look back?
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                        Restores the original Aurex logo, green accent (
                        {DEFAULT_BRANDING.primaryColor}), and dark app background (
                        {DEFAULT_BRANDING.backgroundColor}).
                      </p>
                      <button
                        type="button"
                        onClick={() => void restoreDefaultBranding()}
                        disabled={brandingBusy}
                        className="bank-button mt-4 w-full rounded-lg px-4 py-3 text-sm font-black text-green-200 disabled:opacity-60 sm:w-auto"
                      >
                        Restore Logo &amp; Default Colors
                      </button>
                    </div>
                  </div>

                  {brandingNotice && (
                    <div
                      className={`mt-5 rounded-lg border px-4 py-3 text-sm font-semibold ${
                        /unable|missing|must|choose|upload/i.test(brandingNotice)
                          ? "border-red-400/20 bg-red-500/10 text-red-200"
                          : "border-green-300/20 bg-green-400/10 text-green-200"
                      }`}
                    >
                      {brandingNotice}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={brandingBusy}
                    className="mt-6 w-full rounded-lg bg-green-400 px-5 py-4 text-sm font-black text-black transition-all hover:bg-green-300 disabled:opacity-60"
                  >
                    {brandingBusy ? "Updating Branding..." : "Apply Branding Everywhere"}
                  </button>
                </div>
              </div>
            </form>

            <div className="grid min-w-0 items-start gap-6 2xl:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]">
              <aside className="min-w-0 space-y-6">
                <section className="bank-surface rounded-lg p-5">
                  <p className="text-sm font-semibold text-green-400">Customer Directory</p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight">
                    Select User
                  </h2>

                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search users..."
                    className="mt-5 h-11 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-sm font-semibold outline-none placeholder:text-zinc-600 focus:border-green-400/40"
                  />

                  <div className="mt-4 flex flex-wrap gap-2">
                    {directoryFilters.map((filter) => (
                      <button
                        key={filter.value}
                        type="button"
                        onClick={() => setUserFilter(filter.value)}
                        className={`rounded-lg border px-3 py-2 text-left text-[11px] font-black transition-all ${
                          userFilter === filter.value
                            ? "border-green-300/40 bg-green-400/10 text-green-200"
                            : "border-white/10 bg-white/[0.025] text-zinc-500 hover:bg-white/[0.055]"
                        }`}
                      >
                        {filter.label} ({filter.count})
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 space-y-2">
                    {usersLoading ? (
                      <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm font-semibold text-zinc-500">
                        Loading users...
                      </div>
                    ) : filteredUsers.length ? (
                      filteredUsers.map((user) => {
                        const active = user.username === selectedUser?.username;

                        return (
                          <button
                            key={`${user.source}-${user.username}-${user.userId}`}
                            type="button"
                            onClick={() => setSelectedUsername(user.username)}
                            className={`w-full rounded-lg border p-4 text-left transition-all ${
                              active
                                ? "border-green-300/40 bg-green-400/10"
                                : "border-white/10 bg-white/[0.025] hover:bg-white/[0.055]"
                            }`}
                          >
                            <div className="flex min-w-0 items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex min-w-0 items-center gap-2">
                                  <span
                                    className={`h-2 w-2 shrink-0 rounded-full ${
                                      user.signedIn ? "bg-green-400" : "bg-zinc-700"
                                    }`}
                                  />
                                  <h3 className="truncate text-sm font-black">
                                    {user.fullName}
                                  </h3>
                                </div>
                                <p className="mt-1 truncate text-xs text-zinc-500">
                                  {user.email}
                                </p>
                              </div>
                              <span className="shrink-0 rounded-md border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-zinc-400">
                                {user.source}
                              </span>
                            </div>
                            <p
                              className={`mt-3 text-xs font-black ${
                                user.signedIn ? "text-green-300" : "text-zinc-500"
                              }`}
                            >
                              {formatPresence(user)} /{" "}
                              <PrivateAmount value={user.balance} />
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-zinc-400">
                                {user.accountStatus}
                              </span>
                              <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-zinc-400">
                                {user.verificationStatus}
                              </span>
                              <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-zinc-400">
                                Created {formatDate(user.createdAt)}
                              </span>
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm font-semibold text-zinc-500">
                        No matching users.
                      </div>
                    )}
                  </div>
                </section>

                <section className="rounded-lg border border-green-300/15 bg-green-400/[0.07] p-5">
                  <p className="text-sm font-semibold text-green-400">Admin Access</p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight">
                    {currentProfile.fullName}
                  </h2>
                  <p className="mt-2 break-words text-sm text-zinc-400">
                    Signed in as {currentProfile.email}. Server actions still re-check the admin allowlist.
                  </p>
                </section>
              </aside>

              <div className="min-w-0 space-y-6">
                {selectedUser ? (
                  <>
                    <section className="bank-surface rounded-lg p-5 sm:p-6">
                      <div className="flex min-w-0 flex-col gap-5">
                        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start">
                          <span className="flex h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-green-300/20 bg-green-400/10 text-xl font-black text-green-300">
                            {selectedUser.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={selectedUser.avatarUrl}
                                alt={`${selectedUser.fullName} profile photo`}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center">
                                {selectedUser.firstName.slice(0, 1).toUpperCase()}
                              </span>
                            )}
                          </span>
                          <div className="min-w-0 flex-1 sm:min-w-[18rem]">
                            <p className="text-sm font-semibold text-green-400">
                              Selected Customer
                            </p>
                            <h2 className="mt-2 break-words text-2xl font-black leading-tight tracking-tight sm:text-3xl lg:text-4xl">
                              {selectedUser.fullName}
                            </h2>
                            <p className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-sm text-zinc-500">
                              <span className="min-w-0 break-words">{selectedUser.email}</span>
                              <span className="text-zinc-700">/</span>
                              <span className="font-semibold text-zinc-400">
                                {selectedUser.customerId}
                              </span>
                            </p>
                          </div>
                        </div>

                        <div className="flex min-w-0 flex-wrap gap-2">
                          <span
                            className={`inline-flex max-w-full items-center whitespace-normal break-words rounded-md border px-3 py-2 text-left text-[11px] font-black uppercase leading-tight tracking-[0.1em] ${
                              selectedUser.signedIn
                                ? "border-green-300/20 bg-green-400/10 text-green-300"
                                : "border-white/10 bg-white/[0.04] text-zinc-400"
                            }`}
                          >
                            {formatPresence(selectedUser)}
                          </span>
                          <span className="inline-flex max-w-full items-center whitespace-normal break-words rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-[11px] font-black uppercase leading-tight tracking-[0.1em] text-zinc-400">
                            {selectedUser.username}
                          </span>
                          <span className="inline-flex max-w-full items-center whitespace-normal break-words rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-[11px] font-black uppercase leading-tight tracking-[0.1em] text-zinc-400">
                            {selectedUser.accountStatus}
                          </span>
                          <span
                            className={`inline-flex max-w-full items-center whitespace-normal break-words rounded-md border px-3 py-2 text-left text-[11px] font-black uppercase leading-tight tracking-[0.1em] ${
                              selectedUser.transferFrozen
                                ? "border-red-400/20 bg-red-500/10 text-red-200"
                                : "border-green-300/20 bg-green-400/10 text-green-300"
                            }`}
                          >
                            {selectedUser.transferFrozen ? "Transfers frozen" : "Transfers active"}
                          </span>
                          <span className="inline-flex max-w-full items-center whitespace-normal break-words rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-[11px] font-black uppercase leading-tight tracking-[0.1em] text-zinc-400">
                            Verification {selectedUser.verificationStatus}
                          </span>
                        </div>
                      </div>
                    </section>

                    <section className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
                      {[
                        {
                          label: "Available Balance",
                          value: <PrivateAmount value={selectedUser.balance} />,
                        },
                        { label: "Reserve", value: <PrivateAmount value={selectedUser.reserve} /> },
                        {
                          label: "Monthly Income",
                          value: <PrivateAmount value={selectedUser.income} />,
                        },
                        {
                          label: "Account Type",
                          value: `${formatAccountType(selectedUser.accountType)} / ${selectedUser.currency}`,
                        },
                      ].map((item) => (
                        <div key={item.label} className="bank-surface rounded-lg p-5">
                          <p className="text-sm text-zinc-500">{item.label}</p>
                          <h2 className="mt-3 break-words text-3xl font-black tracking-tight">
                            {item.value}
                          </h2>
                        </div>
                      ))}
                    </section>

                    <section className="bank-surface rounded-lg p-6">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-green-400">
                            Account Controls
                          </p>
                          <h2 className="mt-2 text-3xl font-black tracking-tight">
                            Status and Access
                          </h2>
                          <p className="mt-2 text-sm text-zinc-500">
                            Service-role actions are still checked by the protected admin API.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <a
                            href={`/profile?user=${encodeURIComponent(selectedUser.username)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="bank-button rounded-lg px-4 py-3 text-sm font-black"
                          >
                            View Profile
                          </a>
                          <a
                            href={`/devices?user=${encodeURIComponent(selectedUser.username)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="bank-button rounded-lg px-4 py-3 text-sm font-black"
                          >
                            Devices
                          </a>
                          <a
                            href={`/notifications?user=${encodeURIComponent(selectedUser.username)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="bank-button rounded-lg px-4 py-3 text-sm font-black"
                          >
                            Transactions
                          </a>
                        </div>
                      </div>

                      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                        <button
                          type="button"
                          disabled={Boolean(busyAction)}
                          onClick={() =>
                            updateAccountControls(
                              { accountStatus: "active" },
                              `${selectedUser.fullName} activated.`
                            )
                          }
                          className="rounded-lg bg-green-400 px-4 py-4 text-sm font-black text-black transition-all hover:bg-green-300 disabled:opacity-60"
                        >
                          Activate
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(busyAction)}
                          onClick={() =>
                            updateAccountControls(
                              { accountStatus: "suspended" },
                              `${selectedUser.fullName} deactivated.`
                            )
                          }
                          className="rounded-lg border border-red-400/20 bg-red-500/10 px-4 py-4 text-sm font-black text-red-200 transition-all hover:bg-red-500/15 disabled:opacity-60"
                        >
                          Deactivate
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(busyAction)}
                          onClick={() =>
                            updateAccountControls(
                              { transferFrozen: !selectedUser.transferFrozen },
                              selectedUser.transferFrozen
                                ? `${selectedUser.fullName} transfers unfrozen.`
                                : `${selectedUser.fullName} transfers frozen.`
                            )
                          }
                          className="bank-button rounded-lg px-4 py-4 text-sm font-black"
                        >
                          {selectedUser.transferFrozen ? "Unfreeze Transfers" : "Freeze Transfers"}
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(busyAction)}
                          onClick={() =>
                            updateAccountControls(
                              { verificationStatus: "approved", accountStatus: "active" },
                              `${selectedUser.fullName} verification approved.`
                            )
                          }
                          className="bank-button rounded-lg px-4 py-4 text-sm font-black text-green-200"
                        >
                          Approve KYC
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(busyAction)}
                          onClick={() =>
                            updateAccountControls(
                              { verificationStatus: "rejected" },
                              `${selectedUser.fullName} verification rejected.`
                            )
                          }
                          className="bank-button rounded-lg px-4 py-4 text-sm font-black text-red-200"
                        >
                          Reject KYC
                        </button>
                        <button
                          type="button"
                          disabled={
                            Boolean(busyAction) ||
                            selectedUser.username === currentProfile.username
                          }
                          onClick={deleteSelectedUser}
                          className="rounded-lg bg-red-500 px-4 py-4 text-sm font-black text-white transition-all hover:bg-red-400 disabled:opacity-60"
                        >
                          {busyAction === "deleteUser" ? "Deleting..." : "Delete User"}
                        </button>
                      </div>
                    </section>

                    <form
                      key={`profile-${selectedUser.username}-${selectedUser.fullName}-${selectedUser.phone}-${selectedUser.country}-${selectedUser.avatarUrl}`}
                      onSubmit={saveProfile}
                      className="bank-surface rounded-lg p-6"
                    >
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-green-400">
                            Profile Page Controls
                          </p>
                          <h2 className="mt-2 text-3xl font-black tracking-tight">
                            Identity Information
                          </h2>
                          <p className="mt-2 text-sm text-zinc-500">
                            Personal Details shown on the customer profile and dashboard.
                          </p>
                        </div>
                        <label
                          className={`inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 text-sm font-black transition-all ${
                            busyAction === "uploadAvatar"
                              ? "bg-white/10 text-zinc-500"
                              : "bg-green-400 text-black hover:bg-green-300"
                          }`}
                        >
                          <AppIcon name="profile" className="h-4 w-4" />
                          {busyAction === "uploadAvatar" ? "Uploading..." : "Upload Photo"}
                          <input
                            type="file"
                            accept="image/*,.heic,.heif"
                            disabled={Boolean(busyAction)}
                            onChange={(event) => void uploadSelectedAvatar(event)}
                            className="sr-only"
                          />
                        </label>
                      </div>

                      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <label className="block md:col-span-2 xl:col-span-3">
                          <span className="text-sm text-zinc-400">Full Name / Profile Name</span>
                          <input
                            name="fullName"
                            defaultValue={selectedUser.fullName}
                            className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-sm font-semibold outline-none transition-all focus:border-green-400"
                          />
                        </label>

                        <label className="block">
                          <span className="text-sm text-zinc-400">Dashboard Display Name</span>
                          <input
                            name="firstName"
                            defaultValue={selectedUser.firstName}
                            className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-sm font-semibold outline-none transition-all focus:border-green-400"
                          />
                        </label>

                        <label className="block">
                          <span className="text-sm text-zinc-400">Last Name</span>
                          <input
                            name="lastName"
                            defaultValue={selectedUser.lastName}
                            className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-sm font-semibold outline-none transition-all focus:border-green-400"
                          />
                        </label>

                        <label className="block">
                          <span className="text-sm text-zinc-400">Phone</span>
                          <input
                            name="phone"
                            defaultValue={
                              selectedUser.phone === "Not provided" ? "" : selectedUser.phone
                            }
                            className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-sm font-semibold outline-none transition-all focus:border-green-400"
                          />
                        </label>

                        <label className="block">
                          <span className="text-sm text-zinc-400">Country</span>
                          <input
                            name="country"
                            defaultValue={
                              selectedUser.country === "Not provided" ? "" : selectedUser.country
                            }
                            className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-sm font-semibold outline-none transition-all focus:border-green-400"
                          />
                        </label>

                        <label className="block">
                          <span className="text-sm text-zinc-400">Account Type</span>
                          <select
                            name="accountType"
                            defaultValue={selectedUser.accountType}
                            className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-sm font-semibold outline-none transition-all focus:border-green-400"
                          >
                            <option value="personal">Personal</option>
                            <option value="business">Business</option>
                            <option value="premium">Premium</option>
                          </select>
                        </label>

                        <label className="block">
                          <span className="text-sm text-zinc-400">Currency</span>
                          <select
                            name="currency"
                            defaultValue={selectedUser.currency}
                            className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-sm font-semibold outline-none transition-all focus:border-green-400"
                          >
                            <option value="USD">USD</option>
                            <option value="GBP">GBP</option>
                            <option value="EUR">EUR</option>
                            <option value="NGN">NGN</option>
                          </select>
                        </label>
                      </div>

                      <button
                        type="submit"
                        disabled={Boolean(busyAction)}
                        className="mt-6 w-full rounded-lg bg-green-400 py-4 text-sm font-black text-black transition-all hover:bg-green-300 disabled:opacity-60 sm:w-auto sm:px-8"
                      >
                        {busyAction === "updateProfile" ? "Saving..." : "Save Profile Details"}
                      </button>
                    </form>

                    <div className="grid min-w-0 items-stretch gap-6 2xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                      <div className="flex min-w-0 flex-col gap-6">
                        <form
                          key={`metrics-${selectedUser.username}-${selectedUser.balance}-${selectedUser.reserve}-${selectedUser.income}`}
                          onSubmit={saveMetrics}
                          className="bank-surface rounded-lg p-6"
                        >
                          <p className="text-sm font-semibold text-green-400">
                            Financial Controls
                          </p>
                          <h2 className="mt-2 text-3xl font-black tracking-tight">
                            Balance and Metrics
                          </h2>
                          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                            Reserve controls the dashboard portfolio balance and asset allocations.
                            Saved income and reserve values sync to the selected user account.
                          </p>

                          <div className="mt-6 grid gap-4">
                            {[
                              {
                                label: "Available Balance",
                                name: "balance",
                                value: selectedUser.balance,
                              },
                              {
                                label: "Reserve Balance",
                                name: "reserve",
                                value: selectedUser.reserve,
                              },
                              {
                                label: "Monthly Income",
                                name: "income",
                                value: selectedUser.income,
                              },
                            ].map((field) => (
                              <label key={field.name} className="block">
                                <span className="text-sm text-zinc-400">{field.label}</span>
                                <input
                                  name={field.name}
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  defaultValue={field.value}
                                  className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-sm font-semibold outline-none transition-all focus:border-green-400"
                                />
                              </label>
                            ))}
                          </div>

                          <button
                            type="submit"
                            disabled={Boolean(busyAction)}
                            className="mt-6 w-full rounded-lg bg-green-400 py-4 text-sm font-black text-black transition-all hover:bg-green-300 disabled:opacity-60"
                          >
                            {busyAction === "updateMetrics" ? "Saving..." : "Save Target Metrics"}
                          </button>
                        </form>

                        <form
                          onSubmit={publishAlert}
                          className="bank-surface flex flex-1 flex-col rounded-lg p-6"
                        >
                          <p className="text-sm font-semibold text-green-400">
                            Communication Controls
                          </p>
                          <h2 className="mt-2 text-3xl font-black tracking-tight">
                            Publish User Alert
                          </h2>

                          <div className="mt-6 grid gap-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                              <label className="block">
                                <span className="text-sm text-zinc-400">Alert Type</span>
                                <select
                                  value={alertType}
                                  onChange={(event) =>
                                    setAlertType(event.target.value as BankAlert["type"])
                                  }
                                  className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-sm font-semibold outline-none transition-all focus:border-green-400"
                                >
                                  {alertTypes.map((type) => (
                                    <option key={type}>{type}</option>
                                  ))}
                                </select>
                              </label>
                              <label className="block">
                                <span className="text-sm text-zinc-400">Status</span>
                                <input
                                  value={alertStatus}
                                  onChange={(event) => setAlertStatus(event.target.value)}
                                  className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-sm font-semibold outline-none transition-all focus:border-green-400"
                                />
                              </label>
                            </div>

                            <label className="block">
                              <span className="text-sm text-zinc-400">Title</span>
                              <input
                                value={alertTitle}
                                onChange={(event) => setAlertTitle(event.target.value)}
                                className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-sm font-semibold outline-none transition-all focus:border-green-400"
                              />
                            </label>

                            <label className="block">
                              <span className="text-sm text-zinc-400">Message</span>
                              <textarea
                                value={alertDesc}
                                onChange={(event) => setAlertDesc(event.target.value)}
                                rows={4}
                                className="mt-2 w-full resize-none rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold outline-none transition-all focus:border-green-400"
                              />
                            </label>

                            <label className="flex items-center gap-3 text-sm font-semibold text-zinc-300">
                              <input
                                type="checkbox"
                                checked={alertUnread}
                                onChange={(event) => setAlertUnread(event.target.checked)}
                                className="h-5 w-5 rounded border-white/20 bg-black/30 text-green-400 focus:ring-green-400"
                              />
                              Mark as unread
                            </label>
                          </div>

                          <div className="mt-auto pt-6">
                            <button
                              type="submit"
                              disabled={Boolean(busyAction)}
                              className="w-full rounded-lg bg-green-400 py-4 text-sm font-black text-black transition-all hover:bg-green-300 disabled:opacity-60"
                            >
                              {busyAction === "publishAlert" ? "Publishing..." : "Publish Alert"}
                            </button>
                          </div>
                        </form>
                      </div>

                      <div className="flex min-w-0 flex-col gap-6">
                        <form onSubmit={postTransaction} className="bank-surface rounded-lg p-6">
                          <p className="text-sm font-semibold text-green-400">
                            Ledger Controls
                          </p>
                          <h2 className="mt-2 text-3xl font-black tracking-tight">
                            Post Transaction
                          </h2>

                          <div className="mt-6 grid gap-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                              <label className="block">
                                <span className="text-sm text-zinc-400">Entry Name</span>
                                <input
                                  value={transactionName}
                                  onChange={(event) => setTransactionName(event.target.value)}
                                  className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-sm font-semibold outline-none transition-all focus:border-green-400"
                                />
                              </label>
                              <label className="block">
                                <span className="text-sm text-zinc-400">Direction</span>
                                <select
                                  value={transactionDirection}
                                  onChange={(event) =>
                                    setTransactionDirection(
                                      event.target.value as "credit" | "debit"
                                    )
                                  }
                                  className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-sm font-semibold outline-none transition-all focus:border-green-400"
                                >
                                  <option value="credit">Credit</option>
                                  <option value="debit">Debit</option>
                                </select>
                              </label>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                              <label className="block">
                                <span className="text-sm text-zinc-400">Amount</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={transactionAmount}
                                  onChange={(event) => setTransactionAmount(event.target.value)}
                                  className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-sm font-semibold outline-none transition-all focus:border-green-400"
                                />
                              </label>
                              <label className="block">
                                <span className="text-sm text-zinc-400">Status</span>
                                <input
                                  value={transactionStatus}
                                  onChange={(event) => setTransactionStatus(event.target.value)}
                                  className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-sm font-semibold outline-none transition-all focus:border-green-400"
                                />
                              </label>
                            </div>

                            <label className="block">
                              <span className="text-sm text-zinc-400">Category</span>
                              <input
                                value={transactionType}
                                onChange={(event) => setTransactionType(event.target.value)}
                                className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-sm font-semibold outline-none transition-all focus:border-green-400"
                              />
                            </label>

                            <label className="block">
                              <span className="text-sm text-zinc-400">Method</span>
                              <input
                                value={transactionMethod}
                                onChange={(event) => setTransactionMethod(event.target.value)}
                                className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-sm font-semibold outline-none transition-all focus:border-green-400"
                              />
                            </label>
                          </div>

                          <button
                            type="submit"
                            disabled={Boolean(busyAction)}
                            className="mt-6 w-full rounded-lg bg-green-400 py-4 text-sm font-black text-black transition-all hover:bg-green-300 disabled:opacity-60"
                          >
                            {busyAction === "postTransaction" ? "Posting..." : "Post Transaction"}
                          </button>
                        </form>

                        <section className="bank-surface flex flex-1 flex-col rounded-lg p-6">
                          <p className="text-sm font-semibold text-green-400">
                            Transfer Verification
                          </p>
                          <h2 className="mt-2 text-3xl font-black tracking-tight">
                            Pending Codes
                          </h2>
                          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                            Give the matching code to the customer only after reviewing the transfer request.
                          </p>

                          <div className="mt-6 flex flex-1 flex-col gap-3">
                            {remoteTransferCodeAlerts.map((alert) => (
                              <div
                                key={alert.id}
                                className="rounded-lg border border-blue-300/15 bg-blue-400/[0.07] p-4"
                              >
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                  <div>
                                    <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-200">
                                      Admin Notification
                                    </p>
                                    <h3 className="mt-2 text-lg font-black text-white">
                                      Transfer Code Request
                                    </h3>
                                  </div>
                                  <span className="w-fit rounded-md border border-white/10 bg-black/25 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-zinc-300">
                                    {alert.time}
                                  </span>
                                </div>

                                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                  {alert.desc.split(" | ").map((part, index) => (
                                    <div
                                      key={`${alert.id}-${index}`}
                                      className="rounded-md border border-white/10 bg-black/20 p-3"
                                    >
                                      <p className="break-words text-sm font-black text-zinc-100">
                                        {part}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}

                            {pendingTransferCodes.length ? (
                              pendingTransferCodes.map((request) => (
                                <div
                                  key={request.id}
                                  className="rounded-lg border border-green-300/15 bg-green-400/[0.07] p-4"
                                >
                                  <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                    <button
                                      type="button"
                                      onClick={() => void copyTransferCode(request)}
                                      className="min-w-0 rounded-lg p-0 text-left transition-all hover:text-green-200"
                                      title="Copy secure code"
                                    >
                                      <p className="text-xs font-black uppercase tracking-[0.16em] text-green-300">
                                        Code
                                      </p>
                                      <h3 className="mt-2 break-all text-3xl font-black tracking-[0.18em] text-white">
                                        {request.code}
                                      </h3>
                                      <p className="mt-2 text-xs font-semibold text-zinc-500">
                                        {copiedTransferCodeId === request.id
                                          ? "Copied to clipboard"
                                          : "Click code to copy"}
                                      </p>
                                    </button>
                                    <div className="flex w-fit shrink-0 flex-wrap gap-2">
                                      {copiedTransferCodeId === request.id && (
                                        <span className="rounded-md bg-green-400 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-black">
                                          Copied
                                        </span>
                                      )}
                                      <span className="rounded-md border border-white/10 bg-black/25 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-zinc-300">
                                        {request.transferType} / {formatRequestStatus(request)}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                                    {transferRequestDetails(request).map((item, index) => (
                                      <div
                                        key={`${request.id}-${item.label}-${index}`}
                                        className="rounded-md border border-white/10 bg-black/20 p-3"
                                      >
                                        <p className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">
                                          {item.label}
                                        </p>
                                        <p className="mt-1 break-words text-sm font-black text-zinc-100">
                                          {item.value}
                                        </p>
                                      </div>
                                    ))}
                                  </div>

                                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                                    <button
                                      type="button"
                                      onClick={() => void copyTransferCode(request)}
                                      className="bank-button rounded-lg px-4 py-3 text-sm font-black text-green-200"
                                    >
                                      {copiedTransferCodeId === request.id ? "Copied" : "Copy Code"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleTransferCodeAction(request, "issue")}
                                      disabled={request.status === "pending_code"}
                                      className="rounded-lg bg-green-400 px-4 py-3 text-sm font-black text-black transition-all hover:bg-green-300 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {request.status === "pending_code"
                                        ? "Code Active"
                                        : "Activate Code"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleTransferCodeAction(request, "reject")}
                                      className="bank-button rounded-lg px-4 py-3 text-sm font-black text-red-200"
                                    >
                                      Reject
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleTransferCodeAction(request, "suspicious")}
                                      className="bank-button rounded-lg px-4 py-3 text-sm font-black text-yellow-100"
                                    >
                                      Mark Suspicious
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteTransferCode(request)}
                                      className="bank-button rounded-lg px-4 py-3 text-sm font-black text-zinc-200"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              ))
                            ) : null}

                            {!pendingTransferCodes.length && !remoteTransferCodeAlerts.length && (
                              <div className="flex flex-1 items-center rounded-lg border border-white/10 bg-black/20 p-5 text-sm font-semibold text-zinc-500">
                                No pending transfer codes.
                              </div>
                            )}
                          </div>
                        </section>
                      </div>
                    </div>
                  </>
                ) : (
                  <section className="bank-surface rounded-lg p-8">
                    <p className="text-sm font-semibold text-green-400">No Target Selected</p>
                    <h2 className="mt-2 text-3xl font-black tracking-tight">
                      Choose a user to manage
                    </h2>
                    <p className="mt-3 text-zinc-500">
                      Once a customer account exists, it will appear in the directory.
                    </p>
                  </section>
                )}
              </div>
            </div>
          </div>
        </div>

        <BottomNav />
      </main>
    </AdminGate>
  );
}
