"use client";

import { create } from "zustand";
import { apiFetch } from "@/lib/api";

const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
};

export const useNotificationStore = create((set, get) => ({
  permission: "default",
  subscribed: false,
  loading: false,
  error: null,

  setPermission(permission) {
    set({ permission });
  },

  async hydratePermission() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }
    set({ permission: Notification.permission });
  },

  async subscribe() {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    set({ loading: true, error: null });

    try {
      let permission = Notification.permission;
      if (permission !== "granted") {
        permission = await Notification.requestPermission();
      }

      set({ permission });

      if (permission !== "granted") {
        throw new Error("Notification permission denied");
      }

      const registration = await navigator.serviceWorker.register("/push-sw.js");
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      const pushSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey ? urlBase64ToUint8Array(vapidKey) : undefined,
      });

      const json = pushSubscription.toJSON();
      await apiFetch("/admin/notifications/subscribe", {
        method: "POST",
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
          userAgent: navigator.userAgent,
        }),
      });

      set({ subscribed: true, loading: false });
    } catch (error) {
      set({ loading: false, error: error.message });
      throw error;
    }
  },

  async unsubscribe() {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    set({ loading: true, error: null });

    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const sub = await registration?.pushManager.getSubscription();

      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await apiFetch("/admin/notifications/unsubscribe", {
          method: "DELETE",
          body: JSON.stringify({ endpoint }),
        });
      }

      set({ subscribed: false, loading: false });
    } catch (error) {
      set({ loading: false, error: error.message });
      throw error;
    }
  },

  async checkSubscribed() {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    try {
      await navigator.serviceWorker.register("/push-sw.js");
      const registration = await navigator.serviceWorker.getRegistration("/");
      const sub = await registration?.pushManager.getSubscription();
      set({ subscribed: Boolean(sub), permission: Notification.permission });
    } catch {
      set({ subscribed: false });
    }
  },

  
}));
