"use client";

import { supabase } from "./supabase";

export type TransferVerificationStatus = "pending_admin_code" | "pending_code" | "pending" | "approved" | "rejected" | "suspicious" | "completed";
export type TransferVerificationRequest = {
  id: string; codeHash: string; codeSalt: string; status: TransferVerificationStatus; createdAt: string; expiresAt: string; attempts: number; maxAttempts: number; approvedAt?: string; completedAt?: string; usedAt?: string;
  sender: string; senderName: string; transferType: string; accountType: string; receiver: string; amount: number; transferAmount?: number; fee?: number; totalDebit?: number; balanceBefore?: number; balanceAfter?: number; reference?: string; bankName?: string; accountNumber?: string; routingNumber?: string; recipientAccountType?: string; swift?: string; wallet?: string; memo?: string; recipientContact?: string; recipientAddress?: string; wireCountry?: string; wireCurrency?: string; transferPurpose?: string;
};
type TransferVerificationInput = Omit<TransferVerificationRequest, "id" | "codeHash" | "codeSalt" | "status" | "createdAt" | "expiresAt" | "attempts" | "maxAttempts" | "approvedAt" | "completedAt" | "usedAt">;

const STORAGE_KEY = "aurexbank:transfer-verification-requests";
const CHANGE_EVENT = "aurexbank:transfer-verification-requests-change";
const MAX_REQUESTS = 1;
const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const transientCodes = new Map<string, string>();
let cachedRaw = "";
let cachedRequests: TransferVerificationRequest[] = [];
const hasBrowserStorage = () => typeof window !== "undefined";
const generateCode = () => String(Math.floor(100000 + Math.random() * 900000));
const createRequestId = () => `tvr-${crypto.randomUUID()}`;

async function hashCode(code: string, salt: string) {
  const bytes = new TextEncoder().encode(`${salt}:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
}
function createSalt() { const bytes = crypto.getRandomValues(new Uint8Array(16)); return Array.from(bytes, value => value.toString(16).padStart(2, "0")).join(""); }
function isStatus(value: unknown): value is TransferVerificationStatus { return ["pending_admin_code", "pending_code", "pending", "approved", "rejected", "suspicious", "completed"].includes(String(value)); }
function parseRequests(raw: string) { try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed.filter((item): item is TransferVerificationRequest => Boolean(item && typeof item.id === "string" && typeof item.codeHash === "string" && typeof item.codeSalt === "string" && isStatus(item.status))) : []; } catch { return []; } }
function isOpenAndFresh(request: TransferVerificationRequest) { return ["pending_admin_code", "pending_code", "pending", "approved"].includes(request.status) && Date.now() < Date.parse(request.expiresAt) && request.attempts < request.maxAttempts; }
function prune(requests: TransferVerificationRequest[]) { return requests.filter(request => request.status === "completed" || request.status === "rejected" || request.status === "suspicious" || isOpenAndFresh(request)).slice(0, MAX_REQUESTS); }
function read() { if (!hasBrowserStorage()) return "[]"; return window.localStorage.getItem(STORAGE_KEY) ?? "[]"; }
function write(requests: TransferVerificationRequest[]) { if (!hasBrowserStorage()) return; const next = prune(requests); const raw = JSON.stringify(next); cachedRaw = raw; cachedRequests = next; window.localStorage.setItem(STORAGE_KEY, raw); window.dispatchEvent(new Event(CHANGE_EVENT)); }
export function getTransferVerificationSnapshot() { const raw = read(); if (raw === cachedRaw) return cachedRequests; cachedRaw = raw; cachedRequests = prune(parseRequests(raw)); return cachedRequests; }
export function pruneTransferVerificationRequests() { write(getTransferVerificationSnapshot()); }
export function getTransferVerificationServerSnapshot() { return []; }
export function subscribeTransferVerificationRequests(listener: () => void) { if (!hasBrowserStorage()) return () => {}; const handler = (event: StorageEvent) => { if (event.key === STORAGE_KEY) listener(); }; window.addEventListener(CHANGE_EVENT, listener); window.addEventListener("storage", handler); return () => { window.removeEventListener(CHANGE_EVENT, listener); window.removeEventListener("storage", handler); }; }
export function deleteTransferVerificationRequest(id: string) { transientCodes.delete(id); write(getTransferVerificationSnapshot().filter(request => request.id !== id)); }
export async function createTransferVerificationRequest(input: TransferVerificationInput) { const id = createRequestId(); const code = generateCode(); const codeSalt = createSalt(); const request: TransferVerificationRequest = { ...input, id, codeSalt, codeHash: await hashCode(code, codeSalt), status: "pending_admin_code", createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + CODE_TTL_MS).toISOString(), attempts: 0, maxAttempts: MAX_ATTEMPTS }; transientCodes.set(id, code); write([request]); return request; }
export function getTransferVerificationCodeForAdmin(id: string) { return transientCodes.get(id) ?? null; }
export async function notifyAdminTransferCode(request: TransferVerificationRequest) { const { data: { session } } = await supabase.auth.getSession(); if (!session?.access_token) return; await fetch("/api/transfers/verification-notice", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ reference: request.reference ?? request.id }) }); }
export function getTransferVerificationRequest(id: string) { return getTransferVerificationSnapshot().find(request => request.id === id) ?? null; }
export async function transferVerificationCodeMatches(id: string, code: string) { const request = getTransferVerificationRequest(id); if (!request || !isOpenAndFresh(request)) return false; const valid = (await hashCode(code.trim(), request.codeSalt)) === request.codeHash; if (!valid) { update(id, { attempts: request.attempts + 1, ...(request.attempts + 1 >= request.maxAttempts ? { status: "suspicious" } : {}) }); return false; } return true; }
function update(id: string, patch: Partial<TransferVerificationRequest>) { write(getTransferVerificationSnapshot().map(request => request.id === id ? { ...request, ...patch } : request)); }
export function issueTransferVerificationCode(id: string) { update(id, { status: "pending_code", approvedAt: new Date().toISOString() }); }
export function approveTransferVerificationRequest(id: string) { update(id, { status: "approved", approvedAt: new Date().toISOString() }); }
export function completeTransferVerificationRequest(id: string) { transientCodes.delete(id); update(id, { status: "completed", completedAt: new Date().toISOString(), usedAt: new Date().toISOString() }); }
export function rejectTransferVerificationRequest(id: string) { transientCodes.delete(id); update(id, { status: "rejected" }); }
export function markTransferVerificationSuspicious(id: string) { transientCodes.delete(id); update(id, { status: "suspicious" }); }
