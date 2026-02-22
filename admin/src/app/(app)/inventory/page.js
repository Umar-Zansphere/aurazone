"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Search, PackageOpen } from "lucide-react";
import EmptyState from "@/components/ui/empty-state";
import { useEmptyState } from "@/hooks/use-empty-state";
import { apiFetch } from "@/lib/api";

const chips = [
  { label: "All", value: "all" },
  { label: "Low Stock", value: "low" },
  { label: "Out of Stock", value: "out" },
];

const stockColor = (qty) => {
  if (qty <= 0) return "#C45B5B";
  if (qty < 10) return "#D4954A";
  return "#5B8C5A";
};

export default function InventoryPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [rows, setRows] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);

  const loadInventory = useCallback(async () => {
    setLoading(true);

    try {
      const data = await apiFetch("/admin/inventory", {
        params: {
          search: query,
          lowStockOnly: filter === "low" ? "true" : undefined,
          take: 100,
        },
      });

      const raw = data.inventories || [];
      const filtered = raw.filter((row) => {
        if (filter === "out") return (row.inventory?.quantity || 0) <= 0;
        return true;
      });
      setRows(filtered);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filter, query]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const grouped = useMemo(() => {
    const acc = {};
    rows.forEach((row) => {
      if (!acc[row.product.id]) {
        acc[row.product.id] = {
          product: row.product,
          variants: [],
        };
      }
      acc[row.product.id].variants.push(row);
    });
    return Object.values(acc);
  }, [rows]);

  const listState = useEmptyState(loading, rows, null);

  const updateQty = async (variantId, nextQuantity) => {
    await apiFetch(`/admin/variants/${variantId}/inventory`, {
      method: "PUT",
      body: JSON.stringify({ quantity: nextQuantity }),
    });

    setRows((current) =>
      current.map((row) =>
        row.variantId === variantId
          ? {
            ...row,
            inventory: {
              ...row.inventory,
              quantity: nextQuantity,
              available: Math.max(0, nextQuantity - (row.inventory?.reserved || 0)),
            },
          }
          : row
      )
    );
  };

  return (
    <div className="space-y-3 pb-6">
      <header>
        <div className="mt-3 flex h-11 items-center rounded-2xl border border-[var(--card-border)] bg-white px-3">
          <Search size={16} className="text-[var(--text-muted)]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search SKU, product, color"
            className="ml-2 w-full bg-transparent text-sm outline-none"
          />
        </div>

        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {chips.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => setFilter(chip.value)}
              className={`app-chip whitespace-nowrap rounded-full px-3 py-1.5 text-xs ${filter === chip.value
                ? "bg-[var(--accent)] text-white"
                : "bg-zinc-100 text-[var(--text-secondary)]"
                }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </header>

      {listState.isLoading ? (
        <div className="space-y-2">
          <div className="skeleton h-24 rounded-[20px]" />
          <div className="skeleton h-24 rounded-[20px]" />
        </div>
      ) : listState.showEmpty ? (
        <div className="pt-8">
          <EmptyState
            title="No inventory records"
            description={query || filter !== "all" ? "Try adjusting your search or filters." : "You do not have any inventory data."}
            icon={PackageOpen}
          />
        </div>
      ) : (
        <div className="space-y-2.5">
          {grouped.map((group) => {
            const isOpen = Boolean(expanded[group.product.id]);
            const totalStock = group.variants.reduce((sum, item) => sum + (item.inventory?.quantity || 0), 0);

            return (
              <section key={group.product.id} className="card-surface p-2.5">
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => ({ ...prev, [group.product.id]: !isOpen }))}
                  className="flex w-full items-center justify-between"
                >
                  <div className="text-left">
                    <p className="text-sm font-semibold">{group.product.name}</p>
                    <p className="text-xs text-[var(--text-secondary)]">Total stock {totalStock}</p>
                  </div>
                  {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {isOpen ? (
                  <div className="mt-2 space-y-2">
                    {group.variants.map((variant) => {
                      const qty = variant.inventory?.quantity || 0;
                      const reserved = variant.inventory?.reserved || 0;
                      const barPercent = Math.min(100, qty * 5);
                      const barColor = stockColor(qty);

                      return (
                        <div key={variant.variantId} className="rounded-2xl border border-[var(--card-border)] p-2.5">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">{variant.color} · {variant.size}</p>
                              <p className="text-[11px] text-[var(--text-secondary)]">SKU {variant.sku}</p>
                            </div>
                            <span className="text-xs text-[var(--text-secondary)]">Reserved {reserved}</span>
                          </div>

                          <div className="mt-2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateQty(variant.variantId, Math.max(0, qty - 1))}
                              className="grid h-8 w-8 place-items-center rounded-xl border border-[var(--card-border)]"
                            >
                              -
                            </button>
                            <span className="w-8 text-center text-sm font-semibold">{qty}</span>
                            <button
                              type="button"
                              onClick={() => updateQty(variant.variantId, qty + 1)}
                              className="grid h-8 w-8 place-items-center rounded-xl border border-[var(--card-border)]"
                            >
                              +
                            </button>
                          </div>

                          <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-200">
                            <div className="h-full rounded-full" style={{ width: `${barPercent}%`, background: barColor }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
