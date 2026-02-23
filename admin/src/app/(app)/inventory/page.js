"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  Search,
  PackageOpen,
  ScrollText,
  Plus,
  Minus,
  AlertCircle,
  RefreshCw,
  Boxes,
  AlertTriangle,
  Archive,
  TrendingDown,
  Lock,
} from "lucide-react";
import EmptyState from "@/components/ui/empty-state";
import BottomSheet from "@/components/ui/bottom-sheet";
import { useEmptyState } from "@/hooks/use-empty-state";
import { apiFetch } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";

const LOW_STOCK_THRESHOLD = 10;

const chips = [
  { label: "All", value: "all" },
  { label: "Low Stock", value: "low" },
  { label: "Out of Stock", value: "out" },
];

const operationOptions = [
  { value: "RESTOCK", label: "Restock", description: "Add stock", icon: Plus, color: "#2f6b4f" },
  { value: "REDUCE", label: "Reduce", description: "Remove stock", icon: Minus, color: "#9b2c2c" },
  { value: "SET", label: "Set", description: "Set exact quantity", icon: Archive, color: "#3b6b8c" },
  { value: "HOLD", label: "Hold", description: "Reserve for an order", icon: Lock, color: "#b7791f" },
  { value: "RELEASE", label: "Release", description: "Unreserve stock", icon: RefreshCw, color: "#2f6b4f" },
  { value: "RETURN", label: "Return", description: "Returned goods", icon: TrendingDown, color: "#3b6b8c" },
];

const stockColor = (qty) => {
  if (qty <= 0) return "#9b2c2c";
  if (qty < LOW_STOCK_THRESHOLD) return "#b7791f";
  return "#2f6b4f";
};

export default function InventoryPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [rows, setRows] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Logs
  const [logsOpen, setLogsOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Adjust inventory
  const [adjustSheet, setAdjustSheet] = useState(null);
  const [adjustDraft, setAdjustDraft] = useState({ operation: "RESTOCK", quantity: "", note: "" });
  const [adjustSaving, setAdjustSaving] = useState(false);
  const [actionError, setActionError] = useState(null);

  // Variant detail
  const [variantDetail, setVariantDetail] = useState(null);
  const [variantDetailOpen, setVariantDetailOpen] = useState(false);
  const [variantDetailLoading, setVariantDetailLoading] = useState(false);

  const loadInventory = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch("/admin/inventory", {
        params: {
          search: query,
          lowStockOnly: filter === "low" ? "true" : undefined,
          take: 200,
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

  // Overview stats
  const overview = useMemo(() => {
    const totalVariants = rows.length;
    const totalStock = rows.reduce((sum, r) => sum + (r.inventory?.quantity || 0), 0);
    const totalReserved = rows.reduce((sum, r) => sum + (r.inventory?.reserved || 0), 0);
    const totalAvailable = rows.reduce((sum, r) => sum + (r.inventory?.available || 0), 0);
    const outOfStock = rows.filter((r) => (r.inventory?.quantity || 0) <= 0).length;
    const lowStock = rows.filter((r) => {
      const qty = r.inventory?.quantity || 0;
      return qty > 0 && qty < LOW_STOCK_THRESHOLD;
    }).length;

    return { totalVariants, totalStock, totalReserved, totalAvailable, outOfStock, lowStock };
  }, [rows]);

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

  // Quick +/- buttons use the SET operation through updateVariantInventory
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
      setActionError("Failed to update quantity.");
    }
  };

  // Load inventory logs
  const loadLogs = async () => {
    setLogsOpen(true);
    setLogsLoading(true);
    try {
      const data = await apiFetch("/admin/inventory/logs", { params: { take: 50 } });
      setLogs(data.logs || []);
    } catch {
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  // Load variant detail
  const loadVariantDetail = async (variantId) => {
    setVariantDetailOpen(true);
    setVariantDetailLoading(true);
    try {
      const data = await apiFetch(`/admin/inventory/${variantId}`);
      setVariantDetail(data);
    } catch {
      setVariantDetail(null);
    } finally {
      setVariantDetailLoading(false);
    }
  };

  // Adjust inventory — sends { operation, quantity, note } as backend expects
  const adjustInventory = async () => {
    if (!adjustSheet) return;
    const qty = Number(adjustDraft.quantity);
    if (!Number.isInteger(qty) || qty < 0) {
      setActionError("Quantity must be a non-negative integer.");
      return;
    }
    if (adjustDraft.operation !== "SET" && qty === 0) {
      setActionError("Quantity must be greater than 0 for this operation.");
      return;
    }

    setAdjustSaving(true);
    setActionError(null);
    try {
      await apiFetch(`/admin/variants/${adjustSheet.variantId}/inventory/adjust`, {
        method: "POST",
        body: JSON.stringify({
          operation: adjustDraft.operation,
          quantity: qty,
          note: adjustDraft.note || undefined,
        }),
      });
      setAdjustSheet(null);
      setAdjustDraft({ operation: "RESTOCK", quantity: "", note: "" });
      await loadInventory();
    } catch (err) {
      setActionError(err?.message || "Failed to adjust inventory.");
    } finally {
      setAdjustSaving(false);
    }
  };

  const openAdjust = (variant) => {
    setAdjustDraft({ operation: "RESTOCK", quantity: "", note: "" });
    setActionError(null);
    setAdjustSheet(variant);
  };

  const selectedOp = operationOptions.find((op) => op.value === adjustDraft.operation);

  // Log type badge colors
  const logTypeColor = (type) => {
    const map = { RESTOCK: "#2f6b4f", HOLD: "#b7791f", RELEASE: "#3b6b8c", SOLD: "#9b2c2c", MANUAL: "#6b6b6b", RETURN: "#3b6b8c" };
    return map[type] || "#9a9a9a";
  };

  return (
    <div className="space-y-3 pb-6">
      <AnimatePresence>
        {actionError && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="error-banner">
            <AlertCircle size={16} />
            {actionError}
            <button type="button" onClick={() => setActionError(null)} className="ml-auto text-xs underline">Dismiss</button>
          </motion.div>
        )}
      </AnimatePresence>

      <header>
        <div className="flex items-end justify-between">
          <div>
            <p className="page-label">Stock</p>
            <h1 className="page-title">Inventory</h1>
          </div>
          <button
            type="button"
            onClick={loadLogs}
            className="app-button app-button-secondary flex items-center gap-1.5 px-3 py-2 text-xs"
          >
            <ScrollText size={14} /> Logs
          </button>
        </div>

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

      {/* Overview Dashboard */}
      {!loading && rows.length > 0 && (
        <section className="card-surface p-4">
          <p className="section-title mb-3">Overview</p>
          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-[14px] bg-[var(--bg-app)] p-2.5 text-center">
              <Boxes size={16} className="mx-auto text-[var(--text-muted)]" />
              <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">{overview.totalStock.toLocaleString()}</p>
              <p className="text-[10px] text-[var(--text-secondary)]">Total Stock</p>
            </div>
            <div className="rounded-[14px] bg-[var(--bg-app)] p-2.5 text-center">
              <PackageOpen size={16} className="mx-auto text-[var(--success)]" />
              <p className="mt-1 text-lg font-bold text-[var(--success)]">{overview.totalAvailable.toLocaleString()}</p>
              <p className="text-[10px] text-[var(--text-secondary)]">Available</p>
            </div>
            <div className="rounded-[14px] bg-[var(--bg-app)] p-2.5 text-center">
              <Lock size={16} className="mx-auto text-[var(--warning)]" />
              <p className="mt-1 text-lg font-bold text-[var(--warning)]">{overview.totalReserved.toLocaleString()}</p>
              <p className="text-[10px] text-[var(--text-secondary)]">Reserved</p>
            </div>
          </div>

          {(overview.lowStock > 0 || overview.outOfStock > 0) && (
            <div className="mt-2.5 flex gap-2">
              {overview.lowStock > 0 && (
                <div className="flex flex-1 items-center gap-2 rounded-[14px] border border-[rgba(183,121,31,0.2)] bg-[rgba(183,121,31,0.04)] p-2.5">
                  <AlertTriangle size={14} className="shrink-0 text-[var(--warning)]" />
                  <div>
                    <p className="text-xs font-semibold text-[var(--warning)]">{overview.lowStock}</p>
                    <p className="text-[10px] text-[var(--text-secondary)]">Low Stock (&lt;{LOW_STOCK_THRESHOLD})</p>
                  </div>
                </div>
              )}
              {overview.outOfStock > 0 && (
                <div className="flex flex-1 items-center gap-2 rounded-[14px] border border-[rgba(155,44,44,0.2)] bg-[rgba(155,44,44,0.04)] p-2.5">
                  <AlertCircle size={14} className="shrink-0 text-[var(--error)]" />
                  <div>
                    <p className="text-xs font-semibold text-[var(--error)]">{overview.outOfStock}</p>
                    <p className="text-[10px] text-[var(--text-secondary)]">Out of Stock</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <p className="mt-2 text-[11px] text-[var(--text-muted)]">{overview.totalVariants} variants across {grouped.length} products</p>
        </section>
      )}

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
            const totalReserved = group.variants.reduce((sum, item) => sum + (item.inventory?.reserved || 0), 0);
            const hasLow = group.variants.some((v) => {
              const q = v.inventory?.quantity || 0;
              return q > 0 && q < LOW_STOCK_THRESHOLD;
            });
            const hasOos = group.variants.some((v) => (v.inventory?.quantity || 0) <= 0);

            return (
              <section key={group.product.id} className="card-surface p-3">
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => ({ ...prev, [group.product.id]: !isOpen }))}
                  className="flex w-full items-center justify-between"
                >
                  <div className="text-left">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{group.product.name}</p>
                      {hasOos && <span className="h-2 w-2 rounded-full bg-[var(--error)]" title="Has out of stock" />}
                      {hasLow && !hasOos && <span className="h-2 w-2 rounded-full bg-[var(--warning)]" title="Has low stock" />}
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {totalStock} total{totalReserved > 0 ? ` · ${totalReserved} reserved` : ""} · {group.variants.length} variant{group.variants.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  {isOpen ? <ChevronUp size={16} className="text-[var(--text-muted)]" /> : <ChevronDown size={16} className="text-[var(--text-muted)]" />}
                </button>

                {isOpen ? (
                  <div className="mt-3 space-y-2">
                    {group.variants.map((variant) => {
                      const qty = variant.inventory?.quantity || 0;
                      const reserved = variant.inventory?.reserved || 0;
                      const available = variant.inventory?.available ?? Math.max(0, qty - reserved);
                      const barPercent = Math.min(100, qty > 0 ? (qty / Math.max(20, qty)) * 100 : 0);
                      const reservedPercent = qty > 0 ? (reserved / qty) * 100 : 0;

                      return (
                        <div key={variant.variantId} className="rounded-[14px] border border-[var(--border)] p-3">
                          <div className="flex items-start justify-between">
                            <button
                              type="button"
                              onClick={() => loadVariantDetail(variant.variantId)}
                              className="text-left"
                            >
                              <p className="text-sm font-medium text-[var(--text-primary)]">{variant.color} · {variant.size}</p>
                              <p className="text-[11px] text-[var(--text-muted)]">SKU {variant.sku}</p>
                            </button>
                            <button
                              type="button"
                              onClick={() => openAdjust(variant)}
                              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--highlight)] transition-colors hover:bg-[var(--surface-hover)]"
                            >
                              Adjust
                            </button>
                          </div>

                          {/* Stats row */}
                          <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-center">
                            <div className="rounded-lg bg-[var(--bg-app)] p-1.5">
                              <p className="text-xs font-bold" style={{ color: stockColor(qty) }}>{qty}</p>
                              <p className="text-[9px] text-[var(--text-muted)]">Stock</p>
                            </div>
                            <div className="rounded-lg bg-[var(--bg-app)] p-1.5">
                              <p className="text-xs font-bold text-[var(--success)]">{available}</p>
                              <p className="text-[9px] text-[var(--text-muted)]">Available</p>
                            </div>
                            <div className="rounded-lg bg-[var(--bg-app)] p-1.5">
                              <p className="text-xs font-bold text-[var(--warning)]">{reserved}</p>
                              <p className="text-[9px] text-[var(--text-muted)]">Reserved</p>
                            </div>
                          </div>

                          {/* Quick +/- */}
                          <div className="mt-2.5 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateQty(variant.variantId, Math.max(0, qty - 1))}
                              className="grid h-8 w-8 place-items-center rounded-xl border border-[var(--border)] text-sm transition-colors hover:bg-[var(--surface-hover)]"
                            >
                              -
                            </button>
                            <div className="flex-1">
                              <div className="relative h-2 w-full rounded-full bg-[var(--border)]">
                                <div className="h-full rounded-full transition-all" style={{ width: `${barPercent}%`, background: stockColor(qty) }} />
                                {reserved > 0 && (
                                  <div className="absolute left-0 top-0 h-full rounded-full bg-[var(--warning)] opacity-40" style={{ width: `${reservedPercent}%` }} />
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => updateQty(variant.variantId, qty + 1)}
                              className="grid h-8 w-8 place-items-center rounded-xl border border-[var(--border)] text-sm transition-colors hover:bg-[var(--surface-hover)]"
                            >
                              +
                            </button>
                          </div>

                          {/* Low stock / OOS badge */}
                          {qty <= 0 ? (
                            <p className="mt-2 text-[11px] font-semibold text-[var(--error)]">⊘ Out of stock</p>
                          ) : qty < LOW_STOCK_THRESHOLD ? (
                            <p className="mt-2 text-[11px] font-semibold text-[var(--warning)]">⚠ Low stock — {qty} left</p>
                          ) : null}
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

      {/* Inventory Logs Sheet */}
      <BottomSheet
        open={logsOpen}
        onClose={() => { setLogsOpen(false); setLogs([]); }}
        title="Inventory Logs"
        snap="full"
      >
        {logsLoading ? (
          <div className="space-y-2">
            <div className="skeleton h-12 rounded-xl" />
            <div className="skeleton h-12 rounded-xl" />
          </div>
        ) : logs.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--text-muted)]">No logs found.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log, idx) => (
              <div key={log.id || idx} className="rounded-[14px] border border-[var(--border)] p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white"
                        style={{ background: logTypeColor(log.type) }}
                      >
                        {log.type}
                      </span>
                      <span className="text-xs font-semibold text-[var(--text-primary)]">
                        {log.quantity > 0 && (log.type === "RESTOCK" || log.type === "RETURN" || log.type === "RELEASE")
                          ? `+${log.quantity}`
                          : log.type === "REDUCE" || log.type === "SOLD" || log.type === "HOLD"
                            ? `-${log.quantity}`
                            : log.quantity}
                      </span>
                    </div>
                    {log.note && <p className="mt-1 text-xs text-[var(--text-secondary)] truncate">{log.note}</p>}
                    {log.performedBy && <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">by {log.performedBy}</p>}
                  </div>
                  <span className="shrink-0 text-[11px] text-[var(--text-muted)]">{formatRelativeTime(log.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </BottomSheet>

      {/* Adjust Inventory Sheet — uses backend's operation-based API */}
      <BottomSheet open={Boolean(adjustSheet)} onClose={() => { setAdjustSheet(null); setActionError(null); }} title="Adjust Inventory" snap="full">
        {adjustSheet && (
          <div className="space-y-4">
            {/* Current state summary */}
            <div className="rounded-[14px] bg-[var(--bg-app)] p-3">
              <p className="text-sm font-semibold text-[var(--text-primary)]">{adjustSheet.color} · {adjustSheet.size}</p>
              <p className="text-[11px] text-[var(--text-muted)]">SKU {adjustSheet.sku}</p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-sm font-bold text-[var(--text-primary)]">{adjustSheet.inventory?.quantity || 0}</p>
                  <p className="text-[9px] text-[var(--text-muted)]">Total</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-[var(--success)]">{adjustSheet.inventory?.available ?? Math.max(0, (adjustSheet.inventory?.quantity || 0) - (adjustSheet.inventory?.reserved || 0))}</p>
                  <p className="text-[9px] text-[var(--text-muted)]">Available</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-[var(--warning)]">{adjustSheet.inventory?.reserved || 0}</p>
                  <p className="text-[9px] text-[var(--text-muted)]">Reserved</p>
                </div>
              </div>
            </div>

            {/* Operation picker */}
            <div>
              <label className="form-label">Operation</label>
              <div className="grid grid-cols-3 gap-1.5">
                {operationOptions.map((op) => {
                  const OpIcon = op.icon;
                  const active = adjustDraft.operation === op.value;
                  return (
                    <button
                      key={op.value}
                      type="button"
                      onClick={() => setAdjustDraft((prev) => ({ ...prev, operation: op.value }))}
                      className={`flex flex-col items-center rounded-[14px] border p-2.5 text-center transition-all ${active
                          ? "border-[var(--highlight)] bg-[var(--highlight-soft)]"
                          : "border-[var(--border)] hover:bg-[var(--surface-hover)]"
                        }`}
                    >
                      <OpIcon size={16} style={{ color: active ? op.color : "var(--text-muted)" }} />
                      <span className={`mt-1 text-xs font-semibold ${active ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>{op.label}</span>
                      <span className="text-[9px] text-[var(--text-muted)]">{op.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quantity input */}
            <div>
              <label className="form-label">
                {adjustDraft.operation === "SET" ? "Set quantity to" : "Quantity"}
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustDraft((p) => ({ ...p, quantity: String(Math.max(0, Number(p.quantity || 0) - 1)) }))}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[var(--border)] text-lg transition-colors hover:bg-[var(--surface-hover)]"
                >
                  <Minus size={16} />
                </button>
                <input
                  value={adjustDraft.quantity}
                  onChange={(e) => setAdjustDraft((prev) => ({ ...prev, quantity: e.target.value }))}
                  placeholder={adjustDraft.operation === "SET" ? "New total" : "Amount"}
                  className="form-input flex-1 text-center font-semibold text-lg"
                  type="number"
                  min="0"
                />
                <button
                  type="button"
                  onClick={() => setAdjustDraft((p) => ({ ...p, quantity: String(Number(p.quantity || 0) + 1) }))}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[var(--border)] text-lg transition-colors hover:bg-[var(--surface-hover)]"
                >
                  <Plus size={16} />
                </button>
              </div>

              {/* Preview result */}
              {adjustDraft.quantity && (
                <div className="mt-2 flex items-center gap-2 rounded-xl bg-[var(--bg-app)] p-2 text-xs">
                  <span className="text-[var(--text-secondary)]">Result:</span>
                  <span className="font-semibold text-[var(--text-primary)]">
                    {adjustDraft.operation === "SET" && `Stock → ${adjustDraft.quantity}`}
                    {adjustDraft.operation === "RESTOCK" && `Stock → ${(adjustSheet.inventory?.quantity || 0) + Number(adjustDraft.quantity)}`}
                    {adjustDraft.operation === "REDUCE" && `Stock → ${(adjustSheet.inventory?.quantity || 0) - Number(adjustDraft.quantity)}`}
                    {adjustDraft.operation === "HOLD" && `Reserved → ${(adjustSheet.inventory?.reserved || 0) + Number(adjustDraft.quantity)}`}
                    {adjustDraft.operation === "RELEASE" && `Reserved → ${(adjustSheet.inventory?.reserved || 0) - Number(adjustDraft.quantity)}`}
                    {adjustDraft.operation === "RETURN" && `Stock → ${(adjustSheet.inventory?.quantity || 0) + Number(adjustDraft.quantity)}`}
                  </span>
                </div>
              )}
            </div>

            {/* Note */}
            <div>
              <label className="form-label">Note (optional)</label>
              <input
                value={adjustDraft.note}
                onChange={(e) => setAdjustDraft((prev) => ({ ...prev, note: e.target.value }))}
                placeholder="e.g. Damaged goods, Supplier restock"
                className="form-input"
              />
            </div>

            {/* In-sheet error */}
            {actionError && (
              <div className="error-banner text-xs">
                <AlertCircle size={14} />
                {actionError}
              </div>
            )}

            <button
              type="button"
              disabled={adjustSaving || !adjustDraft.quantity}
              onClick={adjustInventory}
              className="app-button app-button-primary h-11 w-full text-sm disabled:opacity-50"
              style={selectedOp ? { background: selectedOp.color } : undefined}
            >
              {adjustSaving ? "Adjusting..." : `Apply ${selectedOp?.label || ""}`}
            </button>
          </div>
        )}
      </BottomSheet>

      {/* Variant Detail Sheet */}
      <BottomSheet
        open={variantDetailOpen}
        onClose={() => { setVariantDetailOpen(false); setVariantDetail(null); }}
        title="Variant Detail"
        snap="half"
      >
        {variantDetailLoading ? (
          <div className="space-y-2">
            <div className="skeleton h-12 rounded-xl" />
            <div className="skeleton h-12 rounded-xl" />
          </div>
        ) : variantDetail ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[14px] border border-[var(--border)] p-3 text-center">
                <p className="text-[11px] text-[var(--text-secondary)]">Total Stock</p>
                <p className="text-xl font-bold text-[var(--text-primary)]">{variantDetail.quantity ?? variantDetail.inventory?.quantity ?? "—"}</p>
              </div>
              <div className="rounded-[14px] border border-[var(--border)] p-3 text-center">
                <p className="text-[11px] text-[var(--text-secondary)]">Available</p>
                <p className="text-xl font-bold text-[var(--success)]">{variantDetail.available ?? variantDetail.inventory?.available ?? "—"}</p>
              </div>
              <div className="rounded-[14px] border border-[var(--border)] p-3 text-center">
                <p className="text-[11px] text-[var(--text-secondary)]">Reserved</p>
                <p className="text-xl font-bold text-[var(--warning)]">{variantDetail.reserved ?? variantDetail.inventory?.reserved ?? "—"}</p>
              </div>
              <div className="rounded-[14px] border border-[var(--border)] p-3 text-center">
                <p className="text-[11px] text-[var(--text-secondary)]">SKU</p>
                <p className="font-mono text-xs text-[var(--text-primary)]">{variantDetail.sku || variantDetail.variant?.sku || "—"}</p>
              </div>
            </div>
            {variantDetail.product && (
              <div className="rounded-[14px] bg-[var(--bg-app)] p-3">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{variantDetail.product.name}</p>
                <p className="text-xs text-[var(--text-secondary)]">
                  {variantDetail.color || variantDetail.variant?.color} · {variantDetail.size || variantDetail.variant?.size}
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-[var(--text-muted)]">No detail available.</p>
        )}
      </BottomSheet>
    </div>
  );
}
