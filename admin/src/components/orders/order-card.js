"use client";

import { motion, useMotionValue } from "framer-motion";
import { CreditCard, HandCoins } from "lucide-react";
import { formatCurrencyINR, formatRelativeTime, statusTone } from "@/lib/format";

const statusFlow = {
  PENDING: "PAID",
  PAID: "SHIPPED",
  SHIPPED: "DELIVERED",
  DELIVERED: null,
  CANCELLED: null,
};

export const getNextStatus = (status) => statusFlow[status] || null;

export default function OrderCard({ order, onOpen, onNextStatus, onCancel }) {
  const x = useMotionValue(0);

  return (
    <motion.div className="relative">
      <div className="absolute inset-0 flex overflow-hidden rounded-[18px]">
        <div className="flex flex-1 items-center justify-start rounded-[18px] bg-[color:rgba(47,107,79,0.12)] px-4 text-sm font-semibold text-[var(--success)]">
          Mark {getNextStatus(order.status) || "Done"}
        </div>
        <div className="flex flex-1 items-center justify-end rounded-[18px] bg-[color:rgba(155,44,44,0.1)] px-4 text-sm font-semibold text-[var(--error)]">
          Cancel
        </div>
      </div>

      <motion.button
        type="button"
        drag="x"
        style={{ x }}
        dragElastic={0.08}
        dragConstraints={{ left: 0, right: 0 }}
        onDragEnd={(_, info) => {
          if (info.offset.x > 110 && getNextStatus(order.status)) {
            onNextStatus(order);
          } else if (info.offset.x < -110 && order.status !== "CANCELLED") {
            onCancel(order);
          }
        }}
        onClick={() => onOpen(order)}
        className="card-surface relative z-10 w-full p-3 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">#{order.orderNumber}</p>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{order.customer?.fullName || "Customer"}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-[var(--text-primary)]">{formatCurrencyINR(order.totalAmount)}</p>
            <p className="text-xs text-[var(--text-muted)]">{formatRelativeTime(order.createdAt)}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span
            className="app-chip rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
            style={{ background: statusTone[order.status] || "#9a9a9a" }}
          >
            {order.status}
          </span>

          <span className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)]">
            {order.paymentMethod === "COD" ? <HandCoins size={13} /> : <CreditCard size={13} />}
            {order.paymentMethod}
          </span>
        </div>
      </motion.button>
    </motion.div>
  );
}
