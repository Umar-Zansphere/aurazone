"use client";

import { create } from "zustand";
import { apiFetch } from "@/lib/api";
import { fallbackDashboard } from "@/lib/sample-data";

export const useDashboardStore = create((set, get) => ({
  data: null,
  loading: false,
  refreshing: false,
  error: null,
  async fetchDashboard({ refresh = false } = {}) {
    const current = get().data;
    set({
      ...(refresh ? { refreshing: true } : { loading: !current }),
      error: null,
    });

    try {
      const data = await apiFetch("/admin/dashboard");
      set({ data, loading: false, refreshing: false });
    } catch (error) {
      set({
        data: current || fallbackDashboard,
        loading: false,
        refreshing: false,
        error: error.message,
      });
    }
  },
}));
