"use client";

import { motion } from "framer-motion";
import { CircleDollarSign, Clock3, PackageSearch, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatRelativeTime } from "@/lib/format";

const activityTheme = {
  NEW_ORDER: { icon: PackageSearch, color: "#5B8C5A" },
  STATUS_CHANGE: { icon: Truck, color: "#5B7BA8" },
  LOW_STOCK: { icon: Clock3, color: "#D4954A" },
  PAYMENT: { icon: CircleDollarSign, color: "#C4785B" },
};

const getActivityPath = (item) => {
  if (item.type === "LOW_STOCK") {
    return item.referenceId ? `/products/${item.referenceId}` : "/products";
  }

  return item.referenceId ? `/orders/${item.referenceId}` : "/orders";
};

export default function ActivityFeed({ items = [] }) {
  const router = useRouter();

  return (
    <section className="card-surface p-3">
      <h2 className="px-1 text-sm font-semibold">Activity Feed</h2>
      <div className="mt-2 max-h-[320px] space-y-2 overflow-y-auto pr-1">
        {items.map((item, idx) => {
          const theme = activityTheme[item.type] || activityTheme.NEW_ORDER;
          const Icon = theme.icon;

          return (
            <motion.button
              key={`${item.referenceId || idx}-${item.createdAt}`}
              onClick={() => router.push(getActivityPath(item))}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              className="flex w-full items-start gap-3 rounded-2xl border border-[var(--card-border)] bg-white px-2.5 py-2 text-left"
            >
              <span
                className="mt-0.5 grid h-8 w-8 place-items-center rounded-full"
                style={{ background: `${theme.color}22`, color: theme.color }}
              >
                <Icon size={15} />
              </span>

              <span className="flex-1">
                <span className="line-clamp-1 block text-sm font-medium text-[var(--text-primary)]">{item.title}</span>
                {item.description ? (
                  <span className="line-clamp-1 block text-xs text-[var(--text-secondary)]">{item.description}</span>
                ) : null}
              </span>

              <span className="text-[11px] text-[var(--text-muted)]">{formatRelativeTime(item.createdAt)}</span>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
