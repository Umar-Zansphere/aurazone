"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Boxes, Megaphone, PackagePlus, ShoppingBag } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import StatusRing from "@/components/charts/status-ring";

export default function BentoGrid({ statusBreakdown, lowStockCount, topProduct }) {
  const router = useRouter();

  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {/* <motion.button
        type="button"
        onClick={() => router.push("/orders?status=PENDING")}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-surface card-hover col-span-2 h-[180px] p-4 text-left relative overflow-hidden group"
      >
        <p className="section-title">Order Status</p>
        <div className="mt-3 h-[122px] w-full">
          <StatusRing dataMap={statusBreakdown} />
        </div>
      </motion.button> */}

      <motion.button
        type="button"
        onClick={() => router.push("/inventory?stock=low")}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04 }}
        className="card-surface card-hover col-span-1 h-[180px] p-4 text-left flex flex-col justify-between"
      >
        <div className="flex items-center justify-between">
          <p className="section-title">Low Stock</p>
          <div className="rounded-xl bg-[color:rgba(155,44,44,0.06)] p-1.5">
            <AlertTriangle className="pulse-soft text-[var(--error)]" size={15} />
          </div>
        </div>
        <div>
          <p className="mt-4 text-5xl font-extrabold tracking-tight text-[var(--error)]">{lowStockCount}</p>
          <p className="mt-2 text-[11px] font-medium leading-tight text-[var(--text-secondary)]">Variants below threshold</p>
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
        <div className="relative h-28 w-full bg-[var(--bg-app)] border-b border-[var(--card-border)]">
          {topProduct?.imageUrl ? (
            <Image
              src={topProduct.imageUrl}
              alt={topProduct.name}
              fill
              className="object-cover transition-transform duration-500 hover:scale-105"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[var(--surface-hover)]">
              <Boxes size={24} className="text-[var(--text-muted)]" />
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col justify-center px-3 py-2 bg-white">
          <p className="line-clamp-1 text-sm font-bold text-[var(--text-primary)]">{topProduct?.name || "Top Product"}</p>
          <p className="text-[11px] font-medium text-[var(--highlight)]">{topProduct?.unitsSold || 0} sold this week</p>
        </div>
      </motion.button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="card-surface col-span-2 md:col-span-4 h-auto p-4"
      >
        <p className="mb-3 section-title">Quick Actions</p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
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
                className="group flex h-14 items-center gap-3 rounded-[14px] border border-[var(--border)] bg-transparent px-3 text-left transition-all hover:border-[var(--highlight)] hover:bg-[var(--highlight-soft)]"
              >
                <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[var(--highlight-soft)] text-[var(--highlight)] transition-colors group-hover:bg-[var(--highlight)] group-hover:text-white">
                  <Icon size={15} />
                </span>
                <span className="text-[13px] font-semibold text-[var(--text-primary)]">{action.label}</span>
              </button>
            );
          })}
        </div>
      </motion.div>
    </section>
  );
}
