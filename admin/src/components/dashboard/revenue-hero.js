"use client";

import { motion, animate, useMotionValue, useTransform } from "framer-motion";
import { useEffect } from "react";
import Sparkline from "@/components/charts/sparkline";

const toInr = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

export default function RevenueHero({ revenue = 0, timeseries = [], todayOrders = 0, pendingOrders = 0 }) {
  const value = useMotionValue(0);
  const display = useTransform(value, (latest) => toInr(Math.round(latest)));

  useEffect(() => {
    const controls = animate(value, revenue, {
      duration: 0.9,
      ease: "easeOut",
    });

    return () => controls.stop();
  }, [value, revenue]);

  return (
    <section className="card-surface card-hover relative overflow-hidden p-6 transition-all duration-300">
      <div className="absolute inset-0 opacity-60">
        <Sparkline data={timeseries} />
      </div>
      <div className="relative z-10">
        <p className="text-xs uppercase tracking-[0.2em] font-medium text-[var(--text-secondary)]">Today Revenue</p>
        <motion.p className="mt-2 text-[48px] font-bold leading-none text-[var(--accent)] drop-shadow-sm">
          {display}
        </motion.p>
        <div className="mt-6 flex gap-3">
          <span className="app-chip rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold text-white shadow-sm">
            {todayOrders} orders today
          </span>
          <span className="app-chip rounded-full bg-amber-100 px-4 py-1.5 text-xs font-semibold text-amber-700 shadow-sm">
            {pendingOrders} pending
          </span>
        </div>
      </div>
    </section>
  );
}
