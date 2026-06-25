"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import type { BankingProfile } from "../../context/BankingContext";
import { supabase } from "../../lib/supabase";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
  profile: BankingProfile;
};

function editableValue(value: string) {
  return value === "Not provided" ? "" : value;
}

function getLastName(profile: BankingProfile) {
  const fullName = editableValue(profile.fullName).trim();
  const firstName = editableValue(profile.firstName).trim();

  if (!fullName || !firstName || fullName === firstName) return "";
  return fullName.toLowerCase().startsWith(firstName.toLowerCase())
    ? fullName.slice(firstName.length).trim()
    : "";
}

export default function EditProfileModal({ open, onClose, onSaved, profile }: Props) {
  if (!open) return null;

  return (
    <EditProfileForm
      key={`${profile.userId}:${profile.fullName}:${profile.phone}:${profile.country}`}
      onClose={onClose}
      onSaved={onSaved}
      profile={profile}
    />
  );
}

function EditProfileForm({
  onClose,
  onSaved,
  profile,
}: Omit<Props, "open">) {
  const [firstName, setFirstName] = useState(() => editableValue(profile.firstName));
  const [lastName, setLastName] = useState(() => getLastName(profile));
  const [phone, setPhone] = useState(() => editableValue(profile.phone));
  const [country, setCountry] = useState(() => editableValue(profile.country));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!firstName.trim()) {
        throw new Error("Enter your first name.");
      }

      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const res = await fetch("/api/profile/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim(),
          country: country.trim(),
        }),
      });

      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;
      if (!res.ok) {
        throw new Error(data?.error || "Failed to update profile");
      }

      await onSaved();
      onClose();
    } catch (err) {
      const e = err as { message?: string };
      setError(e?.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur-xl sm:items-center sm:p-4">
      <form
        onSubmit={handleSave}
        className="my-4 max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-lg border border-white/10 bg-[#07120d] p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-green-400">Profile Details</p>
            <h2 className="mt-1 text-3xl font-black tracking-tight">Edit Profile</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">
              Keep your Aurex identity details current for verification and support.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="bank-button shrink-0 rounded-lg px-3 py-2 text-sm font-black"
          >
            Close
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm text-zinc-400" title="First name">
              First Name
            </label>
            <input
              title="First name"
              aria-label="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-sm font-semibold outline-none focus:border-green-400"
            />
          </div>
          <div>
            <label className="text-sm text-zinc-400" title="Last name">
              Last Name
            </label>
            <input
              title="Last name"
              aria-label="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-sm font-semibold outline-none focus:border-green-400"
            />
          </div>
          <div>
            <label className="text-sm text-zinc-400" title="Phone">
              Phone
            </label>
            <input
              title="Phone"
              aria-label="Phone"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-sm font-semibold outline-none focus:border-green-400"
            />
          </div>
          <div>
            <label className="text-sm text-zinc-400" title="Country">
              Country
            </label>
            <input
              title="Country"
              aria-label="Country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-sm font-semibold outline-none focus:border-green-400"
            />
          </div>
        </div>

        {error && (
          <div className="mt-5 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm font-semibold text-red-200">
            {error}
          </div>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)]">
          <button
            type="button"
            onClick={onClose}
            className="bank-button rounded-lg px-5 py-4 text-sm font-black"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-green-400 px-5 py-4 text-sm font-black text-black transition-all hover:bg-green-300 disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

