import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};
const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "heic", "heif"];

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

function getUsernameFromUser(user: { id: string; email?: string; user_metadata?: unknown }) {
  const metadata =
    user.user_metadata && typeof user.user_metadata === "object"
      ? (user.user_metadata as Record<string, unknown>)
      : {};

  return readText(metadata.username) || readText(user.email) || user.id;
}

function getImageExtension(file: File) {
  const typeExtension = IMAGE_TYPES[file.type];
  if (typeExtension) return typeExtension;

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!IMAGE_EXTENSIONS.includes(extension)) return "";

  return extension === "jpeg" ? "jpg" : extension;
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = getServiceRoleKey();

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonError("Missing Supabase service configuration", 500);
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
    data: { user: adminUser },
    error: adminError,
  } = await authClient.auth.getUser(accessToken);

  if (adminError || !adminUser?.email) {
    return jsonError("Invalid session", 401);
  }

  if (!getAllowedAdminEmails().includes(adminUser.email.toLowerCase())) {
    return jsonError("Admin access required", 403);
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const userId = readText(formData.get("userId"));

  if (!userId) {
    return jsonError("Select a target user", 400);
  }

  if (!file) {
    return jsonError("Missing file", 400);
  }

  const fileExt = getImageExtension(file);

  if (!fileExt) {
    return jsonError("Upload a JPG, PNG, WebP, HEIC, or HEIF image.", 400);
  }

  if (file.size > MAX_FILE_SIZE) {
    return jsonError("Profile photo must be 5 MB or smaller.", 400);
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const {
    data: { user: targetUser },
    error: targetError,
  } = await serviceClient.auth.admin.getUserById(userId);

  if (targetError || !targetUser) {
    return jsonError("Target user not found", 404);
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const fileName = `${targetUser.id}/admin-avatar-${Date.now()}.${fileExt}`;
  const bucket = "avatars";

  const { error: uploadError } = await serviceClient.storage
    .from(bucket)
    .upload(fileName, buffer, {
      cacheControl: "3600",
      contentType: file.type || `image/${fileExt === "jpg" ? "jpeg" : fileExt}`,
      upsert: false,
    });

  if (uploadError) {
    return jsonError(uploadError.message, 400);
  }

  const { data } = serviceClient.storage.from(bucket).getPublicUrl(fileName);
  const avatarUrl = `${data.publicUrl}?v=${Date.now()}`;
  const currentMetadata: Record<string, unknown> =
    targetUser.user_metadata && typeof targetUser.user_metadata === "object"
      ? (targetUser.user_metadata as Record<string, unknown>)
      : {};
  const { error: updateError } = await serviceClient.auth.admin.updateUserById(
    targetUser.id,
    {
      user_metadata: {
        ...currentMetadata,
        avatar_url: avatarUrl,
        admin_updated_at: new Date().toISOString(),
      },
    }
  );

  if (updateError) {
    return jsonError(updateError.message, 500);
  }

  try {
    await serviceClient.from("notifications").insert([
      {
        username: getUsernameFromUser(targetUser),
        message: "Aurex Admin updated your profile photo.",
      },
    ]);
  } catch {}

  return NextResponse.json({ ok: true, avatarUrl });
}
