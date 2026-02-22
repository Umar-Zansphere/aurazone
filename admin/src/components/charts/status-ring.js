"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const colors = {
  PENDING: "#C45B5B",
  PAID: "#5B7BA8",
  SHIPPED: "#D4954A",
  DELIVERED: "#5B8C5A",
  CANCELLED: "#9CA3AF",
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
            <Cell key={entry.name} fill={colors[entry.name] || "#CBD5E1"} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => [value, "Orders"]} />
      </PieChart>
    </ResponsiveContainer>
  );
}
