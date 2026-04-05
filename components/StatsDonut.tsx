"use client";

import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

export interface PieData { name: string; value: number; color: string; }

interface TooltipProps { active?: boolean; payload?: { name: string; value: number; payload: PieData }[]; }

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-xl p-3 text-sm">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.payload.color }} />
        <span className="font-semibold text-gray-800">{d.name}</span>
      </div>
      <p className="text-gray-700 font-medium">{d.value.toLocaleString()}원</p>
    </div>
  );
}

interface LabelProps {
  cx: number; cy: number; midAngle: number; innerRadius: number;
  outerRadius: number; percent: number;
}

function fmtTotal(n: number): string {
  if (n >= 100_000_000) return (n / 100_000_000).toFixed(1) + "억";
  if (n >= 10_000) return Math.round(n / 10_000).toLocaleString() + "만";
  return n.toLocaleString();
}

function renderLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: LabelProps) {
  if (percent < 0.05) return null;
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + r * Math.cos(-midAngle * (Math.PI / 180));
  const y = cy + r * Math.sin(-midAngle * (Math.PI / 180));
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export default function StatsDonut({ data, title }: { data: PieData[]; title?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div>
      {title && <p className="text-sm font-medium text-gray-600 mb-2 text-center">{title}</p>}
      <div className="text-center mb-1">
        <p className="text-xs text-gray-400">합계</p>
        <p className="text-lg font-bold text-gray-900">{fmtTotal(total)}원</p>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={95}
            paddingAngle={2}
            dataKey="value"
            labelLine={false}
            label={renderLabel as unknown as boolean}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value) => <span style={{ fontSize: 12, color: "#6b7280" }}>{value}</span>}
            wrapperStyle={{ paddingTop: 8 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}