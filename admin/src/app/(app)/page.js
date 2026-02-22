"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import RevenueHero from "@/components/dashboard/revenue-hero";
import BentoGrid from "@/components/dashboard/bento-grid";
import ActivityFeed from "@/components/dashboard/activity-feed";
import PullIndicator from "@/components/ui/pull-indicator";
import { useDashboardStore } from "@/stores/use-dashboard-store";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";

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

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const { bind, pullDistance, refreshing } = usePullToRefresh(() => fetchDashboard({ refresh: true }));

  return (
    <div {...bind} className="space-y-3 pb-6">
      <PullIndicator pullDistance={pullDistance} refreshing={refreshing} />

      <motion.header
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-1 flex items-end justify-between"
      >
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-muted)]">Overview</p>
          <h1 className="text-[28px] font-semibold leading-tight text-[var(--accent)]">Home</h1>
        </div>
      </motion.header>

      {loading && !data ? (
        <DashboardSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
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
