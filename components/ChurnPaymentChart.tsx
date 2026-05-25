"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";

export interface ChurnBinData {
  label: string;
  count: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-xl p-3 text-sm min-w-[150px]">
      <p className="font-bold text-gray-700 mb-1">{label}</p>
      <p className="text-rose-600 font-semibold">{payload[0].value}명 이탈</p>
    </div>
  );
}

const BAR_COLORS = [
  "#fecdd3", "#fda4af", "#fb7185", "#f43f5e",
  "#e11d48", "#be123c", "#9f1239", "#881337",
  "#7e1230", "#6b1028", "#580e21", "#450b1a", "#320812",
];

export default function ChurnPaymentChart({ data }: { data: ChurnBinData[] }) {
  const formatY = (v: number) => (v === 0 ? "0" : `${v}명`);
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 48 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "#6b7280" }}
          axisLine={false}
          tickLine={false}
          angle={-40}
          textAnchor="end"
          interval={0}
        />
        <YAxis
          tickFormatter={formatY}
          tick={{ fontSize: 11, fill: "#6b7280" }}
          axisLine={false}
          tickLine={false}
          width={42}
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "#fff1f2" }} />
        <Bar dataKey="count" name="이탈 수강생 수" radius={[4, 4, 0, 0]} barSize={22}>
          {data.map((_, i) => (
            <Cell key={i} fill={BAR_COLORS[i] ?? "#f43f5e"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
