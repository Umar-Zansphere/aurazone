"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  MapPin,
  PackageCheck,
  PackageSearch,
  Truck,
  X,
  Trash2,
  ScrollText,
  Plus,
} from "lucide-react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import BottomSheet from "@/components/ui/bottom-sheet";
import EmptyState from "@/components/ui/empty-state";
import { apiFetch } from "@/lib/api";
import { formatCurrencyINR, formatRelativeTime, formatDateTime, statusTone, shipmentTone, paymentTone } from "@/lib/format";

const statusSteps = [
  { key: "PENDING", label: "Placed", icon: Clock },
  { key: "PAID", label: "Paid", icon: CreditCard },
  { key: "SHIPPED", label: "Shipped", icon: Truck },
  { key: "DELIVERED", label: "Delivered", icon: CheckCircle2 },
];

export default function OrderDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Shipment creation
  const [shipmentSheet, setShipmentSheet] = useState(false);
  const [shipmentDraft, setShipmentDraft] = useState({ courierName: "", trackingNumber: "", trackingUrl: "" });

  // Activity logs
  const [logsOpen, setLogsOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Payment status update
  const [paymentStatusSheet, setPaymentStatusSheet] = useState(false);
  const [paymentStatusDraft, setPaymentStatusDraft] = useState("");

  // Create payment
  const [createPaymentSheet, setCreatePaymentSheet] = useState(false);
  const [paymentDraft, setPaymentDraft] = useState({ method: "RAZORPAY", amount: "", transactionId: "" });
  const [paymentSaving, setPaymentSaving] = useState(false);

  // Create shipment for order
  const [createShipmentSheet, setCreateShipmentSheet] = useState(false);
  const [newShipmentDraft, setNewShipmentDraft] = useState({ 
    courierName: "", 
    trackingNumber: "", 
    trackingUrl: "",
    status: "PENDING",
    note: "",
    shippedAt: ""
  });
  const [shipmentSaving, setShipmentSaving] = useState(false);

  // Delete order
  const [deleteSheet, setDeleteSheet] = useState(false);

  const loadOrder = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(`/admin/orders/${id}`);
      setOrder(data);
    } catch (err) {
      setOrder(null);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const updateOrderStatus = async (status) => {
    setActionError(null);
    try {
      const data = await apiFetch(`/admin/orders/${order.id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      setOrder(data.order || { ...order, status });
    } catch {
      setActionError("Failed to update order status.");
    }
  };

  const addShipment = async () => {
    setActionError(null);
    try {
      await apiFetch(`/admin/orders/${order.id}/shipment`, {
        method: "PUT",
        body: JSON.stringify(shipmentDraft),
      });
      setShipmentSheet(false);
      setShipmentDraft({ provider: "", trackingNumber: "", trackingUrl: "" });
      await loadOrder();
    } catch {
      setActionError("Failed to create shipment.");
    }
  };

  const cancelOrder = async () => {
    await updateOrderStatus("CANCELLED");
  };

  // Activity logs
  const loadLogs = async () => {
    setLogsOpen(true);
    setLogsLoading(true);
    try {
      const data = await apiFetch(`/admin/orders/${order.id}/logs`, { params: { take: 50 } });
      setLogs(data.logs || []);
    } catch {
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  // Update payment status
  const updatePaymentStatus = async () => {
    if (!paymentStatusDraft) return;
    setActionError(null);
    try {
      await apiFetch(`/admin/orders/${order.id}/payment-status`, {
        method: "PUT",
        body: JSON.stringify({ paymentStatus: paymentStatusDraft }),
      });
      setPaymentStatusSheet(false);
      await loadOrder();
    } catch {
      setActionError("Failed to update payment status.");
    }
  };

  // Create payment for order
  const createPayment = async () => {
    setPaymentSaving(true);
    setActionError(null);
    try {
      await apiFetch(`/admin/orders/${order.id}/payments`, {
        method: "POST",
        body: JSON.stringify({
          method: paymentDraft.method,
          amount: Number(paymentDraft.amount),
          transactionId: paymentDraft.transactionId || undefined,
        }),
      });
      setCreatePaymentSheet(false);
      setPaymentDraft({ method: "RAZORPAY", amount: "", transactionId: "" });
      await loadOrder();
    } catch {
      setActionError("Failed to create payment.");
    } finally {
      setPaymentSaving(false);
    }
  };

  // Create shipment for order (standalone)
  const createShipmentForOrder = async () => {
    setShipmentSaving(true);
    setActionError(null);
    try {
      await apiFetch(`/admin/orders/${order.id}/shipments`, {
        method: "POST",
        body: JSON.stringify(newShipmentDraft),
      });
      setCreateShipmentSheet(false);
      setNewShipmentDraft({ provider: "", trackingNumber: "", trackingUrl: "" });
      await loadOrder();
    } catch {
      setActionError("Failed to create shipment.");
    } finally {
      setShipmentSaving(false);
    }
  };

  // Delete order
  const deleteOrder = async () => {
    setActionError(null);
    try {
      await apiFetch(`/admin/orders/${order.id}`, { method: "DELETE" });
      router.replace("/orders");
    } catch {
      setActionError("Failed to delete order.");
      setDeleteSheet(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="skeleton h-12 rounded-[18px]" />
        <div className="skeleton h-48 rounded-[18px]" />
        <div className="skeleton h-48 rounded-[18px]" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="pt-6">
        <EmptyState
          title="Order not found"
          description="This order could not be loaded."
          icon={AlertCircle}
          variant="error"
          action={{ label: "Back to Orders", onClick: () => router.replace("/orders") }}
        />
      </div>
    );
  }

  const readyForShipping = order.status === "PAID" && !order.shipment;
  const readyForDelivery = order.status === "SHIPPED";
  const isCancelled = order.status === "CANCELLED";
  const currentStepIndex = statusSteps.findIndex((step) => step.key === order.status);

  return (
    <div className="space-y-3 pb-10">
      {actionError && (
        <div className="error-banner">
          <AlertCircle size={16} />
          {actionError}
          <button type="button" onClick={() => setActionError(null)} className="ml-auto text-xs underline">Dismiss</button>
        </div>
      )}

      <header className="sticky top-0 z-20 bg-[var(--bg-app)]/95 pb-2 pt-1 backdrop-blur">
        <div className="card-surface flex items-center justify-between p-2.5">
          <button
            type="button"
            onClick={() => router.back()}
            className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--border)] transition-colors hover:bg-[var(--surface-hover)]"
          >
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-sm font-semibold text-[var(--text-primary)]">Order #{order.orderNumber}</h1>
          <span
            className="app-chip rounded-full px-2.5 py-1 text-[10px] font-semibold text-white"
            style={{ background: statusTone[order.status] || "#9a9a9a" }}
          >
            {order.status}
          </span>
        </div>
      </header>

      <section className="card-surface p-4">
        <p className="section-title mb-3">Status Timeline</p>
        <div className="flex items-start justify-between">
          {statusSteps.map((step, idx) => {
            const Icon = step.icon;
            const done = currentStepIndex >= idx && !isCancelled;
            const current = currentStepIndex === idx;

            return (
              <div key={step.key} className="flex flex-1 flex-col items-center text-center">
                <motion.div
                  animate={{ scale: current ? 1.1 : 1 }}
                  className={`relative z-10 grid h-10 w-10 place-items-center rounded-full px-0 py-0 ${done
                    ? "bg-[var(--accent)] text-white"
                    : "border border-[var(--border)] bg-white text-[var(--text-muted)]"
                    }`}
                >
                  <Icon size={16} />
                </motion.div>
                <span className={`mt-1 text-[11px] font-medium ${done ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {isCancelled ? (
          <div className="mt-3 rounded-xl bg-[color:rgba(155,44,44,0.06)] p-2 text-center text-sm font-semibold text-[var(--error)]">
            <X size={14} className="inline" /> Order Cancelled
          </div>
        ) : null}
      </section>

      <section className="card-surface p-4">
        <p className="section-title mb-3">Customer</p>
        <div className="flex items-center gap-3 rounded-[14px] border border-[var(--border)] p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--highlight-soft)]">
            <span className="text-xs font-bold text-[var(--highlight)]">
              {(
                order.customer?.fullName ||
                order.orderAddress?.name ||
                "C"
              )[0]}
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {order.customer?.fullName || order.orderAddress?.name || "N/A"}
            </p>
            <p className="text-xs text-[var(--text-secondary)]">
              {order.customer?.email || order.orderAddress?.email || "N/A"}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              {order.customer?.phone || order.orderAddress?.phone || ""}
            </p>
          </div>
        </div>
      </section>

      <section className="card-surface p-4">
        <p className="section-title mb-3">Items</p>
        <div className="space-y-2">
          {(order.items || []).map((item, idx) => (
            <div key={item.id || idx} className="flex items-center gap-3 rounded-[14px] border border-[var(--border)] p-2.5">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[var(--bg-app)]">
                {item.imageUrl ? (
                  <Image src={item.imageUrl} alt={item.productName} fill className="object-cover" unoptimized />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-lg">👟</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{item.productName}</p>
                <p className="text-[11px] text-[var(--text-secondary)]">{item.color} / {item.size} · qty {item.quantity}</p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-[var(--text-primary)]">
                {formatCurrencyINR(item.price * item.quantity)}
              </span>
            </div>
          ))}
        </div>

        <hr className="section-divider my-3" />

        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--text-secondary)]">Total</span>
          <span className="text-base font-bold text-[var(--text-primary)]">{formatCurrencyINR(order.totalAmount)}</span>
        </div>
      </section>

      {order.orderAddress ? (
        <section className="card-surface p-4">
          <p className="section-title mb-3">
            <MapPin size={12} className="inline" /> Delivery Address
          </p>
          <div className="text-sm text-[var(--text-primary)]">
            <p className="font-semibold">{order.orderAddress.name}</p>
            <p className="text-[var(--text-secondary)]">{order.orderAddress.addressLine1}</p>
            {order.orderAddress.addressLine2 ? <p className="text-[var(--text-secondary)]">{order.orderAddress.addressLine2}</p> : null}
            <p className="text-[var(--text-secondary)]">
              {order.orderAddress.city}, {order.orderAddress.state} {order.orderAddress.postalCode}
            </p>
            <p className="text-[var(--text-secondary)]">{order.orderAddress.country}</p>
            <p className="text-[var(--text-secondary)]">Phone: {order.orderAddress.phone}</p>
          </div>
        </section>
      ) : null}

      {order.payment ? (
        <section className="card-surface p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="section-title">Payment</p>
            <button
              type="button"
              onClick={() => { setPaymentStatusDraft(order.payment.status || "PENDING"); setPaymentStatusSheet(true); }}
              className="text-xs font-semibold text-[var(--highlight)]"
            >
              Update Status
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-[var(--text-secondary)]">Method</span>
              <p className="font-semibold text-[var(--text-primary)]">{order.paymentMethod}</p>
            </div>
            <div>
              <span className="text-[var(--text-secondary)]">Status</span>
              <p className="font-semibold" style={{ color: order.payment.status === "PAID" ? "var(--success)" : "var(--warning)" }}>
                {order.payment.status}
              </p>
            </div>
            {order.payment.transactionId ? (
              <div className="col-span-2">
                <span className="text-[var(--text-secondary)]">Transaction</span>
                <p className="font-mono text-xs text-[var(--text-primary)]">{order.payment.transactionId}</p>
              </div>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="card-surface p-4">
          <div className="flex items-center justify-between">
            <p className="section-title">Payment</p>
            <button
              type="button"
              onClick={() => { setPaymentDraft({ method: "RAZORPAY", amount: String(order.totalAmount || ""), transactionId: "" }); setCreatePaymentSheet(true); }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--highlight)]"
            >
              <Plus size={12} /> Add Payment
            </button>
          </div>
          <p className="mt-2 text-sm text-[var(--text-muted)]">No payment recorded yet.</p>
        </section>
      )}

      {order.shipment ? (
        <section className="card-surface p-4">
          <p className="section-title mb-3">
            <Truck size={12} className="inline" /> Shipment
          </p>
          <div className="space-y-1 text-sm">
            <p className="text-[var(--text-primary)]">
              <span className="text-[var(--text-secondary)]">Provider:</span>{" "}
              <span className="font-semibold">{order.shipment.provider}</span>
            </p>
            <p className="text-[var(--text-primary)]">
              <span className="text-[var(--text-secondary)]">Tracking:</span>{" "}
              <span className="font-mono text-xs">{order.shipment.trackingNumber}</span>
            </p>
            <p>
              <span
                className="app-chip rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                style={{ background: shipmentTone[order.shipment.status] || "#9a9a9a" }}
              >
                {order.shipment.status}
              </span>
            </p>
          </div>
        </section>
      ) : null}

      {/* Quick Actions */}
      <section className="card-surface p-4">
        <p className="section-title mb-3">Quick Actions</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={loadLogs}
            className="app-button app-button-secondary flex items-center justify-center gap-2 py-2.5 text-xs"
          >
            <ScrollText size={14} /> Activity Logs
          </button>
          <button
            type="button"
            onClick={() => setCreateShipmentSheet(true)}
            className="app-button app-button-secondary flex items-center justify-center gap-2 py-2.5 text-xs"
          >
            <Truck size={14} /> Add Shipment
          </button>
          <button
            type="button"
            onClick={() => { setPaymentDraft({ method: "RAZORPAY", amount: String(order.totalAmount || ""), transactionId: "" }); setCreatePaymentSheet(true); }}
            className="app-button app-button-secondary flex items-center justify-center gap-2 py-2.5 text-xs"
          >
            <CreditCard size={14} /> Add Payment
          </button>
          <button
            type="button"
            onClick={() => setDeleteSheet(true)}
            className="app-button app-button-danger flex items-center justify-center gap-2 py-2.5 text-xs"
          >
            <Trash2 size={14} /> Delete Order
          </button>
        </div>
      </section>

      <section className="card-surface p-4">
        <p className="section-title mb-3">Meta</p>
        <div className="grid grid-cols-2 gap-2 text-xs text-[var(--text-secondary)]">
          <span>Created</span>
          <span className="text-right">{formatRelativeTime(order.createdAt)}</span>
          <span>Updated</span>
          <span className="text-right">{formatRelativeTime(order.updatedAt)}</span>
        </div>
      </section>

      {!isCancelled ? (
        <footer className="sticky bottom-0 z-20 bg-[var(--bg-app)]/95 pb-3 pt-2 backdrop-blur">
          <div className="flex gap-2">
            {readyForShipping ? (
              <button
                type="button"
                onClick={() => setShipmentSheet(true)}
                className="app-button app-button-primary flex h-11 flex-1 items-center justify-center gap-2 text-sm"
              >
                <PackageCheck size={15} /> Add Shipment
              </button>
            ) : readyForDelivery ? (
              <button
                type="button"
                onClick={() => updateOrderStatus("DELIVERED")}
                className="app-button flex h-11 flex-1 items-center justify-center gap-2 rounded-[14px] bg-[var(--success)] text-sm font-semibold text-white"
              >
                <CheckCircle2 size={15} /> Mark Delivered
              </button>
            ) : order.status === "PENDING" ? (
              <button
                type="button"
                onClick={() => updateOrderStatus("PAID")}
                className="app-button app-button-primary flex h-11 flex-1 items-center justify-center gap-2 text-sm"
              >
                <CreditCard size={15} /> Mark Paid
              </button>
            ) : null}

            <button
              type="button"
              onClick={cancelOrder}
              className="app-button app-button-danger flex h-11 items-center justify-center gap-2 px-4 text-sm"
            >
              <X size={15} /> Cancel
            </button>
          </div>
        </footer>
      ) : null}

      {/* Shipment Sheet (existing pattern) */}
      <BottomSheet open={shipmentSheet} onClose={() => setShipmentSheet(false)} title="Shipment Details" snap="half">
        <div className="space-y-3">
          <div>
            <label className="form-label">Courier Name</label>
            <input
              value={shipmentDraft.courierName}
              onChange={(event) => setShipmentDraft((prev) => ({ ...prev, courierName: event.target.value }))}
              placeholder="e.g. Delhivery"
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Tracking Number</label>
            <input
              value={shipmentDraft.trackingNumber}
              onChange={(event) => setShipmentDraft((prev) => ({ ...prev, trackingNumber: event.target.value }))}
              placeholder="Tracking ID"
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Tracking URL (optional)</label>
            <input
              value={shipmentDraft.trackingUrl}
              onChange={(event) => setShipmentDraft((prev) => ({ ...prev, trackingUrl: event.target.value }))}
              placeholder="https://track.delhivery.com/..."
              className="form-input"
            />
          </div>
          <button
            type="button"
            onClick={addShipment}
            className="app-button app-button-primary h-11 w-full text-sm"
          >
            Create Shipment & Mark Shipped
          </button>
        </div>
      </BottomSheet>

      {/* Activity Logs Sheet */}
      <BottomSheet
        open={logsOpen}
        onClose={() => { setLogsOpen(false); setLogs([]); }}
        title="Activity Logs"
        snap="full"
      >
        {logsLoading ? (
          <div className="space-y-2">
            <div className="skeleton h-12 rounded-xl" />
            <div className="skeleton h-12 rounded-xl" />
          </div>
        ) : logs.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--text-muted)]">No activity logs found.</p>
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

      {/* Payment Status Sheet */}
      <BottomSheet open={paymentStatusSheet} onClose={() => setPaymentStatusSheet(false)} title="Update Payment Status" snap="half">
        <div className="space-y-3">
          <div>
            <label className="form-label">Payment Status</label>
            <select
              value={paymentStatusDraft}
              onChange={(e) => setPaymentStatusDraft(e.target.value)}
              className="form-input"
            >
              {["PENDING", "PAID", "FAILED", "REFUNDED"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={updatePaymentStatus}
            className="app-button app-button-primary h-11 w-full text-sm"
          >
            Update Status
          </button>
        </div>
      </BottomSheet>

      {/* Create Payment Sheet */}
      <BottomSheet open={createPaymentSheet} onClose={() => setCreatePaymentSheet(false)} title="Create Payment" snap="half">
        <div className="space-y-3">
          <div>
            <label className="form-label">Method</label>
            <select
              value={paymentDraft.method}
              onChange={(e) => setPaymentDraft((prev) => ({ ...prev, method: e.target.value }))}
              className="form-input"
            >
              {["RAZORPAY", "COD"].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Amount</label>
            <input
              value={paymentDraft.amount}
              onChange={(e) => setPaymentDraft((prev) => ({ ...prev, amount: e.target.value }))}
              placeholder="Amount"
              className="form-input"
              type="number"
            />
          </div>
          <div>
            <label className="form-label">Transaction ID (optional)</label>
            <input
              value={paymentDraft.transactionId}
              onChange={(e) => setPaymentDraft((prev) => ({ ...prev, transactionId: e.target.value }))}
              placeholder="Transaction ID"
              className="form-input"
            />
          </div>
          <button
            type="button"
            disabled={paymentSaving}
            onClick={createPayment}
            className="app-button app-button-primary h-11 w-full text-sm disabled:opacity-50"
          >
            {paymentSaving ? "Creating..." : "Create Payment"}
          </button>
        </div>
      </BottomSheet>

      {/* Create Shipment Sheet */}
      <BottomSheet open={createShipmentSheet} onClose={() => setCreateShipmentSheet(false)} title="Create Shipment" snap="half">
        <div className="space-y-3">
          <div>
            <label className="form-label">Courier Name</label>
            <input
              value={newShipmentDraft.courierName}
              onChange={(e) => setNewShipmentDraft((prev) => ({ ...prev, courierName: e.target.value }))}
              placeholder="e.g. Delhivery, FedEx, DPL"
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Tracking Number</label>
            <input
              value={newShipmentDraft.trackingNumber}
              onChange={(e) => setNewShipmentDraft((prev) => ({ ...prev, trackingNumber: e.target.value }))}
              placeholder="Tracking ID"
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Tracking URL (optional)</label>
            <input
              value={newShipmentDraft.trackingUrl}
              onChange={(e) => setNewShipmentDraft((prev) => ({ ...prev, trackingUrl: e.target.value }))}
              placeholder="https://track.delhivery.com/..."
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Status</label>
            <select
              value={newShipmentDraft.status}
              onChange={(e) => setNewShipmentDraft((prev) => ({ ...prev, status: e.target.value }))}
              className="form-input"
            >
              <option value="PENDING">Pending</option>
              <option value="SHIPPED">Shipped</option>
              <option value="DELIVERED">Delivered</option>
              <option value="RETURNED">Returned</option>
              <option value="LOST">Lost</option>
            </select>
          </div>
          <div>
            <label className="form-label">Shipped At (optional)</label>
            <input
              type="datetime-local"
              value={newShipmentDraft.shippedAt}
              onChange={(e) => setNewShipmentDraft((prev) => ({ ...prev, shippedAt: e.target.value }))}
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Note (optional)</label>
            <textarea
              value={newShipmentDraft.note}
              onChange={(e) => setNewShipmentDraft((prev) => ({ ...prev, note: e.target.value }))}
              placeholder="Add any notes about this shipment"
              className="form-input"
              rows="3"
            />
          </div>
          <button
            type="button"
            disabled={shipmentSaving}
            onClick={createShipmentForOrder}
            className="app-button app-button-primary h-11 w-full text-sm disabled:opacity-50"
          >
            {shipmentSaving ? "Creating..." : "Create Shipment"}
          </button>
        </div>
      </BottomSheet>

      {/* Delete Order Sheet */}
      <BottomSheet open={deleteSheet} onClose={() => setDeleteSheet(false)} title="Delete Order" snap="half">
        <p className="text-sm text-[var(--text-secondary)]">
          This will permanently delete order #{order.orderNumber}. This action cannot be undone.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setDeleteSheet(false)}
            className="app-button app-button-secondary h-11 flex-1 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={deleteOrder}
            className="app-button h-11 flex-1 rounded-[14px] bg-[var(--error)] text-sm font-semibold text-white"
          >
            Delete Order
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
