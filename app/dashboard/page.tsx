"use client";

import { useEffect, useState } from "react";

import DesktopSidebar from "../../src/components/layout/DesktopSidebar";
import BottomNav from "../../src/components/navigation/BottomNav";
import Header from "../../src/components/layout/Header";
import MobileDashboard from "../../src/components/dashboard/MobileDashboard";

import BalanceCard from "../../src/components/cards/BalanceCard";
import QuickActions from "../../src/components/widgets/QuickActions";
import ActivityChart from "../../src/components/widgets/ActivityChart";
import Transactions from "../../src/components/widgets/Transactions";
import LiveCard from "../../src/components/widgets/LiveCard";
import LiveBankingPulse from "../../src/components/widgets/LiveBankingPulse";
import AIInsights from "../../src/components/widgets/AIInsights";
import CryptoPortfolio from "../../src/components/widgets/CryptoPortfolio";
import Analytics from "../../src/components/widgets/Analytics";
import ActivityFeed from "../../src/components/widgets/ActivityFeed";
import StatsGrid from "../../src/components/widgets/StatsGrid";
import UpcomingPayments from "../../src/components/widgets/UpcomingPayments";



function useDesktopDashboard() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mediaQuery.matches);

    update();
    mediaQuery.addEventListener("change", update);

    return () => {
      mediaQuery.removeEventListener("change", update);
    };
  }, []);

  return isDesktop;
}

export default function DashboardPage() {
  const isDesktop = useDesktopDashboard();

  return (
    <main className="bank-shell min-h-screen text-white overflow-x-hidden">
      {isDesktop && <DesktopSidebar />}

      {!isDesktop && <MobileDashboard />}

      {isDesktop && (
        <div className="app-content desktop-page-content">
          <div className="app-inner">
            <Header />

            <div className="mt-6 grid min-w-0 items-start gap-5 xl:gap-6 2xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
              <div className="space-y-6 min-w-0">
                <BalanceCard />
                <QuickActions />
                <StatsGrid />
              </div>

              <div className="space-y-6 min-w-0">
                <LiveBankingPulse />
                <LiveCard />
                <AIInsights />
              </div>
            </div>

            <div className="mt-6 grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:gap-6">
              <div className="min-w-0 space-y-6">
                <ActivityChart />
                <Transactions />
                <UpcomingPayments />
              </div>

              <div className="min-w-0 space-y-6">
                <CryptoPortfolio />
                <Analytics />
                <ActivityFeed />
              </div>
            </div>

          </div>
        </div>
      )}

      {!isDesktop && <BottomNav />}
    </main>
  );
}
