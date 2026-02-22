"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Bell, CheckCheck, CircleDollarSign, Megaphone, PackageSearch, Truck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useNotificationHistoryStore } from "@/stores/use-notification-history-store";
import PullIndicator from "@/components/ui/pull-indicator";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { formatRelativeTime } from "@/lib/format";
import BottomSheet from "@/components/ui/bottom-sheet";
import { apiFetch } from "@/lib/api";

const iconByText = (text = "") => {
  const content = text.toLowerCase();
  if (content.includes("payment")) return { icon: CircleDollarSign, color: "#C4785B" };
  if (content.includes("shipped") || content.includes("status")) return { icon: Truck, color: "#5B7BA8" };
  if (content.includes("order")) return { icon: PackageSearch, color: "#5B8C5A" };
  return { icon: Bell, color: "#D4954A" };
};

const groupKey = (dateInput) => {
  const input = new Date(dateInput);
  const now = new Date();
  const oneDay = 24 * 60 * 60 * 1000;
  const diff = Math.floor((new Date(now.toDateString()) - new Date(input.toDateString())) / oneDay);

  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return input.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export default function NotificationsPage() {
  const searchParams = useSearchParams();
  const notifications = useNotificationHistoryStore((state) => state.notifications);
  const loading = useNotificationHistoryStore((state) => state.loading);
  const unreadCount = useNotificationHistoryStore((state) => state.unreadCount);
  const fetchHistory = useNotificationHistoryStore((state) => state.fetchHistory);
  const markRead = useNotificationHistoryStore((state) => state.markRead);
  const markAllRead = useNotificationHistoryStore((state) => state.markAllRead);
  const [composeOpen, setComposeOpen] = useState(searchParams.get("compose") === "1");
  const [compose, setCompose] = useState({ title: "", body: "", url: "" });

  useEffect(() => {
    fetchHistory({ skip: 0, take: 30 });
  }, [fetchHistory]);

  const groups = useMemo(() => {
    const map = {};
    notifications.forEach((item) => {
      const key = groupKey(item.createdAt);
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  }, [notifications]);

  const { bind, pullDistance, refreshing } = usePullToRefresh(() => fetchHistory({ skip: 0, take: 30, refresh: true }));

  return (
    <div {...bind} className="space-y-3 pb-6">
      <PullIndicator pullDistance={pullDistance} refreshing={refreshing} />

      <header className="flex items-end justify-between">
        <button
          type="button"
          onClick={markAllRead}
          className="inline-flex items-center gap-1 rounded-2xl border border-[var(--card-border)] bg-white px-3 py-2 text-xs"
        >
          <CheckCheck size={14} /> Mark All Read
        </button>
      </header>

      <button
        type="button"
        onClick={() => setComposeOpen(true)}
        className="app-button inline-flex h-10 items-center gap-2 rounded-2xl border border-[var(--card-border)] bg-white px-3 text-xs"
      >
        <Megaphone size={14} />
        Broadcast
      </button>

      <p className="text-xs text-[var(--text-secondary)]">{unreadCount} unread</p>

      {loading ? (
        <div className="space-y-2">
          <div className="skeleton h-20 rounded-[20px]" />
          <div className="skeleton h-20 rounded-[20px]" />
          <div className="skeleton h-20 rounded-[20px]" />
        </div>
      ) : (
        Object.entries(groups).map(([day, items]) => (
          <section key={day} className="space-y-2">
            <h2 className="px-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{day}</h2>

            {items.map((item) => {
              const theme = iconByText(`${item.title} ${item.body}`);
              const Icon = theme.icon;

              return (
                <motion.div
                  key={item.id}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.08}
                  onDragEnd={(_, info) => {
                    if (info.offset.x < -90 && !item.isRead) {
                      markRead(item.id);
                    }
                  }}
                  className="card-surface p-3"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="grid h-9 w-9 place-items-center rounded-full"
                      style={{ background: `${theme.color}1A`, color: theme.color }}
                    >
                      <Icon size={16} />
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{item.title}</p>
                      <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{item.body}</p>
                    </div>
                    <span className="text-[11px] text-[var(--text-muted)]">{formatRelativeTime(item.createdAt)}</span>
                  </div>
                </motion.div>
              );
            })}
          </section>
        ))
      )}

      <BottomSheet open={composeOpen} onClose={() => setComposeOpen(false)} title="Broadcast Notification" snap="half">
        <div className="space-y-2">
          <input
            value={compose.title}
            onChange={(event) => setCompose((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="Title"
            className="h-11 w-full rounded-2xl border border-[var(--card-border)] px-3 text-sm outline-none"
          />
          <textarea
            value={compose.body}
            onChange={(event) => setCompose((prev) => ({ ...prev, body: event.target.value }))}
            placeholder="Body"
            className="min-h-20 w-full rounded-2xl border border-[var(--card-border)] px-3 py-2 text-sm outline-none"
          />
          <input
            value={compose.url}
            onChange={(event) => setCompose((prev) => ({ ...prev, url: event.target.value }))}
            placeholder="Optional URL"
            className="h-11 w-full rounded-2xl border border-[var(--card-border)] px-3 text-sm outline-none"
          />
          <button
            type="button"
            onClick={async () => {
              await apiFetch("/admin/notifications/broadcast", {
                method: "POST",
                body: JSON.stringify(compose),
              });
              setComposeOpen(false);
              setCompose({ title: "", body: "", url: "" });
              fetchHistory({ skip: 0, take: 30, refresh: true });
            }}
            className="app-button h-11 w-full rounded-2xl bg-[var(--accent)] text-sm font-semibold text-white"
          >
            Send Broadcast
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
