"use client";

import { motion } from "framer-motion";
import { CircleDollarSign, Clock3, PackageSearch, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatRelativeTime } from "@/lib/format";

const activityTheme = {
  NEW_ORDER: { icon: PackageSearch, color: "#2f6b4f" },
  STATUS_CHANGE: { icon: Truck, color: "#3b6b8c" },
  LOW_STOCK: { icon: Clock3, color: "#b7791f" },
  PAYMENT: { icon: CircleDollarSign, color: "#a18a68" },
};

const getActivityPath = (item) => {
  if (item.type === "LOW_STOCK") {
    return item.referenceId ? `/products/${item.referenceId}` : "/products";
  }

  return item.referenceId ? `/orders/${item.referenceId}` : "/orders";
};

export default function ActivityFeed({ items = [] }) {
  const router = useRouter();

  if (!items.length) {
    return (
      <section className="card-surface p-4">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Activity Feed</h2>
        <div className="mt-6 flex flex-col items-center py-6 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--highlight-soft)]">
            <PackageSearch size={22} className="text-[var(--highlight)]" />
          </div>
          <p className="text-sm font-medium text-[var(--text-secondary)]">No recent activity</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Activity will appear here as events happen.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="card-surface p-4">
      <h2 className="text-sm font-semibold text-[var(--text-primary)]">Activity Feed</h2>
      <div className="mt-3 max-h-[340px] space-y-2 overflow-y-auto pr-1">
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
              className="flex w-full items-start gap-3 rounded-[14px] border border-[var(--border)] bg-white px-2.5 py-2.5 text-left transition-colors hover:bg-[var(--surface-hover)]"
            >
              <span
                className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl"
                style={{ background: `${theme.color}12`, color: theme.color }}
              >
                <Icon size={15} />
              </span>

              <span className="flex-1 min-w-0">
                <span className="line-clamp-1 block text-sm font-medium text-[var(--text-primary)]">{item.title}</span>
                {item.description ? (
                  <span className="line-clamp-1 block text-xs text-[var(--text-secondary)]">{item.description}</span>
                ) : null}
              </span>

              <span className="shrink-0 text-[11px] text-[var(--text-muted)]">{formatRelativeTime(item.createdAt)}</span>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
