import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Aurex Bank | Official Website",
  description: "Aurex Bank provides a digital account dashboard for managing balances, transfers, cards, profile details, and account activity.",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "Aurex Bank | Official Website",
    description: "Manage balances, transfers, cards, profile details, and account activity with Aurex Bank.",
    url: "/",
    siteName: "Aurex Bank",
    type: "website",
    images: [
      {
        url: "/aurex-bank-logo.svg",
        alt: "Aurex Bank logo",
      },
    ],
  },
};

export default function Home() {
  return (
    <main className="min-h-screen bg-[#050606] px-6 py-8 text-white sm:px-10 lg:px-16">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col rounded-3xl border border-green-300/15 bg-gradient-to-br from-[#0b1a12] via-[#07120d] to-[#050606] p-7 shadow-2xl sm:p-12">
        <header className="flex items-center gap-3">
          <Image src="/aurex-bank-logo.svg" alt="Aurex Bank" width={44} height={44} className="size-11" priority />
          <span className="text-xl font-black tracking-tight">Aurex Bank</span>
        </header>
        <section className="my-auto max-w-3xl py-16 sm:py-24">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-green-300">Digital account management</p>
          <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-6xl">Manage your account with clarity.</h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-zinc-300 sm:text-lg">Aurex Bank gives customers one place to view balances, send transfers, manage card preferences, update profile details, and review account activity.</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/auth/signin" className="rounded-xl bg-green-400 px-5 py-3 text-sm font-black text-black transition hover:bg-green-300">Sign in</Link>
            <Link href="/auth/signup" className="rounded-xl border border-white/20 px-5 py-3 text-sm font-black text-white transition hover:bg-white/10">Create account</Link>
          </div>
        </section>
        <p className="text-sm text-zinc-500">Secure access is available to registered Aurex Bank customers.</p>
      </div>
    </main>
  );
}
