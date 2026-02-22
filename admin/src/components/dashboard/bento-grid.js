"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Boxes, Megaphone, PackagePlus, ShoppingBag } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import StatusRing from "@/components/charts/status-ring";

export default function BentoGrid({ statusBreakdown, lowStockCount, topProduct }) {
  const router = useRouter();

  return (
    <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <motion.button
        type="button"
        onClick={() => router.push("/orders?status=PENDING")}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-surface card-hover col-span-2 h-[180px] p-4 text-left relative overflow-hidden group"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-transparent to-[color:rgba(27,42,74,0.02)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Order Status</p>
        <div className="mt-3 h-[122px] w-full">
          <StatusRing dataMap={statusBreakdown} />
        </div>
      </motion.button>

      <motion.button
        type="button"
        onClick={() => router.push("/inventory?stock=low")}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04 }}
        className="card-surface card-hover col-span-1 h-[180px] p-4 text-left flex flex-col justify-between"
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Low Stock</p>
          <div className="rounded-full bg-red-50 p-1.5">
            <AlertTriangle className="pulse-soft text-[var(--error)]" size={16} />
          </div>
        </div>
        <div>
          <p className="mt-4 text-5xl font-extrabold text-[var(--error)] tracking-tight">{lowStockCount}</p>
          <p className="mt-2 text-[11px] font-medium text-[var(--text-secondary)] leading-tight">Variants below threshold</p>
        </div>
      </motion.button>

      <motion.button
        type="button"
        onClick={() => router.push("/products")}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="card-surface card-hover col-span-1 h-[180px] overflow-hidden p-0 text-left flex flex-col"
      >
        <div className="relative h-28 w-full bg-zinc-50 border-b border-[var(--card-border)]">
          {topProduct?.imageUrl ? (
            <Image
              src={topProduct.imageUrl}
              alt={topProduct.name}
              fill
              className="object-cover transition-transform duration-500 hover:scale-105"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100">
              <Boxes size={24} className="text-zinc-300" />
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col justify-center px-3 py-2 bg-white">
          <p className="line-clamp-1 text-sm font-bold text-[var(--accent)]">{topProduct?.name || "Top Product"}</p>
          <p className="text-[11px] font-medium text-[var(--highlight)]">{topProduct?.unitsSold || 0} sold this week</p>
        </div>
      </motion.button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="card-surface col-span-2 md:col-span-4 h-auto p-4"
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Quick Actions</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
                className="group flex h-14 items-center gap-3 rounded-[16px] border border-[var(--border)] bg-transparent px-3 text-left transition-all hover:border-[var(--accent)] hover:bg-slate-50 hover:shadow-sm"
              >
                <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[color:rgba(27,42,74,0.06)] text-[var(--accent)] transition-colors group-hover:bg-[var(--accent)] group-hover:text-white">
                  <Icon size={16} />
                </span>
                <span className="text-[13px] font-semibold text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent)]">{action.label}</span>
              </button>
            );
          })}
        </div>
      </motion.div>
    </section>
  );
}
