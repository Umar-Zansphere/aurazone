"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, CircleDot, LogOut, ShieldCheck, UserCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
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

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/health`, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    })
      .then(async (res) => {
        if (res.status === 304) {
          return { status: "healthy", message: "Database connection OK ✅" };
        }

        if (!res.ok) {
          throw new Error(`Health check failed with status ${res.status}`);
        }

        return res.json();
      })
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
    <div className="space-y-4 pb-6">
      <header>
        <p className="page-label">Control</p>
        <h1 className="page-title">Settings</h1>
      </header>

      <section className="card-surface p-4">
        <p className="section-title mb-3">Profile</p>
        <div className="flex items-center gap-3 rounded-[14px] border border-[var(--border)] p-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--highlight-soft)]">
            <UserCircle2 className="text-[var(--highlight)]" size={24} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Admin User</p>
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
          className="app-button app-button-danger mt-3 flex w-full items-center justify-center gap-2 px-3 py-2 text-sm font-medium transition-all focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--error)]"
        >
          <LogOut size={16} /> Log Out
        </button>
      </section>

      <section className="card-surface p-4">
        <p className="section-title mb-3">Notification Preferences</p>
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
            className="flex w-full items-center justify-between border-b border-[var(--border)] px-0 py-3 last:border-none transition-colors hover:bg-[var(--surface-hover)] active:bg-[var(--surface)] focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--highlight)] rounded-lg"
          >
            <span className="text-sm font-medium text-[var(--text-primary)]">{pref.label}</span>
            <span 
              className="toggle-track" 
              data-active={String(prefs[pref.key])}
              role="switch"
              aria-checked={prefs[pref.key]}
            >
              <span className="toggle-thumb" />
            </span>
          </button>
        ))}

        <button
          type="button"
          disabled={pushLoading}
          onClick={() => (subscribed ? unsubscribe() : subscribe())}
          className="mt-3 flex w-full items-center justify-between rounded-[14px] border border-[var(--border)] px-3 py-3 transition-all hover:bg-[var(--surface-hover)] active:bg-[var(--surface)] disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--highlight)]"
        >
          <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
            <Bell size={14} className="text-[var(--highlight)]" /> Push Subscription
          </span>
          <span className={`text-xs font-semibold ${subscribed ? "text-[var(--success)]" : "text-[var(--text-secondary)]"}`}>
            {pushLoading ? "Updating..." : subscribed ? "Subscribed" : "Not Subscribed"}
          </span>
        </button>
      </section>

      <section className="card-surface p-4">
        <p className="section-title mb-3">App Info</p>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-primary)]">Version</span>
            <span className="text-[var(--text-secondary)]">{appVersion}</span>
          </div>
          {/* <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[var(--text-primary)]">
              <ShieldCheck size={14} className="text-[var(--highlight)]" /> Backend Health
            </span>
            <span
              className="inline-flex items-center gap-1 text-xs font-medium"
              style={{ color: health.status === "healthy" ? "var(--success)" : "var(--error)" }}
            >
              <CircleDot size={10} /> {health.status || "unknown"}
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">{health.message}</p> */}
        </div>
      </section>
    </div>
  );
}
