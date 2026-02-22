"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, CircleDot, LogOut, ShieldCheck, UserCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {  apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/use-auth-store";
import { useNotificationStore } from "@/stores/use-notification-store";



export default function SettingsPage() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const subscribed = useNotificationStore((state) => state.subscribed);
  const pushLoading = useNotificationStore((state) => state.loading);
  const subscribe = useNotificationStore((state) => state.subscribe);
  const unsubscribe = useNotificationStore((state) => state.unsubscribe);
  const checkSubscribed = useNotificationStore((state) => state.checkSubscribed);

  const [prefs, setPrefs] = useState({
    newOrders: true,
    orderStatusChange: true,
    lowStock: true,
    otherEvents: true,
  });
  const [health, setHealth] = useState({ status: "unknown", message: "Checking backend..." });

  useEffect(() => {
    let active = true;

    apiFetch("/admin/notifications/preferences")
      .then((data) => {
        if (active) {
          setPrefs(data);
        }
      })
      .catch(() => undefined);

    checkSubscribed();

    fetch(`/health`)
      .then((res) => res.json())
      .then((json) => {
        if (active) {
          setHealth(json);
        }
      })
      .catch(() => {
        if (active) {
          setHealth({ status: "unhealthy", message: "Backend unreachable" });
        }
      });

    return () => {
      active = false;
    };
  }, [checkSubscribed]);

  const savePref = async (field, value) => {
    const next = { ...prefs, [field]: value };
    setPrefs(next);
    try {
      await apiFetch("/admin/notifications/preferences", {
        method: "PUT",
        body: JSON.stringify({ [field]: value }),
      });
    } catch {
      setPrefs(prefs);
    }
  };

  const appVersion = useMemo(() => process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0", []);

  return (
    <div className="space-y-3 pb-6">
      <header>
        <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">Control</p>
        <h1 className="text-[28px] font-semibold text-[var(--accent)]">Settings</h1>
      </header>

      <section className="card-surface p-3">
        <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">Profile</p>
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--card-border)] p-2.5">
          <UserCircle2 className="text-[var(--accent)]" size={34} />
          <div className="flex-1">
            <p className="text-sm font-semibold">Admin User</p>
            <p className="text-xs text-[var(--text-secondary)]">admin@aurazone.com</p>
          </div>
          <span className="app-chip rounded-full bg-[var(--accent)] px-2.5 py-1 text-[10px] font-semibold text-white">
            ADMIN
          </span>
        </div>

        <button
          type="button"
          onClick={async () => {
            await logout();
            router.replace("/login");
          }}
          className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-[color:rgba(196,91,91,0.35)] px-3 py-2 text-sm text-[var(--error)]"
        >
          <LogOut size={15} /> Log Out
        </button>
      </section>

      <section className="card-surface p-3">
        <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">Notification Preferences</p>
        {[
          { key: "newOrders", label: "New Orders" },
          { key: "orderStatusChange", label: "Order Status Changes" },
          { key: "lowStock", label: "Low Stock Alerts" },
          { key: "otherEvents", label: "Other Events" },
        ].map((pref) => (
          <button
            key={pref.key}
            type="button"
            onClick={() => savePref(pref.key, !prefs[pref.key])}
            className="flex w-full items-center justify-between border-b border-[var(--card-border)] py-3 last:border-none"
          >
            <span className="text-sm">{pref.label}</span>
            <span
              className={`h-6 w-11 rounded-full p-1 transition ${
                prefs[pref.key] ? "bg-[var(--accent)]" : "bg-zinc-300"
              }`}
            >
              <span className={`block h-4 w-4 rounded-full bg-white transition ${prefs[pref.key] ? "translate-x-5" : "translate-x-0"}`} />
            </span>
          </button>
        ))}

        <button
          type="button"
          disabled={pushLoading}
          onClick={() => (subscribed ? unsubscribe() : subscribe())}
          className="mt-3 flex w-full items-center justify-between rounded-2xl border border-[var(--card-border)] px-3 py-3"
        >
          <span className="inline-flex items-center gap-2 text-sm">
            <Bell size={14} /> Push Subscription
          </span>
          <span className={`text-xs font-semibold ${subscribed ? "text-[var(--success)]" : "text-[var(--text-secondary)]"}`}>
            {pushLoading ? "Updating..." : subscribed ? "Subscribed" : "Not Subscribed"}
          </span>
        </button>
      </section>

      <section className="card-surface p-3">
        <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">App Info</p>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span>Version</span>
            <span className="text-[var(--text-secondary)]">{appVersion}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck size={14} /> Backend Health
            </span>
            <span
              className="inline-flex items-center gap-1 text-xs"
              style={{ color: health.status === "healthy" ? "var(--success)" : "var(--error)" }}
            >
              <CircleDot size={10} /> {health.status || "unknown"}
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">{health.message}</p>
        </div>
      </section>
    </div>
  );
}
