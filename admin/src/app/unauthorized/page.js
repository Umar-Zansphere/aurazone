"use client";

import { motion } from "framer-motion";
import { ShieldX } from "lucide-react";
import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="mb-6 grid h-20 w-20 place-items-center rounded-3xl bg-[color:rgba(196,91,91,0.12)] text-[var(--error)]"
      >
        <ShieldX size={38} />
      </motion.div>
      <h1 className="text-2xl font-semibold">You don&apos;t have admin access</h1>
      <p className="mt-2 max-w-sm text-sm text-[var(--text-secondary)]">
        Your account is signed in, but this workspace requires an administrator role.
      </p>
      <Link
        href="/login"
        className="app-button mt-6 rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white"
      >
        Go to Login
      </Link>
    </div>
  );
}
