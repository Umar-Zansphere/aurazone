"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiFetch } from "@/lib/api";
import { formatCompactCurrencyINR, formatCurrencyINR } from "@/lib/format";

const periods = ["today", "7d", "30d", "90d", "custom"];

export default function AnalyticsPage() {
  const [period, setPeriod] = useState("7d");
  const [custom, setCustom] = useState({ startDate: "", endDate: "" });
  const [openCustom, setOpenCustom] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await apiFetch("/admin/analytics", {
        params: {
          period: period === "custom" ? undefined : period,
          startDate: period === "custom" ? custom.startDate : undefined,
          endDate: period === "custom" ? custom.endDate : undefined,
        },
      });
      setData(payload);
    } catch {
      setData(null);
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

  return (
    <div className="space-y-3 pb-6">
      <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1">
        {periods.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setPeriod(item);
              if (item === "custom") setOpenCustom(true);
            }}
            className={`app-chip whitespace-nowrap rounded-full px-3 py-1.5 text-xs ${period === item ? "bg-[var(--accent)] text-white" : "bg-zinc-100 text-[var(--text-secondary)]"
              }`}
          >
            {item.toUpperCase()}
          </button>
        ))}
      </div>

      {period === "custom" && openCustom ? (
        <section className="card-surface space-y-2 p-3">
          <p className="text-xs font-medium text-[var(--text-secondary)]">Custom Date Range</p>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={custom.startDate}
              onChange={(event) => setCustom((prev) => ({ ...prev, startDate: event.target.value }))}
              className="h-10 rounded-2xl border border-[var(--card-border)] px-2 text-xs"
            />
            <input
              type="date"
              value={custom.endDate}
              onChange={(event) => setCustom((prev) => ({ ...prev, endDate: event.target.value }))}
              className="h-10 rounded-2xl border border-[var(--card-border)] px-2 text-xs"
            />
          </div>
        </section>
      ) : null}

      {loading || !data ? (
        <div className="space-y-2">
          <div className="skeleton h-40 rounded-[20px]" />
          <div className="skeleton h-52 rounded-[20px]" />
          <div className="skeleton h-48 rounded-[20px]" />
        </div>
      ) : (
        <>
          <section className="card-surface p-3">
            <p className="text-xs text-[var(--text-secondary)]">Total Revenue</p>
            <p className="mt-1 text-[40px] font-bold leading-none text-[var(--accent)]">
              {formatCurrencyINR(data.totalRevenue || 0)}
            </p>
            <div className="mt-2 h-36">
              <ResponsiveContainer>
                <AreaChart data={data.revenueTimeseries || []}>
                  <defs>
                    <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1B2A4A" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#1B2A4A" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" hide />
                  <YAxis hide />
                  <Tooltip formatter={(value) => formatCompactCurrencyINR(value)} />
                  <Area type="monotone" dataKey="revenue" stroke="#1B2A4A" fill="url(#revFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="card-surface p-3">
            <p className="text-xs text-[var(--text-secondary)]">Order Breakdown</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="h-44">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="86%">
                      {statusData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={{ PENDING: "#C45B5B", PAID: "#5B7BA8", SHIPPED: "#D4954A", DELIVERED: "#5B8C5A", CANCELLED: "#9CA3AF" }[entry.name] || "#CBD5E1"}
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
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-zinc-200">
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
                      <Bar dataKey="value" radius={[10, 10, 0, 0]} fill="#C4785B" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </section>

          <section className="card-surface p-3">
            <p className="mb-2 text-xs text-[var(--text-secondary)]">Top Products</p>
            <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1">
              {(data.topProducts || []).map((item) => (
                <article key={item.productName} className="min-w-[220px] rounded-2xl border border-[var(--card-border)] p-2.5">
                  <p className="line-clamp-1 text-sm font-semibold">{item.productName}</p>
                  <p className="text-[11px] text-[var(--text-secondary)]">{item.unitsSold} units sold</p>
                  <p className="mt-1 text-xs font-semibold text-[var(--accent)]">{formatCurrencyINR(item.revenue)}</p>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
