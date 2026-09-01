"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SecurityVerifyPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <main className="min-h-dvh bg-[var(--brand-background)] px-4 py-5 text-white sm:p-8">
      <div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-md items-center justify-center">
        <section className="w-full rounded-lg border border-white/10 bg-white/[0.04] p-6 text-center shadow-2xl backdrop-blur-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-green-400">Aurex Secure</p>
          <h1 className="mt-4 text-3xl font-black tracking-tight">Security verification is disabled</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            This extra passcode step has been removed from the app. You will be redirected to your dashboard now.
          </p>
        </section>
      </div>
    </main>
  );
}
