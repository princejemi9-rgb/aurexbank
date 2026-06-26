"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import DesktopSidebar from "../../../src/components/layout/DesktopSidebar";
import BottomNav from "../../../src/components/navigation/BottomNav";
import AppIcon from "../../../src/components/ui/AppIcon";
import { supabase } from "../../../src/lib/supabase";

export default function PasswordSecurityPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const checks = useMemo(
    () => [
      { label: "At least 8 characters", passed: newPassword.length >= 8 },
      { label: "Contains a number", passed: /\d/.test(newPassword) },
      { label: "Contains uppercase", passed: /[A-Z]/.test(newPassword) },
      { label: "Passwords match", passed: !!newPassword && newPassword === confirmPassword },
    ],
    [confirmPassword, newPassword]
  );

  const strength = checks.filter((check) => check.passed).length;

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!currentPassword.trim()) {
      setError("Enter your current password to confirm this change.");
      return;
    }

    if (strength < checks.length) {
      setError("Complete all password requirements before updating.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess("Aurex Bank password updated successfully.");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");

    window.setTimeout(() => {
      router.push("/settings");
    }, 1200);
  }

  return (
    <main className="bank-shell min-h-screen overflow-x-hidden text-white">
      <DesktopSidebar />

      <div className="app-content lg:ml-[16.25rem]">
        <div className="app-inner">
          <section className="bank-surface mb-6 rounded-lg p-6 lg:p-8">
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
              <p className="text-xs font-black uppercase tracking-[0.22em] text-green-400">
                Aurex Secure Protection
              </p>
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-tight lg:text-5xl">
              Change Password
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-relaxed text-zinc-400">
              Protect your banking profile with a stronger password and security requirements.
            </p>
          </section>

          <div className="grid min-w-0 gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(320px,340px)]">
            <form onSubmit={updatePassword} className="bank-surface rounded-lg p-6">
              <p className="text-sm font-semibold text-green-400">Password Update</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">Secure Credentials</h2>

              <div className="mt-6 space-y-4">
                {[
                  {
                    label: "Current Password",
                    value: currentPassword,
                    setValue: setCurrentPassword,
                    autoComplete: "current-password",
                  },
                  {
                    label: "New Password",
                    value: newPassword,
                    setValue: setNewPassword,
                    autoComplete: "new-password",
                  },
                  {
                    label: "Confirm Password",
                    value: confirmPassword,
                    setValue: setConfirmPassword,
                    autoComplete: "new-password",
                  },
                ].map((field) => (
                  <label key={field.label} className="block">
                    <span className="text-sm font-medium text-zinc-400">{field.label}</span>
                    <input
                      type="password"
                      value={field.value}
                      onChange={(event) => field.setValue(event.target.value)}
                      autoComplete={field.autoComplete}
                      required
                      className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 text-sm font-semibold outline-none transition-all focus:border-green-400"
                    />
                  </label>
                ))}
              </div>

              {error && (
                <div className="mt-5 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm font-semibold text-red-300">
                  {error}
                </div>
              )}

              {success && (
                <div className="mt-5 rounded-lg border border-green-500/20 bg-green-500/10 p-4 text-sm font-semibold text-green-300">
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-6 w-full rounded-lg bg-green-400 py-4 text-sm font-black text-black transition-all hover:bg-green-300 disabled:opacity-50"
              >
                {loading ? "Updating Password..." : "Update Password"}
              </button>
            </form>

            <aside className="min-w-0 space-y-6">
              <section className="bank-surface rounded-lg p-6">
                <p className="text-sm font-semibold text-green-400">Password Strength</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight">{strength}/4</h2>
                <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-black/40">
                  <div
                    className="h-full rounded-full bg-green-400 transition-all"
                    style={{ width: `${(strength / checks.length) * 100}%` }}
                  />
                </div>
                <div className="mt-6 space-y-3">
                  {checks.map((check) => (
                    <div key={check.label} className="flex items-center gap-3">
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full ${
                          check.passed ? "bg-green-400 text-black" : "bg-white/10 text-zinc-600"
                        }`}
                      >
                        <AppIcon name="check" className="h-3 w-3" />
                      </span>
                      <p className="text-sm text-zinc-400">{check.label}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-green-300/15 bg-green-400/[0.07] p-6">
                <p className="text-sm font-semibold text-green-400">Account Protection</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight">Session Safety</h2>
                <p className="mt-4 text-sm leading-relaxed text-zinc-400">
                  After a password change, review trusted devices and remove any session you do not recognize.
                </p>
              </section>
            </aside>
          </div>

        </div>
      </div>

      <BottomNav />
    </main>
  );
}
