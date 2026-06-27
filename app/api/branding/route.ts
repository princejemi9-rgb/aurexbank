import { Buffer } from "node:buffer";

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import {
  BRANDING_BUCKET,
  BRANDING_CONFIG_PATH,
  DEFAULT_BRANDING,
  getRelativeLuminance,
  isHexColor,
  normalizeBrandingConfig,
  type BrandingConfig,
} from "../../../src/lib/branding";

const MAX_LOGO_SIZE = 2 * 1024 * 1024;
const LOGO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function getServiceRoleKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    ""
  );
}

function getAdminEmails() {
  return (process.env.AUREX_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

function createSupabaseClient(key: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function readBranding(): Promise<BrandingConfig> {
  const serviceClient = createSupabaseClient(getServiceRoleKey());
  if (!serviceClient) return DEFAULT_BRANDING;

  const { data, error } = await serviceClient.storage
    .from(BRANDING_BUCKET)
    .download(BRANDING_CONFIG_PATH);

  if (error || !data) return DEFAULT_BRANDING;

  try {
    return normalizeBrandingConfig(JSON.parse(await data.text()));
  } catch {
    return DEFAULT_BRANDING;
  }
}

async function requireAdmin(request: NextRequest) {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const serviceKey = getServiceRoleKey();
  const authClient = createSupabaseClient(anonKey);
  const serviceClient = createSupabaseClient(serviceKey);

  if (!authClient || !serviceClient) {
    return { error: jsonError("Missing Supabase service configuration", 500) };
  }

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return { error: jsonError("Missing access token", 401) };

  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(token);

  if (error || !user?.email) {
    return { error: jsonError("Invalid session", 401) };
  }

  if (!getAdminEmails().includes(user.email.toLowerCase())) {
    return { error: jsonError("Admin access required", 403) };
  }

  return { serviceClient };
}

export async function GET() {
  return NextResponse.json(
    { ok: true, branding: await readBranding() },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if ("error" in admin) return admin.error;

  const formData = await request.formData();
  const current = await readBranding();
  const bankName = String(formData.get("bankName") || "").trim();
  const primaryColor = String(formData.get("primaryColor") || "").toLowerCase();
  const backgroundColor = String(formData.get("backgroundColor") || "").toLowerCase();
  const restoreDefaults = formData.get("restoreDefaults") === "true";
  const removeLogo = restoreDefaults || formData.get("removeLogo") === "true";
  const logo = formData.get("logo");
  const nextPrimaryColor = restoreDefaults
    ? DEFAULT_BRANDING.primaryColor
    : primaryColor;
  const nextBackgroundColor = restoreDefaults
    ? DEFAULT_BRANDING.backgroundColor
    : backgroundColor;

  if (bankName.length < 2 || bankName.length > 48) {
    return jsonError("Bank name must be between 2 and 48 characters.", 400);
  }
  if (!isHexColor(nextPrimaryColor) || !isHexColor(nextBackgroundColor)) {
    return jsonError("Choose valid primary and background colors.", 400);
  }
  if (getRelativeLuminance(nextPrimaryColor) < 0.28) {
    return jsonError("Choose a brighter primary color so buttons remain readable.", 400);
  }
  if (getRelativeLuminance(nextBackgroundColor) > 0.24) {
    return jsonError("Choose a darker background color so account details remain readable.", 400);
  }

  let logoUrl = removeLogo ? "" : current.logoUrl;
  let logoPath = removeLogo ? "" : current.logoPath;

  if (logo instanceof File && logo.size > 0) {
    const extension = LOGO_TYPES[logo.type];
    if (!extension) {
      return jsonError("Upload a PNG, JPG, or WebP logo.", 400);
    }
    if (logo.size > MAX_LOGO_SIZE) {
      return jsonError("Bank logo must be 2 MB or smaller.", 400);
    }

    const nextLogoPath = `branding/logo-${Date.now()}.${extension}`;
    const { error: uploadError } = await admin.serviceClient.storage
      .from(BRANDING_BUCKET)
      .upload(nextLogoPath, Buffer.from(await logo.arrayBuffer()), {
        cacheControl: "31536000",
        contentType: logo.type,
        upsert: false,
      });

    if (uploadError) return jsonError(uploadError.message, 400);

    const { data } = admin.serviceClient.storage
      .from(BRANDING_BUCKET)
      .getPublicUrl(nextLogoPath);
    logoUrl = `${data.publicUrl}?v=${Date.now()}`;
    logoPath = nextLogoPath;
  }

  const branding = normalizeBrandingConfig({
    bankName,
    logoUrl,
    logoPath,
    primaryColor: nextPrimaryColor,
    backgroundColor: nextBackgroundColor,
    updatedAt: new Date().toISOString(),
  });
  const { error: configError } = await admin.serviceClient.storage
    .from(BRANDING_BUCKET)
    .upload(BRANDING_CONFIG_PATH, Buffer.from(JSON.stringify(branding)), {
      cacheControl: "0",
      contentType: "application/json",
      upsert: true,
    });

  if (configError) return jsonError(configError.message, 500);

  if (current.logoPath && current.logoPath !== logoPath) {
    await admin.serviceClient.storage
      .from(BRANDING_BUCKET)
      .remove([current.logoPath]);
  }

  return NextResponse.json({ ok: true, branding });
}
