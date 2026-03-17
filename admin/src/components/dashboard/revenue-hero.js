"use client";

import { motion, animate, useMotionValue, useTransform } from "framer-motion";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Sparkline from "@/components/charts/sparkline";

const toInr = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

export default function RevenueHero({ revenue = 0, timeseries = [], todayOrders = 0, pendingOrders = 0 }) {
  const router = useRouter();
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
    <section className="card-surface card-hover relative overflow-hidden p-6">
      <div className="absolute inset-0 opacity-50">
        <Sparkline data={timeseries} />
      </div>
      <div className="relative z-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">Today Revenue</p>
        <motion.p className="mt-2 text-[44px] font-bold leading-none tracking-tight text-[var(--text-primary)]">
          {display}
        </motion.p>
        <div className="mt-5 flex gap-2.5">
          <button
            onClick={() => router.push('/orders')}
            className="app-chip rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-xs font-semibold text-white cursor-pointer hover:opacity-80 transition-opacity active:scale-95"
          >
            {todayOrders} orders today
          </button>
          <button
            onClick={() => router.push('/orders?status=PENDING')}
            className="app-chip rounded-full bg-[var(--highlight-soft)] px-3.5 py-1.5 text-xs font-semibold text-[var(--highlight)] cursor-pointer hover:opacity-80 transition-opacity active:scale-95"
          >
            {pendingOrders} pending
          </button>
        </div>
      </div>
    </section>
  );
}
