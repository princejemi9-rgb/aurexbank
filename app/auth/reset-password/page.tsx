"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../src/lib/supabase";
import AurexBrand from "../../../src/components/brand/AurexBrand";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const passwordChecks = useMemo(
    () => [
      { label: "At least 8 characters", passed: newPassword.length >= 8 },
      { label: "Contains a number", passed: /\d/.test(newPassword) },
      { label: "Contains uppercase", passed: /[A-Z]/.test(newPassword) },
      { label: "Passwords match", passed: !!newPassword && newPassword === confirmPassword },
    ],
    [confirmPassword, newPassword]
  );

  useEffect(() => {
    const handleHash = async () => {
      const hash = window.location.hash;
      if (!hash) return;
      const params = new URLSearchParams(hash.replace(/^#/, ""));
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const type = params.get("type");

      if (accessToken && refreshToken && type === "recovery") {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          setError("Your reset link is invalid or has expired. Please request a new one.");
        }
      }
    };

    void handleHash();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (!/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError("Password must include at least one uppercase letter and one number.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError(updateError.message || "Unable to update your password right now.");
        setLoading(false);
        return;
      }

      setSuccess("Your password has been updated. You can now sign in with your new password.");
      setNewPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        router.replace("/auth/signin");
      }, 1800);
    } catch {
      setError("Unable to update your password right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--brand-background)] text-white">
      <div className="relative z-10 grid min-h-screen min-w-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="flex flex-col justify-between px-6 py-8 lg:px-14 lg:py-12">
          <div>
            <AurexBrand
              markClassName="h-16 w-16 rounded-2xl"
              titleClassName="text-4xl"
            />

            <div className="mt-16">
              <p className="text-green-400 text-xs uppercase tracking-[0.3em] font-semibold">Secure Access Portal</p>
              <h2 className="mt-6 text-6xl font-black leading-[0.95] tracking-tight lg:text-7xl">Create A New Password</h2>
              <p className="mt-8 max-w-2xl text-lg leading-relaxed text-zinc-400">
                Choose a strong password to protect your Aurex Bank account. This will replace your old login password.
              </p>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-6 text-sm text-zinc-500">
            <p>Protected by Aurex Secure</p>
            <div className="h-1 w-1 rounded-full bg-zinc-700" />
            <p>PCI DSS Compliant</p>
            <div className="h-1 w-1 rounded-full bg-zinc-700" />
            <p>End-to-End Encryption</p>
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-10 lg:px-10">
          <div className="w-full max-w-md">
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-8 shadow-2xl backdrop-blur-2xl">
              <div>
                <div className="flex items-center gap-3">
                  <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-green-400" />
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-green-400">Password Recovery</p>
                </div>
                <h2 className="mt-6 text-5xl font-black tracking-tight">Reset Password</h2>
              </div>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <div>
                  <label className="text-sm font-medium text-zinc-400">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="Enter new password"
                    className="mt-2 h-14 w-full rounded-2xl border border-white/10 bg-black/30 px-5 outline-none transition-all focus:border-green-400"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-zinc-400">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Re-enter new password"
                    className="mt-2 h-14 w-full rounded-2xl border border-white/10 bg-black/30 px-5 outline-none transition-all focus:border-green-400"
                  />
                </div>

                <div className="space-y-2 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
                  {passwordChecks.map((check) => (
                    <div key={check.label} className="flex items-center justify-between gap-3">
                      <span>{check.label}</span>
                      <span className={check.passed ? "text-green-400" : "text-zinc-500"}>
                        {check.passed ? "✓" : "○"}
                      </span>
                    </div>
                  ))}
                </div>

                {error && (
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="rounded-2xl border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-300">
                    {success}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="h-14 w-full rounded-2xl bg-green-400 text-lg font-black text-black transition-all hover:bg-green-300 disabled:opacity-50"
                >
                  {loading ? "Updating Password..." : "Update Password"}
                </button>

                <div className="pt-2 text-center">
                  <Link href="/auth/signin" className="text-sm font-medium text-green-400 transition-all hover:text-green-300">
                    Back to Sign In
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
