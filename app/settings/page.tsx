"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTheme } from "../../src/context/ThemeContext";
import { supabase } from "../../src/lib/supabase";
import DesktopSidebar from "../../src/components/layout/DesktopSidebar";
import BottomNav from "../../src/components/navigation/BottomNav";
import AppIcon from "../../src/components/ui/AppIcon";

type ToggleProps = {
  enabled: boolean;
  onClick: () => void;
};

function Toggle({ enabled, onClick }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label="Toggle setting"
      onClick={onClick}
      className={`flex h-8 w-14 shrink-0 items-center rounded-full px-1 transition-all ${
        enabled ? "justify-end bg-green-400" : "justify-start bg-white/10"
      }`}
      title="Toggle setting"
    >
      <span className="h-6 w-6 rounded-full bg-white shadow-lg" />
    </button>
  );
}

type SettingRowProps = {
  title: string;
  description: string;
  enabled: boolean;
  onClick: () => void;
};

function SettingRow({ title, description, enabled, onClick }: SettingRowProps) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-5 rounded-lg border border-white/10 bg-black/25 p-5">
      <div className="min-w-0">
        <h3 className="break-words text-lg font-black">{title}</h3>
        <p className="mt-1 break-words text-sm text-zinc-500">{description}</p>
      </div>
      <Toggle enabled={enabled} onClick={onClick} />
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [notifications, setNotifications] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("aurexbank-notifications");
      return saved !== null ? saved === "true" : true;
    }
    return true;
  });
  const [biometrics, setBiometrics] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("aurexbank-biometrics");
      return saved !== null ? saved === "true" : true;
    }
    return true;
  });
  const [emailAlerts, setEmailAlerts] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("aurexbank-email-alerts");
      return saved !== null ? saved === "true" : true;
    }
    return true;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("aurexbank-notifications", notifications.toString());
    }
  }, [notifications]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("aurexbank-biometrics", biometrics.toString());
    }
  }, [biometrics]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("aurexbank-email-alerts", emailAlerts.toString());
    }
  }, [emailAlerts]);

  const handleLogout = async () => {
    await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "clear" }),
    });
    await supabase.auth.signOut();
    window.location.replace("/login");
  };

  const handleDeactivate = () => {
    // Navigate to deactivate page
    router.push("/security/deactivate");
  };

  return (
    <main className="bank-shell min-h-screen overflow-x-hidden text-white">
      <DesktopSidebar />

      <div className="app-content lg:ml-72">
        <div className="app-inner">
          <section className="bank-surface mb-6 rounded-lg p-6 lg:p-8">
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-green-400">
                Banking Preferences Center
              </p>
            </div>

            <h1 className="mt-5 text-4xl font-black tracking-tight lg:text-5xl">
              Settings
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-zinc-400">
              Manage account preferences, privacy controls, notifications, and security settings.
            </p>
          </section>

          <div className="grid min-w-0 gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
            <div className="min-w-0 space-y-6">
              <section className="bank-surface rounded-lg p-6">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-500">Personalization</p>
                    <h2 className="mt-1 text-3xl font-black tracking-tight">Appearance</h2>
                  </div>
                  <span className="rounded-lg border border-white/10 bg-white/[0.045] p-2 text-zinc-500">
                    <AppIcon name="spark" className="h-5 w-5" />
                  </span>
                </div>

                <SettingRow
                  title="Dark Mode"
                  description={theme === "dark" ? "Premium dark banking interface" : "Light mode interface"}
                  enabled={theme === "dark"}
                  onClick={toggleTheme}
                />
              </section>

              <section className="bank-surface rounded-lg p-6">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-500">Alerts and Messages</p>
                    <h2 className="mt-1 text-3xl font-black tracking-tight">Notifications</h2>
                  </div>
                  <span className="rounded-lg border border-white/10 bg-white/[0.045] p-2 text-zinc-500">
                    <AppIcon name="bell" className="h-5 w-5" />
                  </span>
                </div>

                <div className="space-y-3">
                  <SettingRow
                    title="Push Notifications"
                    description="Banking activity alerts"
                    enabled={notifications}
                    onClick={() => setNotifications((current) => !current)}
                  />
                  <SettingRow
                    title="Email Alerts"
                    description="Security and transfer emails"
                    enabled={emailAlerts}
                    onClick={() => setEmailAlerts((current) => !current)}
                  />
                </div>
              </section>

              <section className="bank-surface rounded-lg p-6">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-500">Protection Systems</p>
                    <h2 className="mt-1 text-3xl font-black tracking-tight">Security</h2>
                  </div>
                  <span className="rounded-lg border border-white/10 bg-white/[0.045] p-2 text-zinc-500">
                    <AppIcon name="shield" className="h-5 w-5" />
                  </span>
                </div>

                <div className="space-y-3">
                  <SettingRow
                    title="Biometrics"
                    description="Face ID and fingerprint login"
                    enabled={biometrics}
                    onClick={() => setBiometrics((current) => !current)}
                  />
                  <Link
                    href="/security/password"
                    className="bank-button flex w-full items-center justify-between rounded-lg px-5 py-4 text-sm font-black"
                  >
                    <span>Change Password</span>
                    <AppIcon name="lock" className="h-5 w-5" />
                  </Link>
                  <Link
                    href="/devices"
                    className="bank-button flex w-full items-center justify-between rounded-lg px-5 py-4 text-sm font-black"
                  >
                    <span>Manage Devices</span>
                    <AppIcon name="device" className="h-5 w-5" />
                  </Link>
                </div>
              </section>
            </div>

            <div className="min-w-0 space-y-6">
              <section className="rounded-lg border border-green-300/15 bg-[#07120d] p-6 shadow-2xl">
                <p className="text-sm font-semibold text-green-400">Banking Tier</p>
                <h2 className="mt-3 text-4xl font-black tracking-tight">Aurex Black</h2>
                <p className="mt-3 leading-relaxed text-zinc-400">
                  Premium digital banking access with international transfers, virtual cards, and advanced analytics.
                </p>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-white/10 bg-black/25 p-4">
                    <p className="text-sm text-zinc-500">Daily Limit</p>
                    <h3 className="mt-2 text-2xl font-black">$25K</h3>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/25 p-4">
                    <p className="text-sm text-zinc-500">Cashback</p>
                    <h3 className="mt-2 text-2xl font-black">3.5%</h3>
                  </div>
                </div>
              </section>

              <section className="bank-surface rounded-lg p-6">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-500">Customer Assistance</p>
                    <h2 className="mt-1 text-3xl font-black tracking-tight">Support</h2>
                  </div>
                  <span className="rounded-lg border border-white/10 bg-white/[0.045] p-2 text-zinc-500">
                    <AppIcon name="help" className="h-5 w-5" />
                  </span>
                </div>

                <div className="space-y-3">
                  <Link
                    href="/help"
                    className="flex w-full items-center justify-between gap-4 rounded-lg border border-white/10 bg-black/25 p-5 text-left transition-all hover:bg-white/[0.05]"
                  >
                    <span className="min-w-0">
                      <span className="block text-lg font-black">Help Center</span>
                      <span className="mt-1 block text-sm text-zinc-500">Banking guides and FAQs</span>
                    </span>
                    <AppIcon name="search" className="h-5 w-5 shrink-0 text-green-300" />
                  </Link>
                  <Link
                    href="/support"
                    className="flex w-full items-center justify-between gap-4 rounded-lg border border-white/10 bg-black/25 p-5 text-left transition-all hover:bg-white/[0.05]"
                  >
                    <span className="min-w-0">
                      <span className="block text-lg font-black">Live Chat</span>
                      <span className="mt-1 block text-sm text-zinc-500">Speak with Aurex Bank support</span>
                    </span>
                    <AppIcon name="help" className="h-5 w-5 shrink-0 text-green-300" />
                  </Link>
                </div>
              </section>

              <section className="rounded-lg border border-red-400/15 bg-red-500/5 p-6">
                <p className="text-sm font-semibold text-red-400">Danger Zone</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight">Account Actions</h2>

                <div className="mt-6 space-y-3">
                  <button
                    onClick={handleLogout}
                    className="w-full rounded-lg bg-red-500 py-4 text-sm font-black transition-all hover:bg-red-400"
                  >
                    Logout Account
                  </button>
                  <button
                    onClick={handleDeactivate}
                    className="w-full rounded-lg border border-red-400/15 bg-black/25 py-4 text-sm font-black transition-all hover:bg-black/40"
                  >
                    Deactivate Banking Profile
                  </button>
                </div>
              </section>
            </div>
          </div>

        </div>
      </div>

      <BottomNav />
    </main>
  );
}
