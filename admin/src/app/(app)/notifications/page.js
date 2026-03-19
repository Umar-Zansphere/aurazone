"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Bell, CheckCheck, CircleDollarSign, Megaphone, PackageSearch, Truck, BellOff, AlertCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useNotificationHistoryStore } from "@/stores/use-notification-history-store";
import PullIndicator from "@/components/ui/pull-indicator";
import EmptyState from "@/components/ui/empty-state";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useEmptyState } from "@/hooks/use-empty-state";
import { formatRelativeTime } from "@/lib/format";
import BottomSheet from "@/components/ui/bottom-sheet";
import { apiFetch } from "@/lib/api";

const iconByText = (text = "") => {
  const content = text.toLowerCase();
  if (content.includes("payment")) return { icon: CircleDollarSign, color: "#a18a68" };
  if (content.includes("shipped") || content.includes("status")) return { icon: Truck, color: "#3b6b8c" };
  if (content.includes("order")) return { icon: PackageSearch, color: "#2f6b4f" };
  return { icon: Bell, color: "#b7791f" };
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

function NotificationsContent() {
  const searchParams = useSearchParams();
  const notifications = useNotificationHistoryStore((state) => state.notifications);
  const loading = useNotificationHistoryStore((state) => state.loading);
  const unreadCount = useNotificationHistoryStore((state) => state.unreadCount);
  const fetchHistory = useNotificationHistoryStore((state) => state.fetchHistory);
  const markRead = useNotificationHistoryStore((state) => state.markRead);
  const markAllRead = useNotificationHistoryStore((state) => state.markAllRead);
  const [composeOpen, setComposeOpen] = useState(searchParams.get("compose") === "1");
  const [compose, setCompose] = useState({ title: "", body: "", url: "" });
  const [broadcastError, setBroadcastError] = useState(null);
  const [broadcasting, setBroadcasting] = useState(false);

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

  const listState = useEmptyState(loading, notifications, null);

  const sendBroadcast = async () => {
    setBroadcastError(null);
    setBroadcasting(true);
    try {
      await apiFetch("/admin/notifications/broadcast", {
        method: "POST",
        body: JSON.stringify(compose),
      });
      setComposeOpen(false);
      setCompose({ title: "", body: "", url: "" });
      fetchHistory({ skip: 0, take: 30, refresh: true });
    } catch {
      setBroadcastError("Failed to send broadcast. Please try again.");
    } finally {
      setBroadcasting(false);
    }
  };

  return (
    <div {...bind} className="space-y-3 pb-6">
      <PullIndicator pullDistance={pullDistance} refreshing={refreshing} />

      <header>
        <div className="flex items-end justify-between">
          <div>
            <p className="page-label">Updates</p>
            <h1 className="page-title">Notifications</h1>
          </div>
          <button
            type="button"
            onClick={markAllRead}
            className="app-button app-button-secondary flex items-center gap-1.5 px-3 py-2 text-xs"
          >
            <CheckCheck size={14} /> Mark All Read
          </button>
        </div>

        <div className="mt-3 flex items-center gap-3">
          {/* <button
            type="button"
            onClick={() => setComposeOpen(true)}
            className="app-button app-button-primary flex items-center gap-2 px-3 py-2 text-xs"
          >
            <Megaphone size={14} />
            Broadcast
          </button> */}
          <span className="text-xs text-[var(--text-secondary)]">{unreadCount} unread</span>
        </div>
      </header>

      {listState.isLoading ? (
        <div className="space-y-2">
          <div className="skeleton h-20 rounded-[18px]" />
          <div className="skeleton h-20 rounded-[18px]" />
          <div className="skeleton h-20 rounded-[18px]" />
        </div>
      ) : listState.showEmpty ? (
        <div className="pt-4">
          <EmptyState
            title="No notifications"
            description="You're all caught up! Notifications will appear here when events happen."
            icon={BellOff}
          />
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
                  className={`card-surface p-3 transition-colors ${!item.isRead ? 'border-l-2 border-l-[var(--highlight)]' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                      style={{ background: `${theme.color}14`, color: theme.color }}
                    >
                      <Icon size={16} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{item.title}</p>
                      <p className="mt-0.5 text-xs text-[var(--text-secondary)] line-clamp-2">{item.body}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-[var(--text-muted)]">{formatRelativeTime(item.createdAt)}</span>
                  </div>
                </motion.div>
              );
            })}
          </section>
        ))
      )}

      <BottomSheet open={composeOpen} onClose={() => { setComposeOpen(false); setBroadcastError(null); }} title="Broadcast Notification" snap="half">
        <div className="space-y-3">
          {broadcastError && (
            <div className="error-banner">
              <AlertCircle size={16} />
              {broadcastError}
            </div>
          )}
          <div>
            <label className="form-label">Title</label>
            <input
              value={compose.title}
              onChange={(event) => setCompose((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Notification title"
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Body</label>
            <textarea
              value={compose.body}
              onChange={(event) => setCompose((prev) => ({ ...prev, body: event.target.value }))}
              placeholder="Notification body"
              className="form-textarea"
            />
          </div>
          <div>
            <label className="form-label">URL (optional)</label>
            <input
              value={compose.url}
              onChange={(event) => setCompose((prev) => ({ ...prev, url: event.target.value }))}
              placeholder="https://..."
              className="form-input"
            />
          </div>
          <button
            type="button"
            disabled={broadcasting || !compose.title || !compose.body}
            onClick={sendBroadcast}
            className="app-button app-button-primary h-11 w-full text-sm disabled:opacity-50"
          >
            {broadcasting ? (
              <span className="inline-flex items-center gap-2">
                <span className="brand-spinner h-4 w-4 rounded-full border-2 border-white border-t-transparent" />
                Sending...
              </span>
            ) : "Send Broadcast"}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={<div className="space-y-2"><div className="skeleton h-20 rounded-[18px]" /><div className="skeleton h-20 rounded-[18px]" /></div>}>
      <NotificationsContent />
    </Suspense>
  );
}
