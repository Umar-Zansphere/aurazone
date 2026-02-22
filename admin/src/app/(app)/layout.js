import BottomTabBar from "@/components/navigation/bottom-tab-bar";

export default function AppLayout({ children }) {
  return (
    <>
      <main className="mobile-shell">{children}</main>
      <BottomTabBar />
    </>
  );
}
