"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BottomSheet from "@/components/ui/bottom-sheet";
import OrderCard, { getNextStatus } from "@/components/orders/order-card";
import EmptyState from "@/components/ui/empty-state";
import { useEmptyState } from "@/hooks/use-empty-state";
import { PackageX } from "lucide-react";
import { apiFetch } from "@/lib/api";

const filters = ["ALL", "PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"];

export default function OrdersPage() {
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
      } catch {
        if (!append) {
          setOrders([]);
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

    await apiFetch(`/admin/orders/${order.id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status: nextStatus }),
    });

    setOrders((current) => current.map((item) => (item.id === order.id ? { ...item, status: nextStatus } : item)));
  };

  const confirmCancel = async () => {
    if (!cancelOrder) return;

    await apiFetch(`/admin/orders/${cancelOrder.id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status: "CANCELLED" }),
    });

    setOrders((current) =>
      current.map((item) =>
        item.id === cancelOrder.id
          ? {
            ...item,
            status: "CANCELLED",
          }
          : item
      )
    );

    setCancelOrder(null);
  };

  const headerTitleClass = headerSmall ? "text-[22px]" : "text-[28px]";

  const listState = useEmptyState(loading, orders, null);

  const statusLabel = useMemo(() => {
    if (status === "ALL") return "All orders";
    return `${status.toLowerCase()} orders`;
  }, [status]);

  return (
    <div className="pb-6">
      <motion.header layout className="sticky top-0 z-20 mb-3 bg-[var(--bg-app)] pb-2 pt-1">
        <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">Orders</p>
        <h1 className={`font-semibold leading-tight text-[var(--accent)] transition-all ${headerTitleClass}`}>
          {statusLabel}
        </h1>

        <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
          {filters.map((item) => {
            const active = item === status;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setStatus(item)}
                className={`app-chip whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${active
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[color:rgba(243,244,246,0.95)] text-[var(--text-secondary)]"
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
            className="flex h-11 items-center rounded-2xl border border-[var(--card-border)] bg-white px-3"
          >
            <Search size={16} className="text-[var(--text-muted)]" />
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
            <div className="skeleton h-24 rounded-[20px]" />
            <div className="skeleton h-24 rounded-[20px]" />
            <div className="skeleton h-24 rounded-[20px]" />
          </div>
        ) : null}

        {listState.showEmpty ? (
          <div className="pt-8">
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
        <p className="px-1 text-sm text-[var(--text-secondary)]">
          This order will be marked as cancelled. You can still view it in history.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setCancelOrder(null)}
            className="app-button h-11 flex-1 rounded-2xl border border-[var(--card-border)] text-sm"
          >
            Keep
          </button>
          <button
            type="button"
            onClick={confirmCancel}
            className="app-button h-11 flex-1 rounded-2xl bg-[var(--error)] text-sm font-semibold text-white"
          >
            Cancel Order
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
