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
        className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] md:hidden"
      >
        <div className="relative rounded-[24px] border border-[var(--card-border)] bg-white/95 px-2 pb-2 pt-3 shadow-lg backdrop-blur">
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
                    className={`grid h-8 min-w-8 place-items-center rounded-full px-2 text-xs transition-colors ${active
                      ? "bg-[var(--accent)] text-white"
                      : "bg-transparent text-[var(--text-secondary)]"
                      }`}
                  >
                    <Icon size={17} fill={active ? "currentColor" : "none"} />
                  </span>
                  <span className={`text-[10px] font-medium ${active ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>
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
                className="-mt-7 grid h-14 w-14 place-items-center rounded-[20px] border-4 border-[var(--bg-app)] bg-[var(--accent)] text-white shadow-md"
                aria-label="Create"
              >
                <Plus size={22} />
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
                    className={`grid h-8 min-w-8 place-items-center rounded-full px-2 text-xs transition-colors ${active
                      ? "bg-[var(--accent)] text-white"
                      : "bg-transparent text-[var(--text-secondary)]"
                      }`}
                  >
                    <Icon size={17} fill={active ? "currentColor" : "none"} />
                  </span>
                  <span className={`text-[10px] font-medium ${active ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>
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
