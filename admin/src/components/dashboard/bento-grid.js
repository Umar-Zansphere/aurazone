"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Boxes, Megaphone, PackagePlus, ShoppingBag } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import StatusRing from "@/components/charts/status-ring";

export default function BentoGrid({ statusBreakdown, lowStockCount, topProduct }) {
  const router = useRouter();

  return (
    <section className="grid grid-cols-3 gap-3">
      <motion.button
        type="button"
        onClick={() => router.push("/orders?status=PENDING")}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-surface col-span-2 h-[170px] p-3 text-left"
      >
        <p className="text-xs font-medium text-[var(--text-secondary)]">Order Status Ring</p>
        <div className="mt-2 h-[122px]">
          <StatusRing dataMap={statusBreakdown} />
        </div>
      </motion.button>

      <motion.button
        type="button"
        onClick={() => router.push("/inventory?stock=low")}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04 }}
        className="card-surface h-[170px] p-3 text-left"
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-[var(--text-secondary)]">Low Stock</p>
          <AlertTriangle className="pulse-soft text-[var(--error)]" size={18} />
        </div>
        <p className="mt-4 text-4xl font-bold text-[var(--error)]">{lowStockCount}</p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">Variants below threshold</p>
      </motion.button>

      <motion.button
        type="button"
        onClick={() => router.push("/products")}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="card-surface h-[170px] overflow-hidden p-0 text-left"
      >
        <div className="relative h-24 w-full">
          {topProduct?.imageUrl ? (
            <Image
              src={topProduct.imageUrl}
              alt={topProduct.name}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="h-full w-full bg-zinc-100" />
          )}
        </div>
        <div className="p-2.5">
          <p className="line-clamp-1 text-xs font-semibold">{topProduct?.name || "Top Product"}</p>
          <p className="text-[11px] text-[var(--text-secondary)]">{topProduct?.unitsSold || 0} sold this week</p>
        </div>
      </motion.button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="card-surface col-span-2 h-[170px] p-2.5"
      >
        <p className="mb-2 text-xs font-medium text-[var(--text-secondary)]">Quick Actions</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: PackagePlus, label: "Add Product", href: "/products/new" },
            { icon: ShoppingBag, label: "View Orders", href: "/orders" },
            { icon: Boxes, label: "Inventory", href: "/inventory" },
            { icon: Megaphone, label: "Broadcast", href: "/notifications?compose=1" },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                onClick={() => router.push(action.href)}
                className="flex h-14 items-center gap-2 rounded-2xl border border-[var(--card-border)] px-2 text-left"
              >
                <span className="grid h-9 w-9 place-items-center rounded-2xl bg-[color:rgba(27,42,74,0.08)] text-[var(--accent)]">
                  <Icon size={16} />
                </span>
                <span className="text-xs font-medium">{action.label}</span>
              </button>
            );
          })}
        </div>
      </motion.div>
    </section>
  );
}
