"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiFetch } from "@/lib/api";
import { formatCompactCurrencyINR, formatCurrencyINR } from "@/lib/format";
import EmptyState from "@/components/ui/empty-state";
import { useEmptyState } from "@/hooks/use-empty-state";
import { BarChart3, RefreshCw } from "lucide-react";

const periods = ["today", "7d", "30d", "90d", "custom"];

const statusColors = {
  PENDING: "#b7791f",
  PAID: "#3b6b8c",
  SHIPPED: "#a18a68",
  DELIVERED: "#2f6b4f",
  CANCELLED: "#9a9a9a",
};

export default function AnalyticsPage() {
  const [period, setPeriod] = useState("7d");
  const [custom, setCustom] = useState({ startDate: "", endDate: "" });
  const [openCustom, setOpenCustom] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await apiFetch("/admin/analytics", {
        params: {
          period: period === "custom" ? undefined : period,
          startDate: period === "custom" ? custom.startDate : undefined,
          endDate: period === "custom" ? custom.endDate : undefined,
        },
      });
      setData(payload);
    } catch (err) {
      setData(null);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [custom.endDate, custom.startDate, period]);

  useEffect(() => {
    if (period === "custom" && (!custom.startDate || !custom.endDate)) {
      return;
    }
    loadAnalytics();
  }, [period, custom.startDate, custom.endDate, loadAnalytics]);

  const statusData = useMemo(() => {
    if (!data?.statusBreakdown) return [];
    return Object.entries(data.statusBreakdown).map(([name, value]) => ({ name, value }));
  }, [data?.statusBreakdown]);

  const paymentSplit = data?.paymentMethodBreakdown || { RAZORPAY: 0, COD: 0 };
  const paymentTotal = (paymentSplit.RAZORPAY || 0) + (paymentSplit.COD || 0);
  const razorRatio = paymentTotal ? ((paymentSplit.RAZORPAY || 0) / paymentTotal) * 100 : 0;

  const state = useEmptyState(loading, data, error);

  return (
    <div className="space-y-3 pb-6">
      <header>
        <p className="page-label">Insights</p>
        <h1 className="page-title">Analytics</h1>
      </header>

      <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1">
        {periods.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setPeriod(item);
              if (item === "custom") setOpenCustom(true);
            }}
            className={`app-chip whitespace-nowrap rounded-full px-3 py-1.5 text-xs transition-colors ${period === item
              ? "bg-[var(--accent)] text-white"
              : "bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)]"
              }`}
          >
            {item.toUpperCase()}
          </button>
        ))}
      </div>

      {period === "custom" && openCustom ? (
        <section className="card-surface space-y-2 p-4">
          <p className="form-label">Custom Date Range</p>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={custom.startDate}
              onChange={(event) => setCustom((prev) => ({ ...prev, startDate: event.target.value }))}
              className="form-input text-xs"
            />
            <input
              type="date"
              value={custom.endDate}
              onChange={(event) => setCustom((prev) => ({ ...prev, endDate: event.target.value }))}
              className="form-input text-xs"
            />
          </div>
        </section>
      ) : null}

      {state.isLoading ? (
        <div className="space-y-3">
          <div className="skeleton h-40 rounded-[20px]" />
          <div className="skeleton h-52 rounded-[20px]" />
          <div className="skeleton h-48 rounded-[20px]" />
        </div>
      ) : state.showError ? (
        <EmptyState
          title="Failed to load analytics"
          description="Something went wrong fetching analytics data."
          icon={RefreshCw}
          variant="error"
          action={{ label: "Retry", onClick: loadAnalytics }}
        />
      ) : state.showEmpty ? (
        <EmptyState
          title="No analytics data"
          description="Analytics will appear once you have order activity."
          icon={BarChart3}
        />
      ) : (
        <>
          <section className="card-surface p-4">
            <p className="section-title">Total Revenue</p>
            <p className="mt-1.5 text-[40px] font-bold leading-none tracking-tight text-[var(--text-primary)]">
              {formatCurrencyINR(data.totalRevenue || 0)}
            </p>
            <div className="mt-3 h-36">
              <ResponsiveContainer>
                <AreaChart data={data.revenueTimeseries || []}>
                  <defs>
                    <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a18a68" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#a18a68" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" hide />
                  <YAxis hide />
                  <Tooltip formatter={(value) => formatCompactCurrencyINR(value)} />
                  <Area type="monotone" dataKey="revenue" stroke="#a18a68" strokeWidth={2} fill="url(#revFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="card-surface p-4">
            <p className="section-title">Order Breakdown</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="h-44">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="86%">
                      {statusData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={statusColors[entry.name] || "#d6d3d1"}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="flex flex-col justify-center gap-3">
                <div>
                  <p className="text-[11px] text-[var(--text-secondary)]">Payment Split</p>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[var(--border)]">
                    <div className="h-full bg-[var(--accent)]" style={{ width: `${razorRatio}%` }} />
                  </div>
                  <div className="mt-1 flex justify-between text-[11px] text-[var(--text-secondary)]">
                    <span>Razorpay {paymentSplit.RAZORPAY || 0}</span>
                    <span>COD {paymentSplit.COD || 0}</span>
                  </div>
                </div>

                <div className="h-24">
                  <ResponsiveContainer>
                    <BarChart data={statusData}>
                      <XAxis dataKey="name" hide />
                      <YAxis hide />
                      <Tooltip />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#a18a68" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </section>

          <section className="card-surface p-4">
            <p className="mb-3 section-title">Top Products</p>
            {(data.topProducts || []).length === 0 ? (
              <p className="py-4 text-center text-sm text-[var(--text-muted)]">No product data for this period.</p>
            ) : (
              <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1">
                {(data.topProducts || []).map((item) => (
                  <article key={item.productName} className="min-w-[220px] rounded-[14px] border border-[var(--border)] p-3 transition-colors hover:bg-[var(--surface-hover)]">
                    <p className="line-clamp-1 text-sm font-semibold text-[var(--text-primary)]">{item.productName}</p>
                    <p className="text-[11px] text-[var(--text-secondary)]">{item.unitsSold} units sold</p>
                    <p className="mt-1.5 text-xs font-semibold text-[var(--highlight)]">{formatCurrencyINR(item.revenue)}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
