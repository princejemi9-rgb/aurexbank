"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DesktopSidebar from "../../src/components/layout/DesktopSidebar";
import BottomNav from "../../src/components/navigation/BottomNav";
import AppIcon from "../../src/components/ui/AppIcon";
import { BalancePrivacyToggle, PrivateAmount } from "../../src/components/ui/PrivateAmount";
import { useBanking } from "../../src/context/BankingContext";
import { useAdminStatus } from "../../src/context/AdminStatusContext";
import EditProfileModal from "../../src/components/profile/EditProfileModal";
import AvatarUploader from "../../src/components/profile/AvatarUploader";

type KycState = {
  identity: boolean;
  contact: boolean;
  address: boolean;
  biometrics: boolean;
  submitted: boolean;
  verified: boolean;
  updatedAt: string;
};

const blankKycState: KycState = {
  identity: false,
  contact: false,
  address: false,
  biometrics: false,
  submitted: false,
  verified: false,
  updatedAt: "",
};

function getKycStorageKey(userId: string) {
  return `aurexbank-kyc-${userId}`;
}

function getAdminKycState(): KycState {
  return {
    identity: true,
    contact: true,
    address: true,
    biometrics: true,
    submitted: true,
    verified: true,
    updatedAt: new Date().toISOString(),
  };
}

function readStoredKyc(userId: string, fallback: KycState) {
  if (typeof window === "undefined") return fallback;

  try {
    const stored = window.localStorage.getItem(getKycStorageKey(userId));
    if (!stored) return fallback;
    const parsed = JSON.parse(stored) as Partial<KycState>;

    return {
      ...fallback,
      identity: Boolean(parsed.identity),
      contact: Boolean(parsed.contact),
      address: Boolean(parsed.address),
      biometrics: Boolean(parsed.biometrics),
      submitted: Boolean(parsed.submitted),
      verified: Boolean(parsed.verified),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : fallback.updatedAt,
    };
  } catch {
    return fallback;
  }
}


export default function ProfilePage() {
  const { balance, currentProfile, income, refreshBanking, reserve } = useBanking();
  const { isAdmin } = useAdminStatus();
  const [editOpen, setEditOpen] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<{ url: string; userId: string } | null>(null);
  const [kycState, setKycState] = useState<KycState>(blankKycState);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const avatarUrl =
    avatarPreview?.userId === currentProfile.userId
      ? avatarPreview.url
      : currentProfile.avatar_url || "";
  const profileReady = currentProfile.userId !== "pending";

  async function handleAvatarUploaded(avatarUrl: string) {
    setAvatarPreview({ url: avatarUrl, userId: currentProfile.userId });
    await refreshBanking();
  }

  useEffect(() => {
    if (!profileReady) return;

    const fallback: KycState = isAdmin
      ? getAdminKycState()
      : {
          ...blankKycState,
          contact: Boolean(currentProfile.email),
          updatedAt: new Date().toISOString(),
        };
    const nextKyc = isAdmin ? fallback : readStoredKyc(currentProfile.userId, fallback);
    const storedBiometrics =
      typeof window !== "undefined" &&
      window.localStorage.getItem("aurexbank-biometrics") === "true";

    const timer = window.setTimeout(() => {
      setKycState(nextKyc);
      setBiometricsEnabled(isAdmin || storedBiometrics || nextKyc.biometrics);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [currentProfile.email, currentProfile.userId, isAdmin, profileReady]);

  useEffect(() => {
    if (!profileReady || isAdmin || typeof window === "undefined") return;
    window.localStorage.setItem(getKycStorageKey(currentProfile.userId), JSON.stringify(kycState));
  }, [currentProfile.userId, isAdmin, kycState, profileReady]);

  const completedKycCount = useMemo(
    () =>
      [
        kycState.identity,
        kycState.contact,
        kycState.address,
        kycState.biometrics || biometricsEnabled,
      ].filter(Boolean).length,
    [biometricsEnabled, kycState]
  );
  const kycComplete = completedKycCount === 4;
  const kycProgress = (completedKycCount / 4) * 100;

  function updateKyc(patch: Partial<KycState>) {
    setKycState((current) => {
      const next = {
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      const allComplete = next.identity && next.contact && next.address && next.biometrics;

      return {
        ...next,
        submitted: allComplete ? next.submitted : false,
        verified: allComplete ? next.verified : false,
      };
    });
  }

  function markKycStep(step: keyof Pick<KycState, "identity" | "contact" | "address">) {
    updateKyc({ [step]: true });
  }

  function toggleBiometricVerification() {
    if (isAdmin) return;

    const next = !biometricsEnabled;
    setBiometricsEnabled(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("aurexbank-biometrics", String(next));
    }
    updateKyc({ biometrics: next });
  }

  function submitVerification() {
    if (!kycComplete) return;
    updateKyc({ submitted: true, verified: true });
  }

  const details = [
    { label: "Full Name", value: currentProfile.fullName },
    { label: "Email Address", value: currentProfile.email },
    { label: "Phone Number", value: currentProfile.phone },
    { label: "Country", value: currentProfile.country },
    { label: "Account Type", value: "Aurex Black" },
    { label: "Customer ID", value: currentProfile.customerId },
  ];

  const security = [
    {
      title: "Biometrics",
      desc: biometricsEnabled ? "Face and fingerprint enabled" : "Biometric approval pending",
      icon: "shield" as const,
    },
    { title: "2FA", desc: "Authenticator secured", icon: "lock" as const },
    { title: "Devices", desc: "3 active trusted devices", icon: "device" as const },
    { title: "Login Shield", desc: "Advanced threat protection", icon: "spark" as const },
  ];

  const kycSteps = [
    {
      key: "identity" as const,
      title: "Government ID",
      desc: "Capture a passport, national ID, or driver license.",
      complete: kycState.identity,
      action: () => markKycStep("identity"),
      button: "Mark ID Uploaded",
    },
    {
      key: "contact" as const,
      title: "Contact Match",
      desc: "Confirm email and phone ownership for account recovery.",
      complete: kycState.contact,
      action: () => markKycStep("contact"),
      button: "Confirm Contact",
    },
    {
      key: "address" as const,
      title: "Address Review",
      desc: "Store a local proof-of-address check for this device.",
      complete: kycState.address,
      action: () => markKycStep("address"),
      button: "Confirm Address",
    },
    {
      key: "biometrics" as const,
      title: "Biometric Guard",
      desc: "Enable biometric approval for sensitive banking actions.",
      complete: kycState.biometrics || biometricsEnabled,
      action: toggleBiometricVerification,
      button: biometricsEnabled ? "Disable Biometrics" : "Enable Biometrics",
    },
  ];

  return (
    <main className="bank-shell min-h-screen overflow-x-hidden text-white">
      <DesktopSidebar />

      <div className="app-content lg:ml-[16.25rem]">
        <div className="app-inner">
          <section className="bank-surface mb-6 rounded-lg p-6 lg:p-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-green-400">
                    Verified Banking Identity
                  </p>
                </div>
                <h1 className="mt-4 text-4xl font-black tracking-tight lg:text-5xl">
                  Profile Center
                </h1>
                <p className="mt-3 max-w-3xl text-base leading-relaxed text-zinc-400">
                  Manage identity verification, account preferences, login sessions,
                  and premium Aurex Bank membership details.
                </p>
              </div>

              <button
                onClick={() => setEditOpen(true)}
                disabled={!profileReady}
                className="w-full rounded-lg bg-green-400 px-5 py-3 text-sm font-black text-black transition-all hover:bg-green-300 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                Edit Profile
              </button>

            </div>
          </section>

          {!profileReady ? (
            <section className="bank-surface rounded-lg p-6">
              <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
                <div className="h-24 w-24 animate-pulse rounded-lg bg-white/10" />
                <div className="min-w-0 space-y-4">
                  <div className="h-8 w-56 max-w-full animate-pulse rounded-md bg-white/10" />
                  <div className="h-4 w-80 max-w-full animate-pulse rounded-md bg-white/10" />
                  <div className="h-4 w-64 max-w-full animate-pulse rounded-md bg-white/10" />
                </div>
              </div>
            </section>
          ) : (
          <div className="grid min-w-0 items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(320px,360px)]">
            <div className="min-w-0 space-y-6">
              <section className="bank-surface rounded-lg p-6 lg:p-7">
                <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] xl:items-stretch">
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-start">
                      <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-green-300/20 bg-green-400 text-3xl font-black text-black">
                        {avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={avatarUrl}
                            alt="Profile"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          currentProfile.initials
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <h2 className="min-w-0 break-words text-3xl font-black leading-tight tracking-tight lg:text-4xl">
                            {currentProfile.fullName}
                          </h2>
                          <span
                            className={`inline-flex shrink-0 rounded-md border px-3 py-2 text-xs font-black uppercase tracking-[0.14em] ${
                              kycState.verified
                                ? "border-green-300/15 bg-green-400/10 text-green-300"
                                : "border-yellow-300/20 bg-yellow-300/10 text-yellow-100"
                            }`}
                          >
                            {kycState.verified ? "Verified" : "Verification pending"}
                          </span>
                        </div>
                        <p className="mt-2 break-words text-sm text-zinc-500">
                          {currentProfile.email} / {currentProfile.customerId}
                        </p>

                        <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-3">
                          {[
                            { label: "Membership", value: "Aurex Black Premium" },
                            { label: "Username", value: currentProfile.username },
                            { label: "KYC", value: kycState.verified ? "Complete" : `${completedKycCount}/4 steps` },
                          ].map((item) => (
                            <div key={item.label} className="rounded-lg border border-white/10 bg-black/20 p-4">
                              <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
                                {item.label}
                              </p>
                              <p className="mt-2 break-words text-sm font-black text-white">
                                {item.value}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bank-panel rounded-lg p-4 xl:self-stretch">
                    <AvatarUploader onUploaded={handleAvatarUploaded} />
                  </div>
                </div>
              </section>

              <section className="bank-surface rounded-lg p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-green-400">Account Summary</p>
                    <h2 className="mt-1 text-3xl font-black tracking-tight">
                      Banking Metrics
                    </h2>
                  </div>
                  <BalancePrivacyToggle />
                </div>

                <div className="mt-6 grid min-w-0 gap-4 lg:grid-cols-3">
                  {[
                    { label: "Available Balance", value: balance },
                    { label: "Reserve", value: reserve },
                    { label: "Monthly Income", value: income },
                  ].map((item) => (
                    <div key={item.label} className="bank-panel rounded-lg p-5">
                      <p className="text-sm text-zinc-500">{item.label}</p>
                      <h3 className="mt-3 break-words text-2xl font-black">
                        <PrivateAmount
                          value={item.value}
                          maximumFractionDigits={0}
                          minimumFractionDigits={0}
                        />
                      </h3>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bank-surface rounded-lg p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-green-400">Identity Verification</p>
                    <h2 className="mt-1 text-3xl font-black tracking-tight">KYC Status</h2>
                    <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-500">
                      {kycState.verified
                        ? "Your profile has passed local Aurex verification checks for this app."
                        : "Complete each step to unlock a verified banking profile. This demo stores the progress on this device."}
                    </p>
                  </div>
                  <div
                    className={`rounded-lg border px-5 py-4 ${
                      kycState.verified
                        ? "border-green-300/15 bg-green-400/10"
                        : "border-yellow-300/20 bg-yellow-300/10"
                    }`}
                  >
                    <p
                      className={`text-xs font-black uppercase tracking-[0.14em] ${
                        kycState.verified ? "text-green-300" : "text-yellow-100"
                      }`}
                    >
                      {kycState.verified ? "Verified" : "In progress"}
                    </p>
                    <h3 className="mt-2 text-3xl font-black">{completedKycCount}/4</h3>
                  </div>
                </div>

                <div className="mt-6 h-2.5 overflow-hidden rounded-full bg-black/40">
                  <div
                    className="h-full rounded-full bg-green-400 transition-all"
                    style={{ width: `${kycProgress}%` }}
                  />
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {kycSteps.map((step) => (
                    <div
                      key={step.key}
                      className={`rounded-lg border p-5 ${
                        step.complete
                          ? "border-green-300/15 bg-green-400/[0.07]"
                          : "border-white/10 bg-black/20"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-lg font-black">{step.title}</p>
                          <p className="mt-2 text-sm leading-relaxed text-zinc-500">{step.desc}</p>
                        </div>
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                            step.complete ? "bg-green-400 text-black" : "bg-white/10 text-zinc-500"
                          }`}
                        >
                          <AppIcon name={step.complete ? "check" : "shield"} className="h-4 w-4" />
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={step.action}
                        disabled={isAdmin || (step.complete && step.key !== "biometrics")}
                        className="bank-button mt-5 w-full rounded-lg px-4 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {step.complete && step.key !== "biometrics" ? "Completed" : step.button}
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.025] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-white">
                      {kycState.verified
                        ? "Verification complete"
                        : kycComplete
                          ? "Ready to submit"
                          : "Verification still needs attention"}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {kycState.updatedAt
                        ? `Last updated ${new Date(kycState.updatedAt).toLocaleString()}`
                        : "No verification activity yet"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={submitVerification}
                    disabled={isAdmin || !kycComplete || kycState.verified}
                    className="rounded-lg bg-green-400 px-5 py-3 text-sm font-black text-black transition-all hover:bg-green-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {kycState.verified ? "Approved" : "Submit Verification"}
                  </button>
                </div>
              </section>

              <section className="bank-surface rounded-lg p-6">
                <p className="text-sm font-semibold text-green-400">Identity Information</p>

                <h2 className="mt-1 text-3xl font-black tracking-tight">
                  Personal Details
                </h2>

                <div className="mt-6 grid min-w-0 gap-4 lg:grid-cols-2">
                  {details.map((item) => (
                    <div key={item.label} className="bank-panel rounded-lg p-5">
                      <p className="text-sm text-zinc-500">{item.label}</p>
                      <h3 className="mt-3 break-words text-xl font-black">
                        {item.value}
                      </h3>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bank-surface rounded-lg p-6">
                <p className="text-sm font-semibold text-green-400">Account Protection</p>
                <h2 className="mt-1 text-3xl font-black tracking-tight">
                  Security Systems
                </h2>

                <div className="mt-6 grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
                  {security.map((item) => (
                    <div key={item.title} className="bank-panel rounded-lg p-5">
                      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-green-400/10 text-green-300">
                        <AppIcon name={item.icon} className="h-5 w-5" />
                      </div>
                      <h3 className="mt-5 text-lg font-black">{item.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                        {item.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bank-surface rounded-lg p-6">
                <p className="text-sm font-semibold text-green-400">Login Activity</p>
                <h2 className="mt-1 text-3xl font-black tracking-tight">
                  Recent Sessions
                </h2>

                <div className="mt-6 space-y-3">
                  {[
                    { device: "Windows Workstation", location: "Lagos, Nigeria", status: "Current" },
                    { device: "iPhone 15 Pro", location: "Lagos, Nigeria", status: "Trusted" },
                    { device: "Chrome Browser", location: "Abuja, Nigeria", status: "Verified" },
                  ].map((session) => (
                    <div
                      key={session.device}
                      className="grid min-w-0 gap-3 rounded-lg border border-white/10 bg-white/[0.025] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                    >
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-black">{session.device}</h3>
                        <p className="mt-1 text-sm text-zinc-500">{session.location}</p>
                      </div>
                      <span className="inline-flex w-fit max-w-full rounded-md border border-green-300/15 bg-green-400/10 px-3 py-2 text-xs font-black text-green-300 sm:justify-self-end">
                        {session.status}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <aside className="min-w-0 space-y-6">
              <section className="rounded-lg border border-green-300/15 bg-[#07120d] p-6 shadow-2xl">
                <p className="text-sm font-semibold text-green-400">Membership Status</p>
                <h2 className="mt-3 text-3xl font-black tracking-tight">Aurex Black</h2>
                <div className="mt-6 space-y-4">
                  {[
                    { label: "Daily Transfer Limit", value: "$50,000" },
                    { label: "Cashback Rewards", value: "3.5%" },
                    { label: "Priority Support", value: "Enabled" },
                  ].map((item) => (
                    <div key={item.label} className="flex min-w-0 items-center justify-between gap-4">
                      <p className="min-w-0 truncate text-sm text-zinc-400">{item.label}</p>
                      <h3 className="shrink-0 font-black">{item.value}</h3>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bank-surface rounded-lg p-6">
                <p className="text-sm font-semibold text-green-400">Support Center</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight">Need Assistance?</h2>
                <p className="mt-4 leading-relaxed text-zinc-500">
                  Access priority support, fraud assistance, and dedicated account
                  management services.
                </p>
                <div className="mt-6 grid gap-3">
                  <Link
                    href="/support"
                    className="flex items-center justify-center gap-2 rounded-lg bg-green-400 py-4 text-sm font-black text-black transition-all hover:bg-green-300"
                  >
                    <AppIcon name="help" className="h-4 w-4" />
                    Live Chat
                  </Link>
                  <Link
                    href="/help"
                    className="bank-button flex items-center justify-center gap-2 rounded-lg py-4 text-sm font-black text-zinc-200"
                  >
                    <AppIcon name="search" className="h-4 w-4" />
                    Help Center
                  </Link>
                </div>
              </section>
            </aside>
          </div>
          )}

        </div>
      </div>

      <BottomNav />
      {profileReady && (
        <EditProfileModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={refreshBanking}
          profile={currentProfile}
        />
      )}
    </main>
  );
}
