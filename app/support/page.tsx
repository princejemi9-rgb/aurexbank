"use client";

import { useEffect, useRef, useState } from "react";

import DesktopSidebar from "../../src/components/layout/DesktopSidebar";
import BottomNav from "../../src/components/navigation/BottomNav";
import AppIcon from "../../src/components/ui/AppIcon";
import { supabase } from "../../src/lib/supabase";

type Message = {
  id: number;
  sender: "user" | "agent";
  text: string;
  time: string;
};

const supportTopics = [
  "Card dispute",
  "Transfer trace",
  "Login security",
  "Profile verification",
];

function messageTime() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SupportPage() {
  const [topic, setTopic] = useState("Transfer trace");
  const [message, setMessage] = useState("");
  const [caseNotice, setCaseNotice] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      sender: "agent",
      text: "Welcome to Aurex Bank Priority Support. Choose a topic or send a secure message to begin.",
      time: "09:41",
    },
  ]);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function notifyAdmin(caseId: string, text: string) {
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) {
        setCaseNotice("Message sent locally. Sign in again to notify admin.");
        return;
      }

      const response = await fetch("/api/support/case", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          caseId,
          topic,
          message: text,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;

      setCaseNotice(
        response.ok && data?.ok
          ? `Admin notification sent for case ${caseId}.`
          : data?.error || "Message sent locally. Admin notification could not be delivered."
      );
    } catch {
      setCaseNotice("Message sent locally. Admin notification could not be delivered.");
    }
  }

  function sendMessage(nextMessage = message) {
    const trimmedMessage = nextMessage.trim();
    if (!trimmedMessage) return;
    const caseId = `ARX-${Date.now().toString().slice(-6)}`;

    const userMessage: Message = {
      id: Date.now(),
      sender: "user",
      text: trimmedMessage,
      time: messageTime(),
    };

    setMessages((current) => [...current, userMessage]);
    setMessage("");
    setCaseNotice("Notifying admin desk...");
    void notifyAdmin(caseId, trimmedMessage);

    window.setTimeout(() => {
      const agentMessage: Message = {
        id: Date.now() + 1,
        sender: "agent",
        text: `Your ${topic.toLowerCase()} request is secured under case ${caseId}. A specialist is reviewing it now.`,
        time: messageTime(),
      };

      setMessages((current) => [...current, agentMessage]);
    }, 900);
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
                Aurex Bank Priority Support
              </p>
            </div>
            <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-4xl font-black tracking-tight lg:text-5xl">
                  Live Support
                </h1>
                <p className="mt-3 max-w-3xl text-base leading-relaxed text-zinc-400">
                  Securely communicate with Aurex Bank specialists for transfers, account protection, cards, and profile review.
                </p>
              </div>
              <div className="w-fit rounded-lg border border-green-300/15 bg-green-400/10 px-5 py-4">
                <p className="text-sm font-semibold text-green-400">Support Status</p>
                <h3 className="mt-1 text-2xl font-black">Online</h3>
              </div>
            </div>
          </section>

          <div className="grid min-w-0 gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(320px,340px)]">
            <section className="bank-surface min-w-0 overflow-hidden rounded-lg">
              <div className="flex min-w-0 items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-green-400 text-black">
                    <AppIcon name="help" className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-2xl font-black">Aurex Bank Specialist</h2>
                    <p className="mt-1 text-sm text-green-400">Connected securely</p>
                  </div>
                </div>
                <span className="hidden rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-zinc-400 sm:inline-flex">
                  {topic}
                </span>
              </div>

              <div className="h-[500px] space-y-4 overflow-y-auto px-5 py-6">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-5 py-4 ${
                        msg.sender === "user"
                          ? "bg-green-400 text-black"
                          : "border border-white/10 bg-white/[0.05] text-white"
                      }`}
                    >
                      <p className="break-words leading-relaxed">{msg.text}</p>
                      <p
                        className={`mt-3 text-xs ${
                          msg.sender === "user" ? "text-black/70" : "text-zinc-500"
                        }`}
                      >
                        {msg.time}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              <div className="border-t border-white/10 p-5">
                {caseNotice && (
                  <div className="mb-3 rounded-lg border border-green-300/15 bg-green-400/10 px-4 py-3 text-sm font-semibold text-green-200">
                    {caseNotice}
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <input
                    type="text"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        sendMessage();
                      }
                    }}
                    placeholder="Send secure message..."
                    className="h-12 min-w-0 rounded-lg border border-white/10 bg-black/30 px-4 text-sm font-semibold outline-none transition-all placeholder:text-zinc-600 focus:border-green-400"
                  />
                  <button
                    type="button"
                    onClick={() => sendMessage()}
                    className="rounded-lg bg-green-400 px-6 py-3 text-sm font-black text-black transition-all hover:bg-green-300"
                  >
                    Send
                  </button>
                </div>
              </div>
            </section>

            <aside className="min-w-0 space-y-6">
              <section className="bank-surface rounded-lg p-6">
                <p className="text-sm font-semibold text-green-400">Support Topic</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight">Case Type</h2>
                <div className="mt-6 space-y-2">
                  {supportTopics.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setTopic(item)}
                      className={`w-full rounded-lg border px-4 py-3 text-left text-sm font-black transition-all ${
                        topic === item
                          ? "border-green-300/50 bg-green-400/10 text-green-200"
                          : "border-white/10 bg-white/[0.025] text-zinc-300 hover:bg-white/[0.055]"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </section>

              <section className="bank-surface rounded-lg p-6">
                <p className="text-sm font-semibold text-green-400">Case Status</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight">Priority Queue</h2>
                <div className="mt-6 space-y-3">
                  {[
                    { label: "Queue", value: "Aurex Black" },
                    { label: "Response", value: "Under 2 min" },
                    { label: "Security", value: "Encrypted" },
                  ].map((item) => (
                    <div key={item.label} className="bank-panel rounded-lg p-4">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
                        {item.label}
                      </p>
                      <h3 className="mt-2 font-black">{item.value}</h3>
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
