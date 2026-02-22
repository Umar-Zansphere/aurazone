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
} from "lucide-react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import BottomSheet from "@/components/ui/bottom-sheet";
import EmptyState from "@/components/ui/empty-state";
import { apiFetch } from "@/lib/api";
import { formatCurrencyINR, formatRelativeTime, statusTone, shipmentTone } from "@/lib/format";

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
  const [shipmentSheet, setShipmentSheet] = useState(false);
  const [shipmentDraft, setShipmentDraft] = useState({ provider: "", trackingNumber: "", trackingUrl: "" });

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
        method: "POST",
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
              {(order.customer?.fullName || "C")[0]}
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{order.customer?.fullName || "N/A"}</p>
            <p className="text-xs text-[var(--text-secondary)]">{order.customer?.email || "N/A"}</p>
            <p className="text-xs text-[var(--text-muted)]">{order.customer?.phone || ""}</p>
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

      {order.address ? (
        <section className="card-surface p-4">
          <p className="section-title mb-3">
            <MapPin size={12} className="inline" /> Delivery Address
          </p>
          <div className="text-sm text-[var(--text-primary)]">
            <p className="font-semibold">{order.address.fullName}</p>
            <p className="text-[var(--text-secondary)]">{order.address.line1}</p>
            {order.address.line2 ? <p className="text-[var(--text-secondary)]">{order.address.line2}</p> : null}
            <p className="text-[var(--text-secondary)]">
              {order.address.city}, {order.address.state} {order.address.zip}
            </p>
          </div>
        </section>
      ) : null}

      {order.payment ? (
        <section className="card-surface p-4">
          <p className="section-title mb-3">Payment</p>
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
      ) : null}

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

      <BottomSheet open={shipmentSheet} onClose={() => setShipmentSheet(false)} title="Shipment Details" snap="half">
        <div className="space-y-3">
          <div>
            <label className="form-label">Provider</label>
            <input
              value={shipmentDraft.provider}
              onChange={(event) => setShipmentDraft((prev) => ({ ...prev, provider: event.target.value }))}
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
    </div>
  );
}
