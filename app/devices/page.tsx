"use client";

import { useMemo, useState } from "react";

import DesktopSidebar from "../../src/components/layout/DesktopSidebar";
import BottomNav from "../../src/components/navigation/BottomNav";
import AppIcon from "../../src/components/ui/AppIcon";

type Device = {
  id: number;
  name: string;
  browser: string;
  location: string;
  ip: string;
  active: boolean;
  trusted: boolean;
  lastSeen: string;
  risk: "Low" | "Medium";
};

const initialDevices: Device[] = [
  {
    id: 1,
    name: "Windows Workstation",
    browser: "Chrome",
    location: "Lagos, Nigeria",
    ip: "102.89.21.4",
    active: true,
    trusted: true,
    lastSeen: "Active now",
    risk: "Low",
  },
  {
    id: 2,
    name: "iPhone 15 Pro",
    browser: "Safari",
    location: "Lagos, Nigeria",
    ip: "105.112.54.1",
    active: false,
    trusted: true,
    lastSeen: "2 hours ago",
    risk: "Low",
  },
  {
    id: 3,
    name: "Windows Desktop",
    browser: "Edge",
    location: "London, United Kingdom",
    ip: "81.22.194.10",
    active: false,
    trusted: false,
    lastSeen: "Yesterday",
    risk: "Medium",
  },
];

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>(initialDevices);
  const [selectedDeviceId, setSelectedDeviceId] = useState(1);
  const selectedDevice = devices.find((device) => device.id === selectedDeviceId) ?? devices[0];

  const trustedCount = useMemo(
    () => devices.filter((device) => device.trusted).length,
    [devices]
  );

  function removeDevice(id: number) {
    setDevices((current) => current.filter((device) => device.id !== id));
    setSelectedDeviceId((current) => {
      if (current !== id) return current;
      return devices.find((device) => device.id !== id)?.id ?? 0;
    });
  }

  function toggleTrusted(id: number) {
    setDevices((current) =>
      current.map((device) =>
        device.id === id ? { ...device, trusted: !device.trusted } : device
      )
    );
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
                Security Infrastructure
              </p>
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-tight lg:text-5xl">
              Trusted Devices
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-relaxed text-zinc-400">
              Review active sessions, trusted devices, login locations, and access risk before approving account activity.
            </p>
          </section>

          <section className="mb-6 grid gap-4 md:grid-cols-3">
            {[
              { label: "Active Sessions", value: String(devices.filter((device) => device.active).length) },
              { label: "Trusted Devices", value: String(trustedCount) },
              { label: "Review Required", value: String(devices.filter((device) => device.risk !== "Low").length) },
            ].map((item) => (
              <div key={item.label} className="bank-surface rounded-lg p-5">
                <p className="text-sm text-zinc-500">{item.label}</p>
                <h2 className="mt-3 text-4xl font-black tracking-tight">{item.value}</h2>
              </div>
            ))}
          </section>

          <div className="grid min-w-0 gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(320px,360px)]">
            <section className="min-w-0 space-y-4">
              {devices.map((device) => (
                <button
                  key={device.id}
                  type="button"
                  onClick={() => setSelectedDeviceId(device.id)}
                  className={`bank-surface w-full rounded-lg p-5 text-left transition-all hover:bg-white/[0.055] ${
                    selectedDevice?.id === device.id ? "border-green-300/50" : ""
                  }`}
                >
                  <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="flex min-w-0 items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-green-400/10 text-green-300">
                        <AppIcon name="device" className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="break-words text-xl font-black">{device.name}</h2>
                          <span
                            className={`rounded-md px-2.5 py-1 text-xs font-black ${
                              device.active
                                ? "bg-green-400/15 text-green-200"
                                : "bg-white/[0.055] text-zinc-400"
                            }`}
                          >
                            {device.active ? "Current" : device.trusted ? "Trusted" : "Review"}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-zinc-500">
                          {device.browser} / {device.location} / {device.lastSeen}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      <span
                        className={`rounded-md px-3 py-2 text-xs font-black ${
                          device.risk === "Low"
                            ? "bg-green-400/15 text-green-200"
                            : "bg-yellow-300/15 text-yellow-100"
                        }`}
                      >
                        {device.risk} Risk
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </section>

            <aside className="min-w-0 space-y-6">
              {selectedDevice ? (
                <section className="bank-surface rounded-lg p-6">
                  <p className="text-sm font-semibold text-green-400">Device Review</p>
                  <h2 className="mt-2 break-words text-3xl font-black tracking-tight">
                    {selectedDevice.name}
                  </h2>
                  <div className="mt-6 space-y-3">
                    {[
                      { label: "Browser", value: selectedDevice.browser },
                      { label: "Location", value: selectedDevice.location },
                      { label: "IP Address", value: selectedDevice.ip },
                      { label: "Last Seen", value: selectedDevice.lastSeen },
                    ].map((item) => (
                      <div key={item.label} className="bank-panel rounded-lg p-4">
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
                          {item.label}
                        </p>
                        <h3 className="mt-2 break-words font-black">{item.value}</h3>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 grid gap-3">
                    <button
                      type="button"
                      onClick={() => toggleTrusted(selectedDevice.id)}
                      className="rounded-lg bg-green-400 py-4 text-sm font-black text-black transition-all hover:bg-green-300"
                    >
                      {selectedDevice.trusted ? "Remove Trust" : "Trust Device"}
                    </button>
                    {!selectedDevice.active && (
                      <button
                        type="button"
                        onClick={() => removeDevice(selectedDevice.id)}
                        className="rounded-lg border border-red-400/20 bg-red-500/10 py-4 text-sm font-black text-red-200 transition-all hover:bg-red-500/15"
                      >
                        Remove Device
                      </button>
                    )}
                  </div>
                </section>
              ) : (
                <section className="bank-surface rounded-lg p-6">
                  <p className="text-sm text-zinc-500">No device selected.</p>
                </section>
              )}

              <section className="rounded-lg border border-green-300/15 bg-green-400/[0.07] p-6">
                <p className="text-sm font-semibold text-green-400">Login Protection</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight">Access Shield</h2>
                <div className="mt-6 space-y-3">
                  {[
                    "New device alerts enabled",
                    "Location anomaly checks active",
                    "Trusted-device approvals required",
                    "Session revocation available",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
                      <p className="text-sm text-zinc-400">{item}</p>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </div>

        </div>
      </div>

      <BottomNav />
    </main>
  );
}
