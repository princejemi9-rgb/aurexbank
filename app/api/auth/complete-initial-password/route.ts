import { NextResponse, type NextRequest } from "next/server";
import { requestUser, serviceClient } from "../../../../src/lib/server/tenantAccess";

export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const db = serviceClient(); const user = await requestUser(token);
  if (!db || !user) return NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 });
  const body = await request.json().catch(() => null) as { password?: unknown } | null;
  const password = typeof body?.password === "string" ? body.password : "";
  if (password.length < 10 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) return NextResponse.json({ ok: false, error: "Use at least 10 characters including uppercase, lowercase, and a number." }, { status: 400 });
  const { data: requirement, error: requirementError } = await db.from("customer_initial_password_requirements").select("password_change_required").eq("customer_id", user.id).maybeSingle();
  if (requirementError) return NextResponse.json({ ok: false, error: "Unable to verify your account setup." }, { status: 503 });
  if (requirement?.password_change_required !== true) return NextResponse.json({ ok: false, error: "An initial password change is not required." }, { status: 409 });
  const { error: passwordError } = await db.auth.admin.updateUserById(user.id, { password });
  if (passwordError) return NextResponse.json({ ok: false, error: "Unable to update your password. Please try again." }, { status: 503 });
  const { error: completedError } = await db.rpc("complete_customer_initial_password_change", { p_customer_id: user.id });
  if (completedError) return NextResponse.json({ ok: false, error: "Your password changed, but account setup is still pending. Contact support if this persists." }, { status: 503 });
  return NextResponse.json({ ok: true });
}
