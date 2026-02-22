"use client";

import { useEffect } from "react";
import { useNotificationStore } from "@/stores/use-notification-store";

export default function AppProviders({ children }) {
  const hydratePermission = useNotificationStore((state) => state.hydratePermission);
  const checkSubscribed = useNotificationStore((state) => state.checkSubscribed);

  useEffect(() => {
    hydratePermission();
    checkSubscribed();

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/push-sw.js").catch(() => undefined);
    }
  }, [hydratePermission, checkSubscribed]);

  return children;
}
