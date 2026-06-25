"use client";

import DesktopSidebar from "../../src/components/layout/DesktopSidebar";
import BottomNav from "../../src/components/navigation/BottomNav";
import Header from "../../src/components/layout/Header";
import MobileDashboard from "../../src/components/dashboard/MobileDashboard";

import BalanceCard from "../../src/components/cards/BalanceCard";
import QuickActions from "../../src/components/widgets/QuickActions";
import ActivityChart from "../../src/components/widgets/ActivityChart";
import Transactions from "../../src/components/widgets/Transactions";
import LiveCard from "../../src/components/widgets/LiveCard";
import AIInsights from "../../src/components/widgets/AIInsights";
import CryptoPortfolio from "../../src/components/widgets/CryptoPortfolio";
import Analytics from "../../src/components/widgets/Analytics";
import ActivityFeed from "../../src/components/widgets/ActivityFeed";
import StatsGrid from "../../src/components/widgets/StatsGrid";
import UpcomingPayments from "../../src/components/widgets/UpcomingPayments";



export default function DashboardPage() {
  return (
    <main className="bank-shell min-h-screen text-white overflow-x-hidden">
      <DesktopSidebar />
      <MobileDashboard />
      <div className="app-content lg:ml-72">
        <div className="app-inner hidden lg:block">
          <Header />

          <div className="mt-6 grid min-w-0 items-start gap-5 xl:gap-6 2xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
            <div className="space-y-6 min-w-0">
              <BalanceCard />
              <QuickActions />
              <StatsGrid />
            </div>

            <div className="space-y-6 min-w-0">
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
      <BottomNav />
    </main>
  );
}
