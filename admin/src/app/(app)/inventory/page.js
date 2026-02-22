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
  if (qty <= 0) return "#9b2c2c";
  if (qty < 10) return "#b7791f";
  return "#2f6b4f";
};

export default function InventoryPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [rows, setRows] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadInventory = useCallback(async () => {
    setLoading(true);
    setError(null);

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
    } catch (err) {
      setRows([]);
      setError(err);
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

  const listState = useEmptyState(loading, rows, error);

  const updateQty = async (variantId, nextQuantity) => {
    try {
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
    } catch {
      // silent
    }
  };

  return (
    <div className="space-y-3 pb-6">
      <header>
        <p className="page-label">Stock</p>
        <h1 className="page-title">Inventory</h1>

        <div className="mt-3 flex h-11 items-center rounded-[14px] border border-[var(--border)] bg-white px-3 transition-all focus-within:border-[var(--highlight)] focus-within:ring-2 focus-within:ring-[var(--highlight-soft)]">
          <Search size={15} className="text-[var(--text-muted)]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search SKU, product, color"
            className="ml-2 w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
          />
        </div>

        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
          {chips.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => setFilter(chip.value)}
              className={`app-chip whitespace-nowrap rounded-full px-3 py-1.5 text-xs transition-colors ${filter === chip.value
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)]"
                }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </header>

      {listState.isLoading ? (
        <div className="space-y-2">
          <div className="skeleton h-24 rounded-[18px]" />
          <div className="skeleton h-24 rounded-[18px]" />
        </div>
      ) : listState.showError ? (
        <div className="pt-4">
          <EmptyState
            title="Failed to load inventory"
            description="Something went wrong. Please try again."
            icon={PackageOpen}
            variant="error"
            action={{ label: "Retry", onClick: loadInventory }}
          />
        </div>
      ) : listState.showEmpty ? (
        <div className="pt-4">
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
              <section key={group.product.id} className="card-surface p-3">
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => ({ ...prev, [group.product.id]: !isOpen }))}
                  className="flex w-full items-center justify-between"
                >
                  <div className="text-left">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{group.product.name}</p>
                    <p className="text-xs text-[var(--text-secondary)]">Total stock {totalStock}</p>
                  </div>
                  {isOpen ? <ChevronUp size={16} className="text-[var(--text-muted)]" /> : <ChevronDown size={16} className="text-[var(--text-muted)]" />}
                </button>

                {isOpen ? (
                  <div className="mt-3 space-y-2">
                    {group.variants.map((variant) => {
                      const qty = variant.inventory?.quantity || 0;
                      const reserved = variant.inventory?.reserved || 0;
                      const barPercent = Math.min(100, qty * 5);
                      const barColor = stockColor(qty);

                      return (
                        <div key={variant.variantId} className="rounded-[14px] border border-[var(--border)] p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-[var(--text-primary)]">{variant.color} · {variant.size}</p>
                              <p className="text-[11px] text-[var(--text-muted)]">SKU {variant.sku}</p>
                            </div>
                            <span className="text-xs text-[var(--text-secondary)]">Reserved {reserved}</span>
                          </div>

                          <div className="mt-2.5 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateQty(variant.variantId, Math.max(0, qty - 1))}
                              className="grid h-8 w-8 place-items-center rounded-xl border border-[var(--border)] text-sm transition-colors hover:bg-[var(--surface-hover)]"
                            >
                              -
                            </button>
                            <span className="w-8 text-center text-sm font-semibold">{qty}</span>
                            <button
                              type="button"
                              onClick={() => updateQty(variant.variantId, qty + 1)}
                              className="grid h-8 w-8 place-items-center rounded-xl border border-[var(--border)] text-sm transition-colors hover:bg-[var(--surface-hover)]"
                            >
                              +
                            </button>
                          </div>

                          <div className="mt-2.5 h-1.5 w-full rounded-full bg-[var(--border)]">
                            <div className="h-full rounded-full transition-all" style={{ width: `${barPercent}%`, background: barColor }} />
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
