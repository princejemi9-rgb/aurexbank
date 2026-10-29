import { NextRequest, NextResponse } from "next/server";
import { approvedPersonalAdmin, requestUser, serviceClient } from "../../../../../../src/lib/server/tenantAccess";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const imageExtensions: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif",
};
const allowedExtensions = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif"]);

function imageExtension(file: File) {
  if (imageExtensions[file.type]) return imageExtensions[file.type];
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  return allowedExtensions.has(extension) ? (extension === "jpeg" ? "jpg" : extension) : "";
}

export async function POST(request: NextRequest, context: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await context.params;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const db = serviceClient();
  const user = await requestUser(token);
  if (!db || !user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const admin = await approvedPersonalAdmin(db, user.id);
  if (admin?.status !== "approved" || admin.permissions?.manage_customers !== true) return NextResponse.json({ ok: false, error: "Customer-management permission required" }, { status: 403 });
  const { data: assignment } = await db.from("customer_personal_admin_assignments").select("customer_id").eq("customer_id", customerId).eq("personal_admin_id", user.id).maybeSingle();
  if (!assignment) return NextResponse.json({ ok: false, error: "Customer is outside your portfolio" }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "Select a profile photo." }, { status: 400 });
  const extension = imageExtension(file);
  if (!extension) return NextResponse.json({ ok: false, error: "Upload a JPG, PNG, WebP, HEIC, or HEIF image." }, { status: 400 });
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ ok: false, error: "Profile photo must be 5 MB or smaller." }, { status: 400 });

  const { data: authResult, error: targetError } = await db.auth.admin.getUserById(customerId);
  if (targetError || !authResult.user) return NextResponse.json({ ok: false, error: "Customer not found" }, { status: 404 });
  const fileName = `${customerId}/personal-admin-avatar-${Date.now()}.${extension}`;
  const { error: uploadError } = await db.storage.from("avatars").upload(fileName, Buffer.from(await file.arrayBuffer()), {
    cacheControl: "3600", contentType: file.type || `image/${extension === "jpg" ? "jpeg" : extension}`, upsert: false,
  });
  if (uploadError) return NextResponse.json({ ok: false, error: uploadError.message }, { status: 400 });
  const avatarUrl = `${db.storage.from("avatars").getPublicUrl(fileName).data.publicUrl}?v=${Date.now()}`;
  const existingMetadata = (authResult.user.user_metadata && typeof authResult.user.user_metadata === "object" ? authResult.user.user_metadata : {}) as Record<string, unknown>;
  const { error: authError } = await db.auth.admin.updateUserById(customerId, { user_metadata: { ...existingMetadata, avatar_url: avatarUrl } });
  if (authError) {
    await db.storage.from("avatars").remove([fileName]);
    return NextResponse.json({ ok: false, error: "Unable to update the customer profile photo." }, { status: 503 });
  }
  const { error: detailError } = await db.from("personal_admin_customer_details").update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() }).eq("customer_id", customerId).eq("personal_admin_id", user.id);
  if (detailError) {
    await db.auth.admin.updateUserById(customerId, { user_metadata: existingMetadata });
    await db.storage.from("avatars").remove([fileName]);
    return NextResponse.json({ ok: false, error: "Unable to save the customer profile photo." }, { status: 503 });
  }
  await Promise.all([
    db.from("personal_admin_customer_activity").insert({ personal_admin_id: user.id, customer_id: customerId, actor_id: user.id, action: "customer_avatar_updated" }),
    db.from("personal_admin_audit_log").insert({ actor_id: user.id, personal_admin_id: user.id, target_user_id: customerId, action: "personal_admin_customer_avatar_updated" }),
  ]);
  return NextResponse.json({ ok: true, avatarUrl });
}
