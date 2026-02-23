"use client";

import { motion } from "framer-motion";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useAuthStore } from "@/stores/use-auth-store";

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const loading = useAuthStore((state) => state.loading);
  const error = useAuthStore((state) => state.error);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const canSubmit = useMemo(() => email.trim() && password.trim(), [email, password]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit || loading) return;

    try {
      await login({ email, password });
      router.push("/");
    } catch (error) {
      // Error is mapped from store.
      
    }
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden p-6" style={{ background: "var(--bg-app)" }}>

      <div className="relative z-10 w-full max-w-[420px]">
        <div className="mb-8 text-center">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl"
            style={{ background: "var(--highlight-soft)" }}
          >
            <span className="text-2xl font-bold" style={{ color: "var(--highlight)" }}>AZ</span>
          </motion.div>
          <h1 className="text-[28px] font-semibold" style={{ color: "var(--text-primary)" }}>AuraZone Admin</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>Mobile control center for your storefront</p>
        </div>

        <motion.form
          onSubmit={handleSubmit}
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.08 }}
          className="space-y-4 rounded-[28px] border p-4"
          style={{ background: "var(--surface)", borderColor: "var(--card-border)" }}
        >
          <div className="space-y-2">
            <label htmlFor="email" className="form-label">
              Email
            </label>
            <div className="relative">
              <Mail size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="form-input pr-9"
                placeholder="admin@aurazone.com"
                autoComplete="email"
                required
                aria-label="Email address"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <div className="relative">
              <Lock size={16} className="absolute right-9 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2 top-1/2 -translate-y-1/2 grid h-7 w-7 place-items-center rounded-full transition-colors hover:bg-[var(--surface-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--highlight)]"
                style={{ color: "var(--text-muted)" }}
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={0}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="form-input pr-14"
                placeholder="••••••••"
                autoComplete="current-password"
                required
                aria-label="Password"
              />
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.98 }}
            disabled={!canSubmit || loading}
            type="submit"
            className="app-button flex h-12 w-full items-center justify-center gap-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--highlight)" }}
          >
            {loading ? <span className="brand-spinner h-4 w-4 rounded-full border-2 border-white border-t-transparent" /> : null}
            {loading ? "Signing In..." : "Sign In"}
          </motion.button>
        </motion.form>

        {error ? (
          <motion.div
            initial={{ y: 6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mt-3 rounded-2xl border px-3 py-2 text-sm"
            style={{ borderColor: "rgba(155, 44, 44, 0.25)", background: "rgba(155, 44, 44, 0.04)", color: "var(--error)" }}
          >
            {error}
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}
