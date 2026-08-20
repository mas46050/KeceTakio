"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = [
  "#157347", "#0d6efd", "#d97706", "#dc2626", "#6f42c1",
  "#0dcaf0", "#84cc16", "#f43f5e", "#64748b", "#a16207",
];

export function BarBox({
  data,
  xKey,
  yKey,
  yLabel,
  color = "#157347",
}: {
  data: Record<string, unknown>[];
  xKey: string;
  yKey: string;
  yLabel: string;
  color?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey={xKey} tick={{ fontSize: 12 }} interval={0} angle={-20} textAnchor="end" height={58} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Bar dataKey={yKey} name={yLabel} fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LineBox({
  data,
  xKey,
  yKey,
  yLabel,
  color = "#0d6efd",
}: {
  data: Record<string, unknown>[];
  xKey: string;
  yKey: string;
  yLabel: string;
  color?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Line type="monotone" dataKey={yKey} name={yLabel} stroke={color} strokeWidth={2} dot />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function PieBox({
  data,
  nameKey,
  valueKey,
}: {
  data: Record<string, unknown>[];
  nameKey: string;
  valueKey: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey={valueKey} nameKey={nameKey} outerRadius={95} label>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
