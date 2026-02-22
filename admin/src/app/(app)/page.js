"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import RevenueHero from "@/components/dashboard/revenue-hero";
import BentoGrid from "@/components/dashboard/bento-grid";
import ActivityFeed from "@/components/dashboard/activity-feed";
import PullIndicator from "@/components/ui/pull-indicator";
import EmptyState from "@/components/ui/empty-state";
import { useDashboardStore } from "@/stores/use-dashboard-store";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useEmptyState } from "@/hooks/use-empty-state";
import { LayoutDashboard, RefreshCw } from "lucide-react";

function DashboardSkeleton() {
  return (
    <div className="space-y-3 pb-6">
      <div className="skeleton h-40 rounded-[20px]" />
      <div className="grid grid-cols-3 gap-3">
        <div className="skeleton col-span-2 h-44 rounded-[20px]" />
        <div className="skeleton h-44 rounded-[20px]" />
        <div className="skeleton h-44 rounded-[20px]" />
        <div className="skeleton col-span-2 h-44 rounded-[20px]" />
      </div>
      <div className="skeleton h-64 rounded-[20px]" />
    </div>
  );
}

export default function DashboardPage() {
  const data = useDashboardStore((state) => state.data);
  const loading = useDashboardStore((state) => state.loading);
  const fetchDashboard = useDashboardStore((state) => state.fetchDashboard);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboard().catch((err) => setError(err));
  }, [fetchDashboard]);

  const { bind, pullDistance, refreshing } = usePullToRefresh(() => {
    setError(null);
    return fetchDashboard({ refresh: true }).catch((err) => setError(err));
  });

  const state = useEmptyState(loading, data, error);

  return (
    <div {...bind} className="space-y-3 pb-6">
      <PullIndicator pullDistance={pullDistance} refreshing={refreshing} />

      <motion.header
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-1 flex items-end justify-between"
      >
        <div>
          <p className="page-label">Overview</p>
          <h1 className="page-title">Home</h1>
        </div>
      </motion.header>

      {state.isLoading ? (
        <DashboardSkeleton />
      ) : state.showError ? (
        <EmptyState
          title="Failed to load dashboard"
          description="Something went wrong while fetching data. Pull down to try again."
          icon={RefreshCw}
          variant="error"
          action={{ label: "Retry", onClick: () => { setError(null); fetchDashboard(); } }}
        />
      ) : state.showEmpty ? (
        <EmptyState
          title="No dashboard data"
          description="Your dashboard will populate once you start receiving orders."
          icon={LayoutDashboard}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <RevenueHero
              revenue={data?.todayRevenue || 0}
              timeseries={data?.revenueTimeseries || []}
              todayOrders={data?.todayOrders || 0}
              pendingOrders={data?.pendingOrders || 0}
            />

            <BentoGrid
              statusBreakdown={data?.statusBreakdown || {}}
              lowStockCount={data?.lowStockCount || 0}
              topProduct={data?.topProduct}
            />
          </div>

          <div className="lg:col-span-1">
            <ActivityFeed items={data?.activityFeed?.slice(0, 20) || []} />
          </div>
        </div>
      )}
    </div>
  );
}
