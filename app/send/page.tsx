"use client";

import DesktopSidebar from "../../src/components/layout/DesktopSidebar";
import BottomNav from "../../src/components/navigation/BottomNav";
import Header from "../../src/components/layout/Header";
import TransferMoney from "../../src/components/widgets/TransferMoney";

/** The dedicated Send route shares the server-authoritative internal transfer flow. */
export default function SendPage() {
  return <main className="bank-shell min-h-dvh text-white"><DesktopSidebar /><div className="lg:pl-72"><Header /><div className="mx-auto w-full max-w-3xl px-4 pb-28 pt-5 sm:px-7"><TransferMoney /></div></div><BottomNav /></main>;
}
