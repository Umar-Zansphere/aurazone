"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
    Search,
    Truck,
    Trash2,
    ChevronDown,
    ChevronUp,
    RefreshCw,
    ScrollText,
    AlertCircle,
} from "lucide-react";
import BottomSheet from "@/components/ui/bottom-sheet";
import EmptyState from "@/components/ui/empty-state";
import { useEmptyState } from "@/hooks/use-empty-state";
import { apiFetch } from "@/lib/api";
import { formatRelativeTime, formatDateTime, shipmentTone } from "@/lib/format";

const filters = ["ALL", "PENDING", "SHIPPED", "DELIVERED", "RETURNED", "LOST"];

export default function ShipmentsPage() {
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState("ALL");
    const [shipments, setShipments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expanded, setExpanded] = useState(null);
    const [detail, setDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const [logsOpen, setLogsOpen] = useState(false);
    const [logs, setLogs] = useState([]);
    const [logsLoading, setLogsLoading] = useState(false);
    const [logsShipmentId, setLogsShipmentId] = useState(null);

    const [editSheet, setEditSheet] = useState(null);
    const [editDraft, setEditDraft] = useState({ status: "", trackingNumber: "", trackingUrl: "", provider: "" });
    const [editSaving, setEditSaving] = useState(false);

    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [actionError, setActionError] = useState(null);

    const activeStatus = status === "ALL" ? undefined : status;

    const loadShipments = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await apiFetch("/admin/shipments", {
                params: { status: activeStatus, search: query, take: 50 },
            });
            setShipments(data.shipments || []);
        } catch (err) {
            setShipments([]);
            setError(err);
        } finally {
            setLoading(false);
        }
    }, [activeStatus, query]);

    useEffect(() => {
        loadShipments();
    }, [loadShipments]);

    const loadDetail = async (shipmentId) => {
        setDetailLoading(true);
        try {
            const data = await apiFetch(`/admin/shipments/${shipmentId}`);
            setDetail(data);
            console.log("Loaded shipment detail:", data);
        } catch {
            setDetail(null);
        } finally {
            setDetailLoading(false);
        }
    };

    const toggleExpand = (shipmentId) => {
        if (expanded === shipmentId) {
            setExpanded(null);
            setDetail(null);
        } else {
            setExpanded(shipmentId);
            loadDetail(shipmentId);
        }
    };

    const openLogs = async (shipmentId) => {
        setLogsShipmentId(shipmentId);
        setLogsOpen(true);
        setLogsLoading(true);
        try {
            const endpoint = shipmentId
                ? `/admin/shipments/${shipmentId}/logs`
                : "/admin/shipments/logs";
            const data = await apiFetch(endpoint, { params: { take: 50 } });
            setLogs(data.logs || []);
        } catch {
            setLogs([]);
        } finally {
            setLogsLoading(false);
        }
    };

    const openEdit = (shipment) => {
        setEditDraft({
            status: shipment.status || "",
            trackingNumber: shipment.trackingNumber || "",
            trackingUrl: shipment.trackingUrl || "",
            provider: shipment.courierName || shipment.provider || "",
        });
        setEditSheet(shipment);
    };

    const saveEdit = async () => {
        if (!editSheet) return;
        setEditSaving(true);
        setActionError(null);
        try {
            await apiFetch(`/admin/shipments/${editSheet.id}`, {
                method: "PUT",
                body: JSON.stringify(editDraft),
            });
            setEditSheet(null);
            await loadShipments();
        } catch {
            setActionError("Failed to update shipment.");
        } finally {
            setEditSaving(false);
        }
    };

    const confirmDelete = async () => {
        if (!deleteConfirm) return;
        setActionError(null);
        try {
            await apiFetch(`/admin/shipments/${deleteConfirm.id}`, { method: "DELETE" });
            setDeleteConfirm(null);
            setShipments((current) => current.filter((s) => s.id !== deleteConfirm.id));
        } catch {
            setActionError("Failed to delete shipment.");
        }
    };

    const listState = useEmptyState(loading, shipments, error);

    const statusLabel = useMemo(() => {
        if (status === "ALL") return "All shipments";
        return `${status.toLowerCase()} shipments`;
    }, [status]);

    return (
        <div className="space-y-3 pb-6">
            {actionError && (
                <div className="error-banner">
                    <AlertCircle size={16} />
                    {actionError}
                    <button type="button" onClick={() => setActionError(null)} className="ml-auto text-xs underline">Dismiss</button>
                </div>
            )}

            <header>
                <div className="flex items-end justify-between">
                    <div>
                        <p className="page-label">Logistics</p>
                        <h1 className="page-title">{statusLabel}</h1>
                    </div>
                    <button
                        type="button"
                        onClick={() => openLogs(null)}
                        className="app-button app-button-secondary flex items-center gap-1.5 px-3 py-2 text-xs"
                    >
                        <ScrollText size={14} /> All Logs
                    </button>
                </div>

                <div className="mt-3 flex h-11 items-center rounded-[14px] border border-[var(--border)] bg-white px-3 transition-all focus-within:border-[var(--highlight)] focus-within:ring-2 focus-within:ring-[var(--highlight-soft)]">
                    <Search size={15} className="text-[var(--text-muted)]" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search by tracking number or provider"
                        className="ml-2 w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
                    />
                </div>

                <div className="mt-2 flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                    {filters.map((f) => (
                        <button
                            key={f}
                            type="button"
                            onClick={() => setStatus(f)}
                            className={`app-chip whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${f === status
                                    ? "bg-[var(--accent)] text-white"
                                    : "bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)]"
                                }`}
                        >
                            {f === "ALL" ? "All" : f}
                        </button>
                    ))}
                </div>
            </header>

            {listState.isLoading ? (
                <div className="space-y-2">
                    <div className="skeleton h-20 rounded-[18px]" />
                    <div className="skeleton h-20 rounded-[18px]" />
                    <div className="skeleton h-20 rounded-[18px]" />
                </div>
            ) : listState.showError ? (
                <div className="pt-6">
                    <EmptyState
                        title="Failed to load shipments"
                        description="Something went wrong. Please try again."
                        icon={RefreshCw}
                        variant="error"
                        action={{ label: "Retry", onClick: loadShipments }}
                    />
                </div>
            ) : listState.showEmpty ? (
                <div className="pt-6">
                    <EmptyState
                        title="No shipments found"
                        description={query ? "Try adjusting your search or filters." : "Shipment records will appear here once orders are shipped."}
                        icon={Truck}
                    />
                </div>
            ) : (
                <div className="space-y-2.5">
                    {shipments.map((shipment) => {
                        const isExpanded = expanded === shipment.id;

                        return (
                            <motion.section key={shipment.id} layout className="card-surface p-3">
                                <button
                                    type="button"
                                    onClick={() => toggleExpand(shipment.id)}
                                    className="flex w-full items-start justify-between text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <span
                                            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                                            style={{ background: `${shipmentTone[shipment.status] || "#9a9a9a"}14`, color: shipmentTone[shipment.status] || "#9a9a9a" }}
                                        >
                                            <Truck size={16} />
                                        </span>
                                        <div>
                                            <p className="text-sm font-semibold text-[var(--text-primary)]">
                                                {shipment.courierName || shipment.provider || "Shipment"}
                                            </p>
                                            <p className="font-mono text-xs text-[var(--text-secondary)]">
                                                {shipment.trackingNumber || "—"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="text-right">
                                            <span
                                                className="app-chip rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                                                style={{ background: shipmentTone[shipment.status] || "#9a9a9a" }}
                                            >
                                                {shipment.status}
                                            </span>
                                            <p className="mt-1 text-[11px] text-[var(--text-muted)]">{formatRelativeTime(shipment.createdAt)}</p>
                                        </div>
                                        {isExpanded ? <ChevronUp size={14} className="text-[var(--text-muted)]" /> : <ChevronDown size={14} className="text-[var(--text-muted)]" />}
                                    </div>
                                </button>

                                {isExpanded && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 space-y-3 border-t border-[var(--border)] pt-3">
                                        {detailLoading ? (
                                            <div className="skeleton h-20 rounded-xl" />
                                        ) : detail ? (
                                            <div className="space-y-2 text-sm">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <span className="text-[var(--text-secondary)]">Courier</span>
                                                        <p className="font-semibold text-[var(--text-primary)]">{detail.shipment.courierName || detail.provider || "—"}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-[var(--text-secondary)]">Order</span>
                                                        <p className="font-semibold text-[var(--text-primary)]">
                                                            #{detail.shipment.order?.orderNumber || detail.shipment.orderId?.slice(0, 8) || "—"}
                                                        </p>
                                                    </div>
                                                </div>
                                                {detail.shipment.trackingNumber && (
                                                    <div>
                                                        <span className="text-[var(--text-secondary)]">Tracking Number</span>
                                                        <span className="block font-mono text-xs text-[var(--text-primary)]">{detail.shipment.trackingNumber}</span>
                                                    </div>
                                                )}
                                                {detail.shipment.trackingUrl && (
                                                    <div>
                                                        <span className="text-[var(--text-secondary)]">Tracking URL</span>
                                                        <a href={detail.trackingUrl} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-[var(--highlight)] underline">
                                                            {detail.shipment.trackingUrl}
                                                        </a>
                                                    </div>
                                                )}
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <span className="text-[var(--text-secondary)]">Created</span>
                                                        <p className="text-xs text-[var(--text-primary)]">{formatDateTime(detail.shipment.createdAt)}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-[var(--text-secondary)]">Updated</span>
                                                        <p className="text-xs text-[var(--text-primary)]">{formatDateTime(detail.shipment.updatedAt)}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : null}

                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => openEdit(shipment)}
                                                className="app-button app-button-secondary flex-1 py-2 text-xs"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => openLogs(shipment.id)}
                                                className="app-button app-button-secondary flex-1 py-2 text-xs"
                                            >
                                                Logs
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setDeleteConfirm(shipment)}
                                                className="app-button app-button-danger flex items-center justify-center gap-1 px-3 py-2 text-xs"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </motion.section>
                        );
                    })}
                </div>
            )}

            {/* Edit Shipment Sheet */}
            <BottomSheet open={Boolean(editSheet)} onClose={() => setEditSheet(null)} title="Edit Shipment" snap="half">
                <div className="space-y-3">
                    <div>
                        <label className="form-label">Status</label>
                        <select
                            value={editDraft.status}
                            onChange={(e) => setEditDraft((prev) => ({ ...prev, status: e.target.value }))}
                            className="form-input"
                        >
                            {["PENDING", "SHIPPED", "DELIVERED", "RETURNED", "LOST"].map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Provider</label>
                        <input
                            value={editDraft.provider}
                            onChange={(e) => setEditDraft((prev) => ({ ...prev, provider: e.target.value }))}
                            placeholder="e.g. Delhivery"
                            className="form-input"
                        />
                    </div>
                    <div>
                        <label className="form-label">Tracking Number</label>
                        <input
                            value={editDraft.trackingNumber}
                            onChange={(e) => setEditDraft((prev) => ({ ...prev, trackingNumber: e.target.value }))}
                            placeholder="Tracking ID"
                            className="form-input"
                        />
                    </div>
                    <div>
                        <label className="form-label">Tracking URL</label>
                        <input
                            value={editDraft.trackingUrl}
                            onChange={(e) => setEditDraft((prev) => ({ ...prev, trackingUrl: e.target.value }))}
                            placeholder="https://..."
                            className="form-input"
                        />
                    </div>
                    <button
                        type="button"
                        disabled={editSaving}
                        onClick={saveEdit}
                        className="app-button app-button-primary h-11 w-full text-sm disabled:opacity-50"
                    >
                        {editSaving ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </BottomSheet>

            {/* Delete Confirmation Sheet */}
            <BottomSheet open={Boolean(deleteConfirm)} onClose={() => setDeleteConfirm(null)} title="Delete Shipment" snap="half">
                <p className="text-sm text-[var(--text-secondary)]">
                    This will permanently delete this shipment record. This action cannot be undone.
                </p>
                <div className="mt-4 flex gap-2">
                    <button
                        type="button"
                        onClick={() => setDeleteConfirm(null)}
                        className="app-button app-button-secondary h-11 flex-1 text-sm"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={confirmDelete}
                        className="app-button h-11 flex-1 rounded-[14px] bg-[var(--error)] text-sm font-semibold text-white"
                    >
                        Delete
                    </button>
                </div>
            </BottomSheet>

            {/* Logs Sheet */}
            <BottomSheet
                open={logsOpen}
                onClose={() => { setLogsOpen(false); setLogs([]); setLogsShipmentId(null); }}
                title={logsShipmentId ? "Shipment Logs" : "All Shipment Logs"}
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
                                    <div>
                                        <p className="text-sm font-medium text-[var(--text-primary)]">{log.action || log.event || log.type || "Event"}</p>
                                        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{log.details || log.message || log.description || ""}</p>
                                    </div>
                                    <span className="shrink-0 text-[11px] text-[var(--text-muted)]">{formatRelativeTime(log.createdAt)}</span>
                                </div>
                                {log.performedBy && (
                                    <p className="mt-1 text-[11px] text-[var(--text-muted)]">by {log.performedBy}</p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </BottomSheet>
        </div>
    );
}
