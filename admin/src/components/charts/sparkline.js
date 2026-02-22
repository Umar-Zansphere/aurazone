"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";

export default function Sparkline({ data = [] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C4785B" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#C4785B" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#C4785B"
          strokeWidth={2.2}
          fill="url(#sparkFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
