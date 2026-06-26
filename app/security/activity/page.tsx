"use client";

import DesktopSidebar from "../../../src/components/layout/DesktopSidebar";
import BottomNav from "../../../src/components/navigation/BottomNav";
import AppIcon from "../../../src/components/ui/AppIcon";

const activities = [
  {
    title: "Successful Login",
    device: "Windows Workstation / Chrome",
    location: "Lagos, Nigeria",
    time: "2 mins ago",
    status: "Secure",
  },
  {
    title: "Password Updated",
    device: "iPhone 15 Pro / Safari",
    location: "Abuja, Nigeria",
    time: "Yesterday",
    status: "Protected",
  },
  {
    title: "Biometric Authentication Enabled",
    device: "Windows Desktop / Edge",
    location: "London, United Kingdom",
    time: "2 days ago",
    status: "Verified",
  },
  {
    title: "New Device Authorized",
    device: "Samsung Galaxy / Chrome",
    location: "Dubai, UAE",
    time: "4 days ago",
    status: "Review",
  },
];

export default function SecurityActivityPage() {
  return (
    <main className="bank-shell min-h-screen overflow-x-hidden text-white">
      <DesktopSidebar />

      <div className="app-content lg:ml-[16.25rem]">
        <div className="app-inner">
          <section className="bank-surface mb-6 rounded-lg p-6 lg:p-8">
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
              <p className="text-xs font-black uppercase tracking-[0.22em] text-green-400">
                Aurex Secure Monitoring
              </p>
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-tight lg:text-5xl">
              Security Activity
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-relaxed text-zinc-400">
              Review secure banking access, authentication history, connected devices, and protected account activity.
            </p>
          </section>

          <section className="mb-6 grid gap-5 md:grid-cols-3">
            {[
              { label: "Active Sessions", value: "4" },
              { label: "Protected Devices", value: "3" },
              { label: "Security Status", value: "Secure", green: true },
            ].map((item) => (
              <div key={item.label} className="bank-surface rounded-lg p-5">
                <p className="text-sm text-zinc-500">{item.label}</p>
                <h2 className={`mt-3 text-4xl font-black ${item.green ? "text-green-400" : ""}`}>
                  {item.value}
                </h2>
              </div>
            ))}
          </section>

          <section className="space-y-4">
            {activities.map((activity) => (
              <div key={`${activity.title}-${activity.time}`} className="bank-surface rounded-lg p-5">
                <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-green-400/10 text-green-300">
                      <AppIcon name="shield" className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="break-words text-xl font-black">{activity.title}</h2>
                        <span
                          className={`rounded-md px-2.5 py-1 text-xs font-black ${
                            activity.status === "Review"
                              ? "bg-yellow-300/15 text-yellow-100"
                              : "bg-green-400/15 text-green-200"
                          }`}
                        >
                          {activity.status}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-zinc-500">{activity.device}</p>
                      <p className="mt-1 text-sm text-zinc-600">
                        {activity.location} / {activity.time}
                      </p>
                    </div>
                  </div>

                  <button className="bank-button rounded-lg px-5 py-3 text-sm font-black">
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </section>

        </div>
      </div>

      <BottomNav />
    </main>
  );
}
