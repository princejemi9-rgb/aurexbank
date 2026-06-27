"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import DesktopSidebar from "../../../src/components/layout/DesktopSidebar";
import BottomNav from "../../../src/components/navigation/BottomNav";
import AppIcon from "../../../src/components/ui/AppIcon";

function Toggle({ enabled, onClick }: { enabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onClick}
      className={`flex h-8 w-14 shrink-0 items-center rounded-full px-1 transition-all ${
        enabled ? "justify-end bg-green-400" : "justify-start bg-white/10"
      }`}
    >
      <span className="h-6 w-6 rounded-full bg-white shadow-lg" />
    </button>
  );
}

export default function BiometricsPage() {
  const router = useRouter();
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = window.localStorage.getItem("aurexbank-biometrics");
    return stored !== null ? stored === "true" : false;
  });

  function toggleBiometrics() {
    const next = !enabled;
    setEnabled(next);
    window.localStorage.setItem("aurexbank-biometrics", String(next));
  }

  return (
    <main className="bank-shell min-h-screen overflow-x-hidden text-white">
      <DesktopSidebar />

      <div className="app-content lg:ml-72">
        <div className="app-inner">
          <section className="bank-surface mb-6 rounded-lg p-6 lg:p-8">
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
              <p className="text-xs font-black uppercase tracking-[0.22em] text-green-400">
                Aurex Secure Authentication
              </p>
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-tight lg:text-5xl">
              Biometrics
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-relaxed text-zinc-400">
              Manage biometric authentication for faster and safer access to your banking profile.
            </p>
          </section>

          <section className="bank-surface rounded-lg p-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-green-400">Security Protection</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight">
                  Face ID & Fingerprint Login
                </h2>
                <p className="mt-3 max-w-2xl leading-relaxed text-zinc-500">
                  Enable biometric approval for account sign-in and sensitive banking actions.
                </p>
              </div>
              <Toggle enabled={enabled} onClick={toggleBiometrics} />
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {[
                { label: "Authentication", value: enabled ? "Enabled" : "Disabled", green: enabled },
                { label: "Supported Devices", value: "Face ID" },
                { label: "Banking Status", value: "Secure", green: true },
              ].map((item) => (
                <div key={item.label} className="bank-panel rounded-lg p-5">
                  <p className="text-sm text-zinc-500">{item.label}</p>
                  <h3 className={`mt-3 text-2xl font-black ${item.green ? "text-green-400" : ""}`}>
                    {item.value}
                  </h3>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={toggleBiometrics}
                className="rounded-lg bg-green-400 px-6 py-4 text-sm font-black text-black transition-all hover:bg-green-300"
              >
                {enabled ? "Disable Biometrics" : "Enable Biometrics"}
              </button>
              <button
                type="button"
                onClick={() => router.push("/settings")}
                className="bank-button rounded-lg px-6 py-4 text-sm font-black"
              >
                Back to Settings
              </button>
            </div>
          </section>

          <section className="mt-6 rounded-lg border border-green-300/15 bg-green-400/[0.07] p-6">
            <div className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-green-400/10 text-green-300">
                <AppIcon name="shield" className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-green-400">Biometric Guardrails</p>
                <p className="mt-2 leading-relaxed text-zinc-400">
                  Device-level biometrics remain paired with Aurex fraud monitoring and trusted-device checks.
                </p>
              </div>
            </div>
          </section>

        </div>
      </div>

      <BottomNav />
    </main>
  );
}
