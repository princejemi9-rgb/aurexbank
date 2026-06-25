import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Expects multipart/form-data with fields:
// - file: the image
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};
const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "heic", "heif"];

function getServiceRoleKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    ""
  );
}

function getImageExtension(file: File) {
  const typeExtension = IMAGE_TYPES[file.type];
  if (typeExtension) return typeExtension;

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!IMAGE_EXTENSIONS.includes(extension)) return "";

  return extension === "jpeg" ? "jpg" : extension;
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { ok: false, error: "Missing Supabase env vars" },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get("authorization") || "";
    const accessToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;

    if (!accessToken) {
      return NextResponse.json(
        { ok: false, error: "Missing access token" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { ok: false, error: "Missing file" },
        { status: 400 }
      );
    }

    const fileExt = getImageExtension(file);

    if (!fileExt) {
      return NextResponse.json(
        { ok: false, error: "Upload a JPG, PNG, WebP, HEIC, or HEIF image." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { ok: false, error: "Profile photo must be 5 MB or smaller." },
        { status: 400 }
      );
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const {
      data: { user },
      error: userErr,
    } = await authClient.auth.getUser(accessToken);

    if (userErr || !user) {
      return NextResponse.json(
        { ok: false, error: "Invalid session" },
        { status: 401 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const serviceRoleKey = getServiceRoleKey();
    const storageClient = createClient(supabaseUrl, serviceRoleKey || supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      ...(serviceRoleKey
        ? {}
        : {
            global: {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            },
          }),
    });

    const fileName = `${user.id}/avatar-${Date.now()}.${fileExt}`;

    const bucket = "avatars";

    const { error: upErr } = await storageClient.storage
      .from(bucket)
      .upload(fileName, buffer, {
        cacheControl: "3600",
        contentType: file.type || `image/${fileExt === "jpg" ? "jpeg" : fileExt}`,
        upsert: false,
      });

    if (upErr) {
      return NextResponse.json(
        { ok: false, error: upErr.message },
        { status: 400 }
      );
    }

    const { data } = storageClient.storage.from(bucket).getPublicUrl(fileName);

    const avatar_url = `${data.publicUrl}?v=${Date.now()}`;

    return NextResponse.json({ ok: true, avatar_url, fileName });
  } catch (err) {
    const e = err as { message?: string };
    return NextResponse.json(
      { ok: false, error: e?.message || "server_error" },
      { status: 500 }
    );
  }
}


