import DesktopSidebar from "../../src/components/layout/DesktopSidebar";
import BottomNav from "../../src/components/navigation/BottomNav";
import Header from "../../src/components/layout/Header";
import AccountHistory from "../../src/components/widgets/AccountHistory";

export default function TransactionsPage() {
  return <main className="bank-shell min-h-screen overflow-x-hidden text-white">
    <DesktopSidebar />
    <div className="app-content desktop-page-content pb-28"><div className="app-inner">
      <Header />
      <AccountHistory />
    </div></div>
    <BottomNav />
  </main>;
}
