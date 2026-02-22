"use client";

import { motion } from "framer-motion";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useAuthStore } from "@/stores/use-auth-store";

const particles = Array.from({ length: 9 }, (_, idx) => ({
  id: idx,
  size: 22 + idx * 8,
  left: `${8 + idx * 10}%`,
  top: `${10 + (idx % 4) * 18}%`,
  delay: idx * 0.22,
}));

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
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_20%_20%,#243b69_0%,#101827_42%,#0b111b_100%)] p-6">
      {particles.map((particle) => (
        <motion.span
          key={particle.id}
          className="absolute rounded-[40%] border border-white/12 bg-white/5"
          style={{ width: particle.size, height: particle.size, left: particle.left, top: particle.top }}
          animate={{ y: [0, -12, 0], rotate: [0, 12, 0], opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 6 + particle.id * 0.4, repeat: Infinity, delay: particle.delay }}
        />
      ))}

      <div className="relative z-10 w-full max-w-[420px]">
        <div className="mb-8 text-center text-white">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-white/10 backdrop-blur"
          >
            <span className="text-2xl font-bold">AZ</span>
          </motion.div>
          <h1 className="text-[28px] font-semibold">AuraZone Admin</h1>
          <p className="mt-1 text-sm text-white/70">Mobile control center for your storefront</p>
        </div>

        <motion.form
          onSubmit={handleSubmit}
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.08 }}
          className="space-y-4 rounded-[28px] border border-white/12 bg-white/8 p-4 backdrop-blur-xl"
        >
          <label className="group relative block rounded-2xl border border-white/20 bg-white/10 px-3 pb-2 pt-5">
            <span className={`absolute left-3 text-xs transition-all ${email ? "top-2 text-white/70" : "top-5 text-white/45"}`}>
              Email
            </span>
            <Mail size={16} className="absolute right-3 top-4 text-white/60" />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full border-none bg-transparent text-sm text-white outline-none placeholder:text-white/35"
              placeholder="admin@aurazone.com"
              required
            />
          </label>

          <label className="relative block rounded-2xl border border-white/20 bg-white/10 px-3 pb-2 pt-5">
            <span className={`absolute left-3 text-xs transition-all ${password ? "top-2 text-white/70" : "top-5 text-white/45"}`}>
              Password
            </span>
            <Lock size={16} className="absolute right-9 top-4 text-white/60" />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-2 top-3 grid h-7 w-7 place-items-center rounded-full text-white/70"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full border-none bg-transparent pr-9 text-sm text-white outline-none placeholder:text-white/35"
              placeholder="••••••••"
              required
            />
          </label>

          <motion.button
            whileTap={{ scale: 0.98 }}
            disabled={!canSubmit || loading}
            type="submit"
            className="app-button flex h-12 w-full items-center justify-center gap-2 bg-[var(--highlight)] text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? <span className="brand-spinner h-4 w-4 rounded-full border-2 border-white border-t-transparent" /> : null}
            {loading ? "Signing In..." : "Sign In"}
          </motion.button>
        </motion.form>

        {error ? (
          <motion.div
            initial={{ y: 6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mt-3 rounded-2xl border border-[color:rgba(196,91,91,0.6)] bg-[color:rgba(196,91,91,0.15)] px-3 py-2 text-sm text-white"
          >
            {error}
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}
