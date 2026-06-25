"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../src/lib/supabase";
import Link from "next/link";
import AurexBrand from "../../../src/components/brand/AurexBrand";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  useEffect(() => {
    let mounted = true;
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data.session) {
        router.replace("/dashboard");
      }
    };

    checkSession();

    return () => {
      mounted = false;
    };
  }, [router]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  const emailValid = useMemo(() => {
    return !!email && email.includes("@");
  }, [email]);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!emailValid) {
      setError("Enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const { data, error: resetError } = await supabase.auth.resetPasswordForEmail(
        email
      );

      if (resetError) {
        setError(resetError.message);
        return;
      }

      // Modern banking UX: don't reveal whether an email exists.
      // Supabase typically returns a generic response.
      if (data) {
        setSuccess(
          "If an account exists for this email, you’ll receive a password reset link shortly."
        );
      } else {
        setSuccess(
          "If an account exists for this email, you’ll receive a password reset link shortly."
        );
      }
    } catch {
      setError("Failed to send reset link. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="relative z-10 grid min-h-screen min-w-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="flex flex-col justify-between px-6 py-8 lg:px-14 lg:py-12">
          <div>
            <AurexBrand
              markClassName="h-16 w-16 rounded-2xl"
              titleClassName="text-4xl"
            />

            <div className="mt-16">
              <p className="text-green-400 text-xs uppercase tracking-[0.3em] font-semibold">
                Secure Access Portal
              </p>
              <h2 className="text-6xl lg:text-7xl font-black leading-[0.95] tracking-tight mt-6">
                Reset Your
                <br />
                Password
              </h2>
              <p className="text-zinc-400 text-lg leading-relaxed mt-8 max-w-2xl">
                Enter your email and we’ll send you a secure link to reset your password.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 mt-10 text-sm text-zinc-500">
            <p>Protected by Aurex Secure</p>
            <div className="w-1 h-1 rounded-full bg-zinc-700" />
            <p>PCI DSS Compliant</p>
            <div className="w-1 h-1 rounded-full bg-zinc-700" />
            <p>End-to-End Encryption</p>
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-10 lg:px-10">
          <div className="w-full max-w-md">
            <div className="bg-white/[0.04] border border-white/10 backdrop-blur-2xl rounded-lg p-8 shadow-2xl">
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                  <p className="text-green-400 text-xs uppercase tracking-[0.25em] font-semibold">
                    Password Recovery
                  </p>
                </div>
                <h2 className="text-5xl font-black mt-6 tracking-tight">Forgot Password</h2>
                <p className="text-zinc-500 mt-4 leading-relaxed">
                  For your security, we’ll send the reset link only to the email on your account.
                </p>
              </div>

              <form onSubmit={handleReset} className="mt-8 space-y-5">
                <div>
                  <label className="text-sm text-zinc-400 font-medium">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full mt-2 h-14 rounded-2xl bg-black/30 border border-white/10 px-5 outline-none focus:border-green-400 transition-all"
                  />
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
                  className="w-full h-14 rounded-2xl bg-green-400 text-black font-black text-lg hover:bg-green-300 transition-all disabled:opacity-50"
                >
                  {loading ? "Sending..." : "Send Reset Link"}
                </button>

                <div className="pt-2 text-center">
                  <Link
                    href="/auth/signin"
                    className="text-green-400 text-sm font-medium hover:text-green-300 transition-all"
                  >
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

