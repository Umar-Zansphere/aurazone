"use client";

import { create } from "zustand";
import { apiFetch } from "@/lib/api";

export const useNotificationHistoryStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  refreshing: false,
  pagination: { total: 0, skip: 0, take: 20, pages: 0 },
  error: null,

  async fetchHistory({ skip = 0, take = 20, refresh = false } = {}) {
    const hasItems = get().notifications.length > 0;

    set({
      ...(refresh ? { refreshing: true } : { loading: !hasItems }),
      error: null,
    });

    try {
      const data = await apiFetch("/admin/notifications/history", {
        params: { skip, take },
      });

      const merged = skip === 0 ? data.notifications : [...get().notifications, ...data.notifications];

      set({
        notifications: merged,
        unreadCount: data.unreadCount || 0,
        pagination: data.pagination,
        loading: false,
        refreshing: false,
      });
    } catch (error) {
      set({ loading: false, refreshing: false, error: error.message });
    }
  },

  async markRead(notificationId) {
    try {
      await apiFetch(`/admin/notifications/${notificationId}/read`, {
        method: "PUT",
      });
      set((state) => ({
        notifications: state.notifications.map((item) =>
          item.id === notificationId ? { ...item, isRead: true } : item
        ),
        unreadCount: Math.max(
          0,
          state.unreadCount -
            (state.notifications.find((item) => item.id === notificationId && !item.isRead) ? 1 : 0)
        ),
      }));
    } catch (error) {
      set({ error: error.message });
    }
  },

  async markAllRead() {
    try {
      await apiFetch("/admin/notifications/read-all", {
        method: "PUT",
      });
      set((state) => ({
        notifications: state.notifications.map((item) => ({ ...item, isRead: true })),
        unreadCount: 0,
      }));
    } catch (error) {
      set({ error: error.message });
    }
  },
}));
