"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { formatCurrencyINR } from "@/lib/format";
import { useRef } from "react";

const getPriceRange = (variants = []) => {
  const prices = variants.map((item) => Number(item.price) || 0).filter((price) => Number.isFinite(price));
  if (!prices.length) return "₹0";

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) return formatCurrencyINR(min);
  return `${formatCurrencyINR(min)} - ${formatCurrencyINR(max)}`;
};

const getStockState = (variants = []) => {
  const total = variants.reduce((sum, variant) => sum + (variant.inventory?.quantity || 0), 0);
  if (total <= 0) return { label: "Out", color: "#9b2c2c" };
  if (total < 10) return { label: "Low", color: "#b7791f" };
  return { label: "In", color: "#2f6b4f" };
};

export default function ProductCard({ product, onOpen, onLongPress }) {
  const timerRef = useRef(null);

  const primaryImage =
    product.variants?.flatMap((variant) => variant.images || []).find((image) => image.isPrimary) ||
    product.variants?.flatMap((variant) => variant.images || [])[0] ||
    null;

  const stock = getStockState(product.variants || []);

  const triggerLongPress = () => {
    if (onLongPress) onLongPress(product);
  };

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      onClick={() => onOpen(product)}
      onContextMenu={(event) => {
        event.preventDefault();
        triggerLongPress();
      }}
      onTouchStart={() => {
        timerRef.current = setTimeout(triggerLongPress, 460);
      }}
      onTouchEnd={() => {
        clearTimeout(timerRef.current);
      }}
      onTouchCancel={() => {
        clearTimeout(timerRef.current);
      }}
      className="card-surface overflow-hidden text-left h-full flex flex-col"
    >
      <div className="relative h-40 w-full shrink-0 bg-[var(--bg-app)]">
        {primaryImage?.url ? (
          <Image src={primaryImage.url} alt={product.name} fill className="object-cover" unoptimized />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-2xl text-[var(--text-muted)]">📦</span>
          </div>
        )}

        <div className="absolute left-2 top-2 flex max-w-[calc(100%-16px)] flex-wrap gap-1">
          {product.isActive ? (
            <span className="app-chip shrink-0 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-semibold text-white">
              Active
            </span>
          ) : null}
          {product.isFeatured ? (
            <span className="app-chip shrink-0 rounded-full bg-[var(--highlight)] px-2 py-0.5 text-[10px] font-semibold text-white">
              Featured
            </span>
          ) : null}
        </div>
      </div>

      <div className="space-y-1 p-2.5">
        <p className="line-clamp-1 text-sm font-semibold text-[var(--text-primary)]">{product.name}</p>
        <p className="line-clamp-1 text-[11px] text-[var(--text-secondary)]">{product.brand}</p>
        <p className="text-xs font-medium text-[var(--text-primary)]">{getPriceRange(product.variants)}</p>

        <div className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
          <span className="h-2 w-2 rounded-full" style={{ background: stock.color }} />
          {stock.label} stock
        </div>
      </div>
    </motion.button>
  );
}
