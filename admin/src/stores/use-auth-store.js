"use client";

import { create } from "zustand";
import { apiFetch } from "@/lib/api";

export const useAuthStore = create((set) => ({
  user: null,
  loading: false,
  error: null,
  setUser: (user) => set({ user }),
  clearError: () => set({ error: null }),
  login: async ({ email, password }) => {
    set({ loading: true, error: null });
    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      set({ user: data.user || null, loading: false });
      return data;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
  logout: async () => {
    set({ loading: true, error: null });
    try {
      await apiFetch("/auth/logout", {
        method: "POST",
      });
      set({ user: null, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
}));
