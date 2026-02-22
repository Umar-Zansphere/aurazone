"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Copy,
  EllipsisVertical,
  ExternalLink,
  MapPin,
  Truck,
  UserCircle2,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import BottomSheet from "@/components/ui/bottom-sheet";
import { apiFetch } from "@/lib/api";
import { formatCurrencyINR, formatRelativeTime, statusTone } from "@/lib/format";

const primaryActionByStatus = {
  PENDING: "Mark as Paid",
  PAID: "Mark as Shipped",
  SHIPPED: "Mark as Delivered",
};

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shipmentOpen, setShipmentOpen] = useState(false);
  const [shipmentForm, setShipmentForm] = useState({
    courierName: "",
    trackingNumber: "",
    trackingUrl: "",
    status: "SHIPPED",
  });

  const orderId = params.id;

  const loadOrder = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/admin/orders/${orderId}`);
      setOrder(data);
      if (data.shipment) {
        setShipmentForm({
          courierName: data.shipment.courierName || "",
          trackingNumber: data.shipment.trackingNumber || "",
          trackingUrl: data.shipment.trackingUrl || "",
          status: data.shipment.status || "SHIPPED",
        });
      }
    } catch {
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const timeline = order?.statusTimeline || [];

  const applyPrimaryAction = async () => {
    if (!order) return;

    if (order.status === "PENDING") {
      await apiFetch(`/admin/orders/${order.id}/payment-status`, {
        method: "PUT",
        body: JSON.stringify({ paymentStatus: "SUCCESS" }),
      });
    } else if (order.status === "PAID") {
      setShipmentOpen(true);
      return;
    } else if (order.status === "SHIPPED") {
      await apiFetch(`/admin/orders/${order.id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: "DELIVERED" }),
      });
    }

    await loadOrder();
  };

  const saveShipment = async () => {
    if (!order) return;

    await apiFetch(`/admin/orders/${order.id}/shipment`, {
      method: "PUT",
      body: JSON.stringify(shipmentForm),
    });

    setShipmentOpen(false);
    await loadOrder();
  };

  const cancelOrder = async () => {
    if (!order) return;

    await apiFetch(`/admin/orders/${order.id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status: "CANCELLED" }),
    });

    setMenuOpen(false);
    await loadOrder();
  };

  const copyText = async (text) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // no-op
    }
  };

  const primaryAction = useMemo(() => {
    if (!order) return null;
    return primaryActionByStatus[order.status] || null;
  }, [order]);

  if (loading) {
    return (
      <div className="space-y-3 pb-24">
        <div className="skeleton h-14 rounded-2xl" />
        <div className="skeleton h-28 rounded-[20px]" />
        <div className="skeleton h-48 rounded-[20px]" />
        <div className="skeleton h-40 rounded-[20px]" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="card-surface p-6 text-center text-sm text-[var(--text-secondary)]">
        Order not found.
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-24">
      <header className="sticky top-0 z-20 rounded-2xl bg-[var(--bg-app)]/95 pb-1 pt-1 backdrop-blur">
        <div className="card-surface flex items-center justify-between p-2.5">
          <button
            type="button"
            onClick={() => router.back()}
            className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--card-border)]"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="text-center">
            <p className="text-xs text-[var(--text-secondary)]">Order</p>
            <p className="text-sm font-semibold">#{order.orderNumber}</p>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--card-border)]"
          >
            <EllipsisVertical size={16} />
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between px-1">
          <span
            className="app-chip rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
            style={{ background: statusTone[order.status] || "#9CA3AF" }}
          >
            {order.status}
          </span>
          <span className="text-xs text-[var(--text-muted)]">Created {formatRelativeTime(order.createdAt)}</span>
        </div>
      </header>

      <section className="card-surface p-3">
        <p className="text-xs font-medium text-[var(--text-secondary)]">Status Timeline</p>
        <div className="mt-2 space-y-2">
          {timeline.map((step, index) => {
            const active = step.status === order.status;
            return (
              <div key={`${step.status}-${step.timestamp}`} className="flex gap-2.5">
                <div className="flex flex-col items-center">
                  <span
                    className={`mt-1 h-3.5 w-3.5 rounded-full ${active ? "pulse-soft" : ""}`}
                    style={{ background: statusTone[step.status] || "#CBD5E1" }}
                  />
                  {index < timeline.length - 1 ? <span className="mt-1 h-8 w-px bg-[var(--border)]" /> : null}
                </div>
                <div className="pb-2">
                  <p className="text-sm font-medium">{step.status}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{new Date(step.timestamp).toLocaleString()}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card-surface p-3">
        <p className="mb-2 text-xs font-medium text-[var(--text-secondary)]">Customer</p>
        <div className="flex items-start gap-3">
          <UserCircle2 className="text-[var(--accent)]" size={34} />
          <div>
            <p className="text-sm font-semibold">{order.customer?.fullName || "Customer"}</p>
            <p className="text-xs text-[var(--text-secondary)]">{order.customer?.email || "-"}</p>
            <button
              type="button"
              onClick={() => copyText(order.customer?.phone)}
              className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--accent)]"
            >
              {order.customer?.phone || "No phone"}
              {order.customer?.phone ? <Copy size={12} /> : null}
            </button>
          </div>
        </div>
      </section>

      <section className="card-surface p-3">
        <p className="mb-2 text-xs font-medium text-[var(--text-secondary)]">Items</p>
        <div className="hide-scrollbar flex snap-x gap-2 overflow-x-auto pb-1">
          {order.items.map((item) => (
            <div key={item.id} className="min-w-[220px] snap-start rounded-2xl border border-[var(--card-border)] p-2.5">
              <p className="line-clamp-1 text-sm font-semibold">{item.productName}</p>
              <div className="mt-1 flex gap-1">
                <span className="app-chip rounded-full bg-zinc-100 px-2 py-0.5 text-[10px]">{item.size}</span>
                <span className="app-chip rounded-full bg-zinc-100 px-2 py-0.5 text-[10px]">{item.color}</span>
              </div>
              <p className="mt-2 text-xs text-[var(--text-secondary)]">
                {item.quantity} × {formatCurrencyINR(item.price)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="card-surface p-3">
        <p className="mb-2 text-xs font-medium text-[var(--text-secondary)]">Delivery Address</p>
        <div className="flex items-start gap-2">
          <MapPin size={16} className="mt-0.5 text-[var(--highlight)]" />
          <p className="text-sm text-[var(--text-primary)]">
            {order.orderAddress?.addressLine1}, {order.orderAddress?.city}, {order.orderAddress?.state} {order.orderAddress?.postalCode}, {order.orderAddress?.country}
          </p>
        </div>
      </section>

      <section className="card-surface p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium text-[var(--text-secondary)]">Shipment</p>
          {!order.shipment ? (
            <button
              type="button"
              onClick={() => setShipmentOpen(true)}
              className="text-xs font-medium text-[var(--accent)]"
            >
              Add Shipment
            </button>
          ) : null}
        </div>

        {order.shipment ? (
          <div className="space-y-1 text-sm">
            <p>{order.shipment.courierName || "Courier not set"}</p>
            <button
              type="button"
              onClick={() => copyText(order.shipment.trackingNumber)}
              className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)]"
            >
              {order.shipment.trackingNumber || "No tracking number"}
              {order.shipment.trackingNumber ? <Copy size={12} /> : null}
            </button>
            {order.shipment.trackingUrl ? (
              <a href={order.shipment.trackingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[var(--accent)]">
                Open tracking
                <ExternalLink size={12} />
              </a>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">No shipment added yet.</p>
        )}
      </section>

      <section className="card-surface p-3">
        <p className="mb-2 text-xs font-medium text-[var(--text-secondary)]">Payment</p>
        <div className="text-sm">
          <p>
            {order.paymentMethod} · {order.paymentStatus}
          </p>
          <p className="mt-1 font-semibold text-[var(--accent)]">{formatCurrencyINR(order.totalAmount)}</p>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+92px)] z-30 mx-auto w-full max-w-[520px] px-4">
        <div className="card-surface flex items-center gap-2 p-2">
          {primaryAction ? (
            <button
              type="button"
              onClick={applyPrimaryAction}
              className="app-button h-11 flex-1 rounded-2xl bg-[var(--accent)] text-sm font-semibold text-white"
            >
              {primaryAction}
            </button>
          ) : null}
          <button
            type="button"
            onClick={cancelOrder}
            className="h-11 rounded-2xl px-3 text-xs font-semibold text-[var(--error)]"
          >
            Cancel Order
          </button>
        </div>
      </div>

      <BottomSheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Order Actions" snap="half">
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setShipmentOpen(true);
            }}
            className="w-full rounded-2xl border border-[var(--card-border)] px-3 py-3 text-left text-sm"
          >
            <span className="inline-flex items-center gap-2">
              <Truck size={15} /> Add / Update Shipment
            </span>
          </button>
          <button
            type="button"
            onClick={cancelOrder}
            className="w-full rounded-2xl border border-[color:rgba(196,91,91,0.4)] px-3 py-3 text-left text-sm text-[var(--error)]"
          >
            Mark as Cancelled
          </button>
        </div>
      </BottomSheet>

      <BottomSheet open={shipmentOpen} onClose={() => setShipmentOpen(false)} title="Shipment" snap="half">
        <div className="space-y-2">
          <input
            value={shipmentForm.courierName}
            onChange={(event) => setShipmentForm((prev) => ({ ...prev, courierName: event.target.value }))}
            placeholder="Courier name"
            className="h-11 w-full rounded-2xl border border-[var(--card-border)] px-3 text-sm outline-none"
          />
          <input
            value={shipmentForm.trackingNumber}
            onChange={(event) => setShipmentForm((prev) => ({ ...prev, trackingNumber: event.target.value }))}
            placeholder="Tracking number"
            className="h-11 w-full rounded-2xl border border-[var(--card-border)] px-3 text-sm outline-none"
          />
          <input
            value={shipmentForm.trackingUrl}
            onChange={(event) => setShipmentForm((prev) => ({ ...prev, trackingUrl: event.target.value }))}
            placeholder="Tracking URL"
            className="h-11 w-full rounded-2xl border border-[var(--card-border)] px-3 text-sm outline-none"
          />
          <select
            value={shipmentForm.status}
            onChange={(event) => setShipmentForm((prev) => ({ ...prev, status: event.target.value }))}
            className="h-11 w-full rounded-2xl border border-[var(--card-border)] px-3 text-sm outline-none"
          >
            <option value="PENDING">PENDING</option>
            <option value="SHIPPED">SHIPPED</option>
            <option value="DELIVERED">DELIVERED</option>
            <option value="RETURNED">RETURNED</option>
            <option value="LOST">LOST</option>
          </select>

          <button
            type="button"
            onClick={saveShipment}
            className="app-button mt-2 h-11 w-full rounded-2xl bg-[var(--accent)] text-sm font-semibold text-white"
          >
            Save Shipment
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
