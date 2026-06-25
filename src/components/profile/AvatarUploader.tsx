"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";
import AppIcon from "../ui/AppIcon";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];

function isAllowedImage(file: File) {
  if (ALLOWED_TYPES.includes(file.type)) return true;

  const lowerName = file.name.toLowerCase();
  return ALLOWED_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
}

export default function AvatarUploader({
  onUploaded,
}: {
  onUploaded: (avatarUrl: string) => void | Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | null) => {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      if (!isAllowedImage(file)) {
        throw new Error("Upload a JPG, PNG, WebP, HEIC, or HEIF image.");
      }

      if (file.size > MAX_FILE_SIZE) {
        throw new Error("Profile photo must be 5 MB or smaller.");
      }

      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/profile/upload-avatar", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: fd,
      });

      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; avatar_url?: string }
        | null;
      if (!res.ok) {
        throw new Error(data?.error || "Upload failed");
      }


      // Update user_metadata.avatar_url
      const avatar_url = data?.avatar_url;
      if (typeof avatar_url !== "string" || !avatar_url) {
        throw new Error("Missing avatar_url from upload");
      }

      const updateRes = await fetch("/api/profile/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ avatar_url }),
      });

      const updateData = (await updateRes.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;
      if (!updateRes.ok) {
        throw new Error(updateData?.error || "Failed to save avatar URL");
      }

      await onUploaded(avatar_url);
    } catch (err) {
      const e = err as { message?: string };
      setError(e?.message || "Upload failed");

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-w-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-black text-white">Profile Photo</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            JPG, PNG, WebP, HEIC, or HEIF
          </p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-green-400/10 text-green-300">
          <AppIcon name="profile" className="h-5 w-5" />
        </div>
      </div>

      <label
        className={`mt-4 flex h-12 w-full cursor-pointer items-center justify-center rounded-lg text-sm font-black transition-all ${
          loading
            ? "bg-white/10 text-zinc-500"
            : "bg-green-400 text-black hover:bg-green-300"
        }`}
        title="Upload a profile photo"
      >
        {loading ? "Uploading..." : "Upload Photo"}
        <input
          type="file"
          aria-label="Upload a profile photo"
          accept="image/*,.heic,.heif"
          disabled={loading}
          onChange={(event) => {
            void handleFile(event.target.files?.[0] || null);
            event.target.value = "";
          }}
          className="sr-only"
        />
      </label>

      <p className="mt-3 text-xs leading-relaxed text-zinc-600">
        Max 5 MB. Works with phone camera photos, gallery images, and screenshots.
      </p>

      {error && (
        <p className="mt-3 text-sm text-red-200">{error}</p>
      )}
    </div>
  );
}

