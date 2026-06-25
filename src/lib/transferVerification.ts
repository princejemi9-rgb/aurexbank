"use client";

import { supabase } from "./supabase";

export type TransferVerificationStatus =
  | "pending_admin_code"
  | "pending_code"
  | "pending"
  | "approved"
  | "rejected"
  | "suspicious"
  | "completed";

export type TransferVerificationRequest = {
  id: string;
  code: string;
  status: TransferVerificationStatus;
  createdAt: string;
  approvedAt?: string;
  completedAt?: string;
  sender: string;
  senderName: string;
  transferType: string;
  accountType: string;
  receiver: string;
  amount: number;
  transferAmount?: number;
  fee?: number;
  totalDebit?: number;
  balanceBefore?: number;
  balanceAfter?: number;
  reference?: string;
  bankName?: string;
  accountNumber?: string;
  routingNumber?: string;
  recipientAccountType?: string;
  swift?: string;
  wallet?: string;
  memo?: string;
  recipientContact?: string;
  recipientAddress?: string;
  wireCountry?: string;
  wireCurrency?: string;
  transferPurpose?: string;
};

type TransferVerificationInput = Omit<
  TransferVerificationRequest,
  "id" | "code" | "status" | "createdAt" | "approvedAt"
>;

const STORAGE_KEY = "aurexbank:transfer-verification-requests";
const CHANGE_EVENT = "aurexbank:transfer-verification-requests-change";
const MAX_REQUESTS = 1;
const MAX_OPEN_REQUEST_AGE_MS = 24 * 60 * 60 * 1000;
const STORABLE_STATUSES = new Set<TransferVerificationStatus>([
  "pending_admin_code",
  "pending_code",
  "pending",
  "approved",
  "rejected",
  "suspicious",
]);

let cachedRaw = "";
let cachedRequests: TransferVerificationRequest[] = [];

function hasBrowserStorage() {
  return typeof window !== "undefined";
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function createRequestId() {
  return `tvr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readRawRequests() {
  if (!hasBrowserStorage()) return "[]";
  return window.localStorage.getItem(STORAGE_KEY) ?? "[]";
}

function parseRequests(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is TransferVerificationRequest => {
          return (
            item &&
            typeof item.id === "string" &&
            typeof item.code === "string" &&
            isTransferVerificationStatus(item.status)
          );
        })
      : [];
  } catch {
    return [];
  }
}

function isFreshRequest(request: TransferVerificationRequest) {
  const created = new Date(request.createdAt);
  if (Number.isNaN(created.getTime())) return true;
  return Date.now() - created.getTime() <= MAX_OPEN_REQUEST_AGE_MS;
}

function pruneStoredRequests(requests: TransferVerificationRequest[]) {
  return requests.filter((request) => {
    return STORABLE_STATUSES.has(request.status) && isFreshRequest(request);
  });
}

function isTransferVerificationStatus(status: unknown): status is TransferVerificationStatus {
  return (
    status === "pending_admin_code" ||
    status === "pending_code" ||
    status === "pending" ||
    status === "approved" ||
    status === "rejected" ||
    status === "suspicious" ||
    status === "completed"
  );
}

function writeRequests(requests: TransferVerificationRequest[]) {
  if (!hasBrowserStorage()) return;

  const nextRequests = pruneStoredRequests(requests).slice(0, MAX_REQUESTS);
  const raw = JSON.stringify(nextRequests);
  cachedRaw = raw;
  cachedRequests = nextRequests;
  window.localStorage.setItem(STORAGE_KEY, raw);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function getTransferVerificationSnapshot() {
  const raw = readRawRequests();
  if (raw === cachedRaw) return cachedRequests;

  cachedRaw = raw;
  cachedRequests = pruneStoredRequests(parseRequests(raw));
  return cachedRequests;
}

export function pruneTransferVerificationRequests() {
  writeRequests(getTransferVerificationSnapshot());
}

export function deleteTransferVerificationRequest(id: string) {
  writeRequests(
    getTransferVerificationSnapshot().filter((request) => request.id !== id)
  );
}

export function getTransferVerificationServerSnapshot() {
  return [];
}

export function subscribeTransferVerificationRequests(listener: () => void) {
  if (!hasBrowserStorage()) return () => {};

  function handleStorage(event: StorageEvent) {
    if (event.key === STORAGE_KEY) {
      listener();
    }
  }

  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", handleStorage);
  };
}

export function createTransferVerificationRequest(input: TransferVerificationInput) {
  const request: TransferVerificationRequest = {
    ...input,
    id: createRequestId(),
    code: generateCode(),
    status: "pending_admin_code",
    createdAt: new Date().toISOString(),
  };

  writeRequests([request]);
  return request;
}

export async function notifyAdminTransferCode(request: TransferVerificationRequest) {
  const receiver =
    request.receiver ||
    request.accountNumber ||
    request.swift ||
    request.wallet ||
    "External account";
  const transferAmount = request.transferAmount ?? request.amount;
  const totalDebit = request.totalDebit ?? request.amount;
  const fee = request.fee ?? Math.max(totalDebit - transferAmount, 0);
  const balanceAfter = request.balanceAfter ?? null;
  const message = [
    "Transfer code request",
    `Ref ${request.reference ?? request.id}`,
    `Code ${request.code}`,
    `Sender ${request.senderName || request.sender}`,
    `Recipient ${receiver}`,
    `Type ${request.transferType}`,
    `Amount $${transferAmount.toLocaleString("en-US")}`,
    `Fee $${fee.toLocaleString("en-US")}`,
    `Total debit $${totalDebit.toLocaleString("en-US")}`,
    balanceAfter !== null
      ? `Balance after $${balanceAfter.toLocaleString("en-US")}`
      : "",
  ]
    .filter(Boolean)
    .join(" | ");

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    const response = await fetch("/api/transfers/verification-notice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        code: request.code,
        reference: request.reference ?? request.id,
        sender: request.sender,
        senderName: request.senderName,
        receiver,
        transferType: request.transferType,
        amount: transferAmount,
        fee,
        totalDebit,
        balanceAfter,
      }),
    });

    if (response.ok) return;
  }

  await supabase
    .from("notifications")
    .insert([
      {
        username: "admin",
        message,
      },
    ])
    .throwOnError();
}

export function getTransferVerificationRequest(id: string) {
  return getTransferVerificationSnapshot().find((request) => request.id === id) ?? null;
}

export function transferVerificationCodeMatches(id: string, code: string) {
  const request = getTransferVerificationRequest(id);
  return (
    (request?.status === "pending_admin_code" ||
      request?.status === "pending_code" ||
      request?.status === "pending" ||
      request?.status === "approved") &&
    request.code === code.trim()
  );
}

function updateTransferVerificationRequest(
  id: string,
  patch: Partial<TransferVerificationRequest>
) {
  const requests = getTransferVerificationSnapshot();

  writeRequests(
    requests.map((request) =>
      request.id === id
        ? {
            ...request,
            ...patch,
          }
        : request
    )
  );
}

export function issueTransferVerificationCode(id: string) {
  updateTransferVerificationRequest(id, {
    status: "pending_code",
    approvedAt: new Date().toISOString(),
  });
}

export function approveTransferVerificationRequest(id: string) {
  updateTransferVerificationRequest(id, {
    status: "approved",
    approvedAt: new Date().toISOString(),
  });
}

export function completeTransferVerificationRequest(id: string) {
  updateTransferVerificationRequest(id, {
    status: "completed",
    completedAt: new Date().toISOString(),
  });
}

export function rejectTransferVerificationRequest(id: string) {
  updateTransferVerificationRequest(id, {
    status: "rejected",
  });
}

export function markTransferVerificationSuspicious(id: string) {
  updateTransferVerificationRequest(id, {
    status: "suspicious",
  });
}
