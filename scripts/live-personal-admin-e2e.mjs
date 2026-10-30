import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split(/\r?\n/).map(line => line.match(/^([^#=]+)=(.*)$/)).filter(Boolean).map(([, key, value]) => [key, value.replace(/^['"]|['"]$/g, "")]));
const url = env.NEXT_PUBLIC_SUPABASE_URL, anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY, service = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anon || !service) throw new Error("Required Supabase test configuration is missing.");
const app = "https://aurexbank.vercel.app";
const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const paEmail = `pa-e2e-${suffix}@example.test`, customerEmail = `customer-e2e-${suffix}@example.test`, password = `AurexTest${Math.random().toString(36).slice(2, 10)}9`;
let paId = "", customerId = "", customerToken = "", paToken = "", documentPath = "";
const assert = (condition, message) => { if (!condition) throw new Error(message); };
async function api(path, token, options = {}) { const response = await fetch(`${app}${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) } }); const data = await response.json().catch(() => ({})); if (!response.ok || data.ok === false) throw new Error(`${path}: ${data.error || response.statusText}`); return data; }
async function signIn(email) { const client = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } }); const { data, error } = await client.auth.signInWithPassword({ email, password }); if (error || !data.session?.access_token) throw new Error(`Unable to sign in ${email}: ${error?.message || "no session"}`); return data.session.access_token; }
async function cleanup() { if (documentPath) await admin.storage.from("customer-documents").remove([documentPath]).catch(() => {}); if (customerEmail) { try { await admin.from("notifications").delete().eq("username", customerEmail); } catch {} } if (customerId) await admin.auth.admin.deleteUser(customerId).catch(() => {}); if (paId) await admin.auth.admin.deleteUser(paId).catch(() => {}); }
async function removePreviousTestUsers() { const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 }); for (const user of data.users.filter(row => /^(pa|customer)-e2e-.*@example\.test$/i.test(row.email || ""))) await admin.auth.admin.deleteUser(user.id); }

try {
  await removePreviousTestUsers();
  const createdPa = await admin.auth.admin.createUser({ email: paEmail, password, email_confirm: true, user_metadata: { personal_admin_registration: true, full_name: "E2E Personal Admin", phone: "+15550000001" } });
  assert(createdPa.data.user?.id, `Personal Admin creation failed: ${createdPa.error?.message || "unknown"}`); paId = createdPa.data.user.id; paToken = await signIn(paEmail);
  await api("/api/personal-admin", paToken, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName: "E2E Personal Admin", phone: "+15550000001" }) });
  const profile = await api("/api/personal-admin", paToken); assert(profile.personalAdmin?.status === "approved", "Personal Admin did not activate.");
  await admin.from("personal_admin_profiles").update({ permissions: { manage_customers: true, manage_support: true, manage_reports: true, manage_financial_adjustments: true } }).eq("user_id", paId);
  console.log("✓ Personal Admin registration and login");

  const openingBalance = 1234.56;
  const customer = await api("/api/personal-admin/customers", paToken, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName: "E2E Customer", email: customerEmail, phone: "+15550000002", country: "United States", accountType: "personal", address: "1 Test Street", initialPassword: password, openingBalance }) });
  customerId = customer.customer.id; customerToken = await signIn(customerEmail);
  const createdCustomerList = await api("/api/personal-admin/customers", paToken);
  const createdPortfolioCustomer = createdCustomerList.customers.find(row => row.id === customerId);
  assert(Number(createdPortfolioCustomer?.balance) === openingBalance, `Opening balance was not persisted for the Personal Admin customer (expected ${openingBalance}, received ${createdPortfolioCustomer?.balance ?? "missing"}; creation returned ${customer.customer.opening_balance ?? "missing"}).`);
  console.log("✓ Customer creation, opening balance, and normal login");

  if (process.argv.includes("--controls")) {
    await api(`/api/personal-admin/customers/${customerId}/card`, paToken, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "issue" }) });
    const otp = await api(`/api/personal-admin/customers/${customerId}/otp`, paToken, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purpose: "account_recovery" }) }); assert(/^\d{6}$/.test(otp.code), "OTP was not issued."); console.log("✓ Virtual card and one-time passcode");
    const overview = await api("/api/personal-admin/overview", paToken), report = await api("/api/personal-admin/reports", paToken), list = await api("/api/personal-admin/customers", paToken); assert(overview.metrics.assignedCustomers >= 1 && report.metrics.assignedCustomers >= 1 && list.customers.some(row => row.id === customerId), "Portfolio overview, reports, or customer list failed."); console.log("✓ Overview, reporting, and portfolio data"); console.log("LIVE PERSONAL ADMIN CONTROLS: PASS");
  }

  if (!process.argv.includes("--controls")) {
  const started = await api("/api/support/chat", customerToken, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject: "E2E support", message: "Customer support test", language: "en" }) });
  const inbox = await api("/api/personal-admin/support", paToken); assert(inbox.conversations.some(row => row.id === started.conversationId), "Assigned Personal Admin cannot see customer chat.");
  await api("/api/personal-admin/support", paToken, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId: started.conversationId, message: "Personal Admin reply test" }) });
  const thread = await api(`/api/support/chat?conversationId=${started.conversationId}`, customerToken); assert(thread.messages.some(row => row.original_text === "Personal Admin reply test"), "Customer cannot see Personal Admin reply."); console.log("✓ Tenant-scoped customer care chat");

  await api(`/api/personal-admin/customers/${customerId}/records`, paToken, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "note", note: "E2E immutable note" }) });
  await api(`/api/personal-admin/customers/${customerId}/records`, paToken, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "verification", status: "verified", reviewNote: "E2E verification" }) });
  const form = new FormData(); form.set("documentType", "identity"); form.set("file", new Blob(["e2e document"], { type: "application/pdf" }), "e2e.pdf");
  const uploaded = await api(`/api/personal-admin/customers/${customerId}/documents`, paToken, { method: "POST", body: form }); const records = await api(`/api/personal-admin/customers/${customerId}/records`, paToken); assert(records.notes.length && records.verification.status === "verified" && records.documents.some(row => row.id === uploaded.document.id), "Customer records did not persist.");
  const document = await api(`/api/personal-admin/customers/${customerId}/documents?documentId=${uploaded.document.id}`, paToken); assert(document.url, "Private document signing failed."); await api(`/api/personal-admin/customers/${customerId}/documents?documentId=${uploaded.document.id}`, paToken, { method: "DELETE" }); console.log("✓ Records, verification, private-document upload/view/remove");

  await api("/api/personal-admin/notifications", paToken, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId, message: "E2E notification" }) });
  const notifications = await api("/api/personal-admin/notifications", paToken); assert(notifications.notifications.some(row => row.message === "E2E notification"), "Notification did not persist."); console.log("✓ Customer notifications");

  const request = await api("/api/transaction-requests", customerToken, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestType: "account_service", description: "E2E account service request" }) });
  const pending = await api("/api/personal-admin/transaction-requests", paToken); assert(pending.requests.some(row => row.id === request.request.id), "Personal Admin cannot see customer request."); await api("/api/personal-admin/transaction-requests", paToken, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: request.request.id, status: "approved", reviewNote: "E2E approved" }) }); console.log("✓ Customer requests and review");

  await api(`/api/personal-admin/customers/${customerId}/card`, paToken, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "issue" }) });
  const otp = await api(`/api/personal-admin/customers/${customerId}/otp`, paToken, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purpose: "account_recovery" }) }); assert(/^\d{6}$/.test(otp.code), "OTP was not issued."); console.log("✓ Virtual card and one-time passcode");

  const overview = await api("/api/personal-admin/overview", paToken), report = await api("/api/personal-admin/reports", paToken), list = await api("/api/personal-admin/customers", paToken); assert(overview.metrics.assignedCustomers >= 1 && report.metrics.assignedCustomers >= 1 && list.customers.some(row => row.id === customerId), "Portfolio overview, reports, or customer list failed."); console.log("✓ Overview, reporting, referral/customer portfolio data");
  console.log("LIVE PERSONAL ADMIN E2E: PASS");
  }
} finally { await cleanup(); }
