"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  isSupabaseConfigured,
  supabase,
  supabaseAuthStorageKey,
} from "../../../src/lib/supabase";
import AurexBrand from "../../../src/components/brand/AurexBrand";

type SignInResponse = {
  ok?: boolean;
  error?: string;
  storageKey?: string;
  session?: {
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
    expires_in?: number;
    token_type?: string;
    user?: unknown;
  };
};

function shouldTryBrowserSignIn(response: Response, result: SignInResponse | null) {
  return response.status >= 500 || result?.error === "Unable to reach authentication service";
}

function getAuthErrorMessage(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  if (/failed to fetch|fetch failed|network|timed out/i.test(message)) {
    return "Unable to reach Aurex Bank authentication. Please check your connection and try again.";
  }

  return message || "Aurex Bank authentication failed. Please try again.";
}

async function setLoginCookie() {
  try {
    await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "set" }),
    });
  } catch {
    // The Supabase client session is the source of truth for the app.
  }
}

function persistSessionFallback(
  storageKey: string | undefined,
  session: SignInResponse["session"]
) {
  if (!storageKey || !session?.access_token || !session.refresh_token) {
    return false;
  }

  try {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        ...session,
        expires_at:
          session.expires_at ||
          Math.round(Date.now() / 1000) + (session.expires_in || 3600),
        token_type: session.token_type || "bearer",
      })
    );
    return true;
  } catch {
    return false;
  }
}

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    const checkSession = async () => {
      if (!isSupabaseConfigured) return;

      const { data } = await supabase.auth.getSession().catch(() => ({
        data: { session: null },
      }));
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

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();

    if (loading) return;

    setLoading(true);
    setError("");

    if (!isSupabaseConfigured) {
      setError("Aurex Bank authentication is not configured for this environment.");
      setLoading(false);
      return;
    }

    if (!email || !password) {
      setError("Please enter both email and password");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const result = (await response.json().catch(() => null)) as
        | SignInResponse
        | null;

      if (!response.ok || !result?.ok) {
        if (shouldTryBrowserSignIn(response, result)) {
          const { data, error: signInError } =
            await supabase.auth.signInWithPassword({
              email,
              password,
            });

          if (signInError) {
            setError(getAuthErrorMessage(signInError));
            setLoading(false);
            return;
          }

          if (!data.session) {
            setError("Unable to establish secure banking session.");
            setLoading(false);
            return;
          }

          await setLoginCookie();
          router.replace("/dashboard");
          return;
        }

        setError(result?.error || "Unable to sign in");
        setLoading(false);
        return;
      }

      const accessToken = result.session?.access_token;
      const refreshToken = result.session?.refresh_token;

      if (!accessToken || !refreshToken) {
        setError("Unable to establish secure banking session.");
        setLoading(false);
        return;
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (sessionError) {
        const stored = persistSessionFallback(
          result.storageKey || supabaseAuthStorageKey || undefined,
          result.session
        );

        if (!stored) {
          setError(getAuthErrorMessage(sessionError));
          setLoading(false);
          return;
        }

        window.location.replace("/dashboard");
        return;
      }

      router.replace("/dashboard");
    } catch (error) {
      setError(getAuthErrorMessage(error));
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-black text-white">
      {/* GRID */}
      <div className="relative z-10 grid min-h-dvh min-w-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        {/* LEFT SIDE */}
        <section className="hidden flex-col justify-between px-6 py-8 lg:flex lg:px-14 lg:py-12">
          {/* TOP */}
          <div>
            {/* LOGO */}
            <AurexBrand
              markClassName="h-16 w-16 rounded-2xl"
              titleClassName="text-4xl"
            />

            {/* HERO */}
            <div className="mt-16">
              <p className="text-green-400 text-xs uppercase tracking-[0.3em] font-semibold">
                Future of Secure Banking
              </p>
              <h2 className="text-6xl lg:text-7xl font-black leading-[0.95] tracking-tight mt-6">
                Banking
                <br />
                Built For
                <br />
                Modern Wealth
              </h2>
              <p className="text-zinc-400 text-lg leading-relaxed mt-8 max-w-2xl">
                Aurex Bank combines digital banking, premium cards, real-time transfers, crypto asset management, and enterprise-grade protection into one secure financial ecosystem.
              </p>
            </div>

            {/* STATS */}
            <div className="grid grid-cols-3 gap-4 mt-14">
              <div className="bg-white/[0.04] border border-white/10 rounded-lg p-5">
                <p className="text-zinc-500 text-sm">Protected Assets</p>
                <h3 className="text-3xl font-black mt-3">$4.8B</h3>
              </div>
              <div className="bg-white/[0.04] border border-white/10 rounded-lg p-5">
                <p className="text-zinc-500 text-sm">Active Clients</p>
                <h3 className="text-3xl font-black mt-3">210K</h3>
              </div>
              <div className="bg-white/[0.04] border border-white/10 rounded-lg p-5">
                <p className="text-zinc-500 text-sm">Global Coverage</p>
                <h3 className="text-3xl font-black mt-3">120+</h3>
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <div className="flex flex-wrap items-center gap-6 mt-10 text-sm text-zinc-500">
                <p>Protected by Aurex Secure</p>
            <div className="w-1 h-1 rounded-full bg-zinc-700" />
            <p>PCI DSS Compliant</p>
            <div className="w-1 h-1 rounded-full bg-zinc-700" />
            <p>End-to-End Encryption</p>
          </div>
        </section>

        {/* RIGHT SIDE */}
        <section className="flex min-h-dvh items-start justify-center px-4 py-5 sm:px-5 sm:py-8 lg:min-h-screen lg:items-center lg:px-10 lg:py-10">
          <div className="w-full max-w-md">
            <div className="mb-5 lg:hidden">
              <AurexBrand
                markClassName="h-12 w-12 rounded-lg"
                titleClassName="text-3xl"
                taglineClassName="text-[11px]"
              />
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur-2xl sm:p-8">
              {/* HEADER */}
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                  <p className="text-green-400 text-xs uppercase tracking-[0.25em] font-semibold">
                    Secure Access Portal
                  </p>
                </div>
                <h2 className="mt-5 text-4xl font-black tracking-tight sm:mt-6 sm:text-5xl">Sign In</h2>
                <p className="mt-3 text-sm leading-relaxed text-zinc-500 sm:mt-4 sm:text-base">
                  Access your Aurex Bank dashboard, premium cards, analytics, transfers, and digital assets securely.
                </p>
              </div>

              {/* FORM */}
              <form onSubmit={handleSignIn} className="mt-6 space-y-4 sm:mt-8 sm:space-y-5">
                {/* EMAIL */}
                <div>
                  <label className="text-sm text-zinc-400 font-medium">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 outline-none transition-all focus:border-green-400 sm:h-14 sm:px-5"
                  />
                </div>

                {/* PASSWORD */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-zinc-400 font-medium">Password</label>
                    <Link
                      href="/auth/forgot-password"
                      className="text-green-400 text-sm font-medium hover:text-green-300 transition-all"
                    >
                      Forgot Password?
                    </Link>
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-black/30 px-4 outline-none transition-all focus:border-green-400 sm:h-14 sm:px-5"
                  />
                </div>

                {/* ERROR */}
                {error && (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                    {error}
                  </div>
                )}

                {/* BUTTON */}
                <button
                  type="submit"
                  disabled={loading}
                  className="h-12 w-full rounded-lg bg-green-400 text-base font-black text-black transition-all hover:bg-green-300 disabled:opacity-50 sm:h-14 sm:text-lg"
                >
                  {loading ? "Signing In..." : "Access Aurex Bank"}
                </button>
              </form>

              {/* FEATURES */}
              <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:gap-4">
                <div className="rounded-lg border border-white/10 bg-black/25 p-3 sm:p-4">
                  <p className="text-zinc-500 text-xs">Banking Tier</p>
                  <h3 className="mt-2 text-xl font-black sm:mt-3 sm:text-2xl">Aurex Black</h3>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/25 p-3 sm:p-4">
                  <p className="text-zinc-500 text-xs">Live Status</p>
                  <h3 className="mt-2 text-xl font-black text-green-400 sm:mt-3 sm:text-2xl">ONLINE</h3>
                </div>
              </div>

              {/* CREATE ACCOUNT */}
              <div className="mt-6 border-t border-white/5 pt-5 text-center sm:mt-8 sm:pt-6">
                <p className="text-zinc-500">New to Aurex Bank?</p>
                <Link
                  href="/auth/signup"
                  className="mt-4 flex h-12 w-full items-center justify-center rounded-lg bg-green-400 font-black text-black transition-all hover:bg-green-300 sm:h-14"
                >
                  Create Account
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
