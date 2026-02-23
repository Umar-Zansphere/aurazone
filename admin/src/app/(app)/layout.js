import BottomTabBar from "@/components/navigation/bottom-tab-bar";
import Sidebar from "@/components/navigation/sidebar";
import Topbar from "@/components/navigation/topbar";

export default function AppLayout({ children }) {
  return (
    <div className="edge-to-edge-layout bg-[var(--bg-app)]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden md:ml-64">
        <Topbar />
        <main className="main-content flex-1 overflow-x-hidden overflow-y-auto">
          {children}
        </main>
      </div>
      <BottomTabBar />
    </div>
  );
}
