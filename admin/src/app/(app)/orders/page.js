"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Search, PackageX, RefreshCw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import BottomSheet from "@/components/ui/bottom-sheet";
import OrderCard, { getNextStatus } from "@/components/orders/order-card";
import EmptyState from "@/components/ui/empty-state";
import { useEmptyState } from "@/hooks/use-empty-state";
import { apiFetch } from "@/lib/api";

const filters = ["ALL", "PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"];

function OrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [headerSmall, setHeaderSmall] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(searchParams.get("status") || "ALL");

  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, skip: 0, take: 20, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [cancelOrder, setCancelOrder] = useState(null);
  const sentinelRef = useRef(null);

  const activeStatus = status === "ALL" ? undefined : status;

  const loadOrders = useCallback(
    async ({ append = false } = {}) => {
      const skip = append ? orders.length : 0;
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const data = await apiFetch("/admin/orders", {
          params: {
            status: activeStatus,
            search: query,
            skip,
            take: 20,
          },
        });

        setOrders((current) => (append ? [...current, ...data.orders] : data.orders));
        setPagination(data.pagination);
      } catch (err) {
        if (!append) {
          setOrders([]);
          setError(err);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [activeStatus, orders.length, query]
  );

  useEffect(() => {
    loadOrders({ append: false });
  }, [loadOrders]);

  useEffect(() => {
    const onScroll = () => setHeaderSmall(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!sentinelRef.current || loading || loadingMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && orders.length < pagination.total) {
          loadOrders({ append: true });
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loadOrders, loading, loadingMore, orders.length, pagination.total]);

  const applyNextStatus = async (order) => {
    const nextStatus = getNextStatus(order.status);
    if (!nextStatus) return;

    try {
      await apiFetch(`/admin/orders/${order.id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: nextStatus }),
      });

      setOrders((current) => current.map((item) => (item.id === order.id ? { ...item, status: nextStatus } : item)));
    } catch {
      // silent
    }
  };

  const confirmCancel = async () => {
    if (!cancelOrder) return;

    try {
      await apiFetch(`/admin/orders/${cancelOrder.id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: "CANCELLED" }),
      });

      setOrders((current) =>
        current.map((item) =>
          item.id === cancelOrder.id
            ? { ...item, status: "CANCELLED" }
            : item
        )
      );
    } catch {
      // silent
    }

    setCancelOrder(null);
  };

  const headerTitleClass = headerSmall ? "text-[22px]" : "text-[28px]";

  const listState = useEmptyState(loading, orders, error);

  const statusLabel = useMemo(() => {
    if (status === "ALL") return "All orders";
    return `${status.toLowerCase()} orders`;
  }, [status]);

  return (
    <div className="pb-6">
      <motion.header layout className="sticky top-0 z-20 mb-3 bg-[var(--bg-app)] pb-2 pt-1">
        <p className="page-label">Orders</p>
        <h1 className={`font-bold leading-tight tracking-tight text-[var(--text-primary)] transition-all ${headerTitleClass}`}>
          {statusLabel}
        </h1>

        <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
          {filters.map((item) => {
            const active = item === status;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setStatus(item)}
                className={`app-chip whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${active
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)]"
                  }`}
              >
                {item === "ALL" ? "All" : item}
              </button>
            );
          })}
        </div>

        <div className="mt-2">
          <motion.div
            layout
            className="flex h-11 items-center rounded-[14px] border border-[var(--border)] bg-white px-3 transition-all focus-within:border-[var(--highlight)] focus-within:ring-2 focus-within:ring-[var(--highlight-soft)]"
          >
            <Search size={15} className="text-[var(--text-muted)]" />
            <input
              value={query}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setSearchOpen(false)}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchOpen ? "Search order number or email" : "Search orders"}
              className="ml-2 w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
            />
          </motion.div>
        </div>
      </motion.header>

      <div className="space-y-2.5">
        {orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onOpen={(item) => router.push(`/orders/${item.id}`)}
            onNextStatus={applyNextStatus}
            onCancel={setCancelOrder}
          />
        ))}

        {loading ? (
          <div className="space-y-2">
            <div className="skeleton h-24 rounded-[18px]" />
            <div className="skeleton h-24 rounded-[18px]" />
            <div className="skeleton h-24 rounded-[18px]" />
          </div>
        ) : null}

        {listState.showError ? (
          <div className="pt-6">
            <EmptyState
              title="Failed to load orders"
              description="Something went wrong. Please try again."
              icon={RefreshCw}
              variant="error"
              action={{ label: "Retry", onClick: () => loadOrders() }}
            />
          </div>
        ) : null}

        {listState.showEmpty ? (
          <div className="pt-6">
            <EmptyState
              title="No orders found"
              description={query ? "Try adjusting your search or filters." : "You do not have any orders matching this criteria."}
              icon={PackageX}
            />
          </div>
        ) : null}

        <div ref={sentinelRef} />

        {loadingMore ? <div className="py-3 text-center text-xs text-[var(--text-muted)]">Loading more...</div> : null}
      </div>

      <BottomSheet open={Boolean(cancelOrder)} onClose={() => setCancelOrder(null)} title="Cancel order" snap="half">
        <p className="text-sm text-[var(--text-secondary)]">
          This order will be marked as cancelled. You can still view it in history.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setCancelOrder(null)}
            className="app-button app-button-secondary h-11 flex-1 text-sm"
          >
            Keep
          </button>
          <button
            type="button"
            onClick={confirmCancel}
            className="app-button h-11 flex-1 rounded-[14px] bg-[var(--error)] text-sm font-semibold text-white"
          >
            Cancel Order
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="space-y-2"><div className="skeleton h-24 rounded-[18px]" /><div className="skeleton h-24 rounded-[18px]" /><div className="skeleton h-24 rounded-[18px]" /></div>}>
      <OrdersContent />
    </Suspense>
  );
}
