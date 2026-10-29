import { NextResponse, type NextRequest } from "next/server";
import { requestUser, serviceClient } from "../../../../src/lib/server/tenantAccess";

export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const db = serviceClient(); const user = await requestUser(token);
  if (!db || !user) return NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 });
  const { data, error } = await db.from("customer_initial_password_requirements").select("password_change_required").eq("customer_id", user.id).maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: "Unable to check initial-password status." }, { status: 503 });
  return NextResponse.json({ ok: true, required: data?.password_change_required === true });
}
