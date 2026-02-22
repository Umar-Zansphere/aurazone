"use client";

import { motion } from "framer-motion";

export default function PullIndicator({ pullDistance = 0, refreshing = false }) {
  const opacity = Math.min(1, pullDistance / 60);

  return (
    <motion.div
      className="pointer-events-none sticky top-0 z-20 flex justify-center"
      animate={{ y: Math.min(24, pullDistance * 0.4), opacity: refreshing ? 1 : opacity }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
    >
      {(opacity > 0 || refreshing) && (
        <div className="mt-2 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm">
          <div className="brand-spinner h-4 w-4 rounded-full border-2 border-[var(--highlight)] border-t-transparent" />
        </div>
      )}
    </motion.div>
  );
}
