"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
    Search,
    CreditCard,
    Trash2,
    ChevronDown,
    ChevronUp,
    RefreshCw,
    ScrollText,
    X,
    AlertCircle,
} from "lucide-react";
import BottomSheet from "@/components/ui/bottom-sheet";
import EmptyState from "@/components/ui/empty-state";
import { useEmptyState } from "@/hooks/use-empty-state";
import { apiFetch } from "@/lib/api";
import { formatCurrencyINR, formatRelativeTime, formatDateTime, paymentTone } from "@/lib/format";

const filters = ["ALL", "PENDING", "COMPLETED", "FAILED", "REFUNDED"];

export default function PaymentsPage() {
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState("ALL");
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expanded, setExpanded] = useState(null);
    const [detail, setDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const [logsOpen, setLogsOpen] = useState(false);
    const [logs, setLogs] = useState([]);
    const [logsLoading, setLogsLoading] = useState(false);
    const [logsPaymentId, setLogsPaymentId] = useState(null);

    const [editSheet, setEditSheet] = useState(null);
    const [editDraft, setEditDraft] = useState({ status: "", transactionId: "" });
    const [editSaving, setEditSaving] = useState(false);

    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [actionError, setActionError] = useState(null);

    const activeStatus = status === "ALL" ? undefined : status;

    const loadPayments = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await apiFetch("/admin/payments", {
                params: { status: activeStatus, search: query, take: 50 },
            });
            setPayments(data.payments || []);
        } catch (err) {
            setPayments([]);
            setError(err);
        } finally {
            setLoading(false);
        }
    }, [activeStatus, query]);

    useEffect(() => {
        loadPayments();
    }, [loadPayments]);

    const loadDetail = async (paymentId) => {
        setDetailLoading(true);
        try {
            const data = await apiFetch(`/admin/payments/${paymentId}`);
            setDetail(data);
        } catch {
            setDetail(null);
        } finally {
            setDetailLoading(false);
        }
    };

    const toggleExpand = (paymentId) => {
        if (expanded === paymentId) {
            setExpanded(null);
            setDetail(null);
        } else {
            setExpanded(paymentId);
            loadDetail(paymentId);
        }
    };

    const openLogs = async (paymentId) => {
        setLogsPaymentId(paymentId);
        setLogsOpen(true);
        setLogsLoading(true);
        try {
            const endpoint = paymentId
                ? `/admin/payments/${paymentId}/logs`
                : "/admin/payments/logs";
            const data = await apiFetch(endpoint, { params: { take: 50 } });
            setLogs(data.logs || []);
        } catch {
            setLogs([]);
        } finally {
            setLogsLoading(false);
        }
    };

    const openEdit = (payment) => {
        setEditDraft({ status: payment.status || "", transactionId: payment.transactionId || "" });
        setEditSheet(payment);
    };

    const saveEdit = async () => {
        if (!editSheet) return;
        setEditSaving(true);
        setActionError(null);
        try {
            await apiFetch(`/admin/payments/${editSheet.id}`, {
                method: "PUT",
                body: JSON.stringify(editDraft),
            });
            setEditSheet(null);
            await loadPayments();
        } catch {
            setActionError("Failed to update payment.");
        } finally {
            setEditSaving(false);
        }
    };

    const confirmDelete = async () => {
        if (!deleteConfirm) return;
        setActionError(null);
        try {
            await apiFetch(`/admin/payments/${deleteConfirm.id}`, { method: "DELETE" });
            setDeleteConfirm(null);
            setPayments((current) => current.filter((p) => p.id !== deleteConfirm.id));
        } catch {
            setActionError("Failed to delete payment.");
        }
    };

    const listState = useEmptyState(loading, payments, error);

    const statusLabel = useMemo(() => {
        if (status === "ALL") return "All payments";
        return `${status.toLowerCase()} payments`;
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
                        <p className="page-label">Finance</p>
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
                        placeholder="Search by order or transaction ID"
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
                        title="Failed to load payments"
                        description="Something went wrong. Please try again."
                        icon={RefreshCw}
                        variant="error"
                        action={{ label: "Retry", onClick: loadPayments }}
                    />
                </div>
            ) : listState.showEmpty ? (
                <div className="pt-6">
                    <EmptyState
                        title="No payments found"
                        description={query ? "Try adjusting your search or filters." : "Payment records will appear here once orders are placed."}
                        icon={CreditCard}
                    />
                </div>
            ) : (
                <div className="space-y-2.5">
                    {payments.map((payment) => {
                        const isExpanded = expanded === payment.id;

                        return (
                            <motion.section key={payment.id} layout className="card-surface p-3">
                                <button
                                    type="button"
                                    onClick={() => toggleExpand(payment.id)}
                                    className="flex w-full items-start justify-between text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <span
                                            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                                            style={{ background: `${paymentTone[payment.status] || "#9a9a9a"}14`, color: paymentTone[payment.status] || "#9a9a9a" }}
                                        >
                                            <CreditCard size={16} />
                                        </span>
                                        <div>
                                            <p className="text-sm font-semibold text-[var(--text-primary)]">
                                                {formatCurrencyINR(payment.amount)}
                                            </p>
                                            <p className="text-xs text-[var(--text-secondary)]">
                                                Order #{payment.order?.orderNumber || payment.orderId?.slice(0, 8) || "—"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="text-right">
                                            <span
                                                className="app-chip rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                                                style={{ background: paymentTone[payment.status] || "#9a9a9a" }}
                                            >
                                                {payment.status}
                                            </span>
                                            <p className="mt-1 text-[11px] text-[var(--text-muted)]">{formatRelativeTime(payment.createdAt)}</p>
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
                                                    {detail.payment.gateway ? (
                                                        <div>
                                                        <span className="text-[var(--text-secondary)]">Method</span>
                                                        <p className="font-semibold text-[var(--text-primary)]">Online</p>
                                                    </div>
                                                    ) : (
                                                        <div>
                                                        <span className="text-[var(--text-secondary)]">Method</span>
                                                        <p className="font-semibold text-[var(--text-primary)]">COD</p>
                                                    </div>
                                                    )
                                                    }
                                                    <div>
                                                        <span className="text-[var(--text-secondary)]">Gateway</span>
                                                        <p className="font-semibold text-[var(--text-primary)]">{detail.payment.gateway || "—"}</p>
                                                    </div>
                                                </div>
                                                {detail.payment.gatewayPaymentId && (
                                                    <div>
                                                        <span className="text-[var(--text-secondary)]">Transaction ID</span>
                                                        <p className="font-mono text-xs text-[var(--text-primary)]">{detail.payment.gatewayPaymentId}</p>
                                                    </div>
                                                )}
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <span className="text-[var(--text-secondary)]">Created</span>
                                                        <p className="text-xs text-[var(--text-primary)]">{formatDateTime(detail.payment.createdAt)}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-[var(--text-secondary)]">Updated</span>
                                                        <p className="text-xs text-[var(--text-primary)]">{formatDateTime(detail.payment.updatedAt)}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : null}

                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => openEdit(payment)}
                                                className="app-button app-button-secondary flex-1 py-2 text-xs"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => openLogs(payment.id)}
                                                className="app-button app-button-secondary flex-1 py-2 text-xs"
                                            >
                                                Logs
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setDeleteConfirm(payment)}
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

            {/* Edit Payment Sheet */}
            <BottomSheet open={Boolean(editSheet)} onClose={() => setEditSheet(null)} title="Edit Payment" snap="half">
                <div className="space-y-3">
                    <div>
                        <label className="form-label">Status</label>
                        <select
                            value={editDraft.status}
                            onChange={(e) => setEditDraft((prev) => ({ ...prev, status: e.target.value }))}
                            className="form-input"
                        >
                            {["PENDING", "COMPLETED", "FAILED", "REFUNDED"].map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Transaction ID</label>
                        <input
                            value={editDraft.transactionId}
                            onChange={(e) => setEditDraft((prev) => ({ ...prev, transactionId: e.target.value }))}
                            placeholder="Transaction ID"
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
            <BottomSheet open={Boolean(deleteConfirm)} onClose={() => setDeleteConfirm(null)} title="Delete Payment" snap="half">
                <p className="text-sm text-[var(--text-secondary)]">
                    This will permanently delete this payment record. This action cannot be undone.
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
                onClose={() => { setLogsOpen(false); setLogs([]); setLogsPaymentId(null); }}
                title={logsPaymentId ? "Payment Logs" : "All Payment Logs"}
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
