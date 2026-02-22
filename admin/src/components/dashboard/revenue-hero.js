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
    <section className="card-surface relative overflow-hidden p-4">
      <div className="absolute inset-0 opacity-60">
        <Sparkline data={timeseries} />
      </div>
      <div className="relative z-10">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">Today Revenue</p>
        <motion.p className="mt-1 text-[40px] font-bold leading-none text-[var(--accent)]">
          {display}
        </motion.p>
        <div className="mt-4 flex gap-2">
          <span className="app-chip rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-medium text-white">
            {todayOrders} orders today
          </span>
          <span className="app-chip rounded-full bg-[color:rgba(196,120,91,0.18)] px-3 py-1 text-xs font-medium text-[var(--highlight)]">
            {pendingOrders} pending
          </span>
        </div>
      </div>
    </section>
  );
}
