"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const colors = {
  PENDING: "#b7791f",
  PAID: "#3b6b8c",
  SHIPPED: "#a18a68",
  DELIVERED: "#2f6b4f",
  CANCELLED: "#9a9a9a",
};

export default function StatusRing({ dataMap }) {
  const data = Object.entries(dataMap || {}).map(([status, value]) => ({
    name: status,
    value,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="58%"
          outerRadius="86%"
          strokeWidth={0}
          paddingAngle={2}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={colors[entry.name] || "#d6d3d1"} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => [value, "Orders"]} />
      </PieChart>
    </ResponsiveContainer>
  );
}
