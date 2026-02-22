"use client";

import { motion } from "framer-motion";
import { House, ShoppingBag, Plus, Package, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useScrollDirection } from "@/hooks/use-scroll-direction";
import CreateActionSheet from "@/components/navigation/create-action-sheet";

const tabs = [
  { label: "Home", href: "/", icon: House, match: (path) => path === "/" },
  { label: "Orders", href: "/orders", icon: ShoppingBag, match: (path) => path.startsWith("/orders") },
  { label: "Products", href: "/products", icon: Package, match: (path) => path.startsWith("/products") },
  { label: "Profile", href: "/settings", icon: User, match: (path) => path.startsWith("/settings") },
];

export default function BottomTabBar() {
  const pathname = usePathname();
  const { direction, isTop } = useScrollDirection();
  const [createOpen, setCreateOpen] = useState(false);

  const hidden = direction === "down" && !isTop;

  return (
    <>
      <motion.nav
        initial={false}
        animate={{
          y: hidden ? 120 : 0,
          opacity: hidden ? 0 : 1,
        }}
        transition={{ type: "spring", stiffness: 260, damping: 28 }}
        className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[520px] px-4 pb-[calc(env(safe-area-inset-bottom)+12px)]"
      >
        <div className="relative rounded-[28px] border border-[var(--card-border)] bg-white/95 px-2 pb-2 pt-3 shadow-xl backdrop-blur">
          <div className="grid grid-cols-5 items-end gap-1">
            {tabs.slice(0, 2).map((tab) => {
              const Icon = tab.icon;
              const active = tab.match(pathname);

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className="flex flex-col items-center gap-1 rounded-2xl py-1"
                >
                  <span
                    className={`grid h-8 min-w-8 place-items-center rounded-full px-2 text-xs ${
                      active
                        ? "bg-[var(--accent)] text-white"
                        : "bg-transparent text-[var(--text-secondary)]"
                    }`}
                  >
                    <Icon size={18} fill={active ? "currentColor" : "none"} />
                  </span>
                  <span className={`text-[11px] ${active ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}`}>
                    {tab.label}
                  </span>
                </Link>
              );
            })}

            <div className="flex justify-center">
              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={() => setCreateOpen(true)}
                className="-mt-8 grid h-16 w-16 place-items-center rounded-[22px] border-4 border-[var(--bg-app)] bg-[var(--highlight)] text-white shadow-lg"
                aria-label="Create"
              >
                <Plus size={24} />
              </motion.button>
            </div>

            {tabs.slice(2).map((tab) => {
              const Icon = tab.icon;
              const active = tab.match(pathname);

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className="flex flex-col items-center gap-1 rounded-2xl py-1"
                >
                  <span
                    className={`grid h-8 min-w-8 place-items-center rounded-full px-2 text-xs ${
                      active
                        ? "bg-[var(--accent)] text-white"
                        : "bg-transparent text-[var(--text-secondary)]"
                    }`}
                  >
                    <Icon size={18} fill={active ? "currentColor" : "none"} />
                  </span>
                  <span className={`text-[11px] ${active ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}`}>
                    {tab.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </motion.nav>

      <CreateActionSheet open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
