"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";

export interface MonthlyChartData {
  month: string;
  tuition: number;
  external: number;
}

interface TooltipPayload { dataKey: string; value: number; }
interface CustomTooltipProps { active?: boolean; payload?: TooltipPayload[]; label?: string; }

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const tuition = payload.find((p) => p.dataKey === "tuition")?.value ?? 0;
  const external = payload.find((p) => p.dataKey === "external")?.value ?? 0;
  const total = tuition + external;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-xl p-4 text-sm min-w-[180px]">
      <p className="font-bold text-gray-800 mb-2">{label}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5 text-gray-600">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-500" />수강료
          </span>
          <span className="font-medium text-gray-900">{tuition.toLocaleString()}원</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5 text-gray-600">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-400" />외부수입
          </span>
          <span className="font-medium text-gray-900">{external.toLocaleString()}원</span>
        </div>
        <div className="border-t border-gray-100 mt-2 pt-2 flex justify-between gap-4">
          <span className="font-semibold text-gray-700">합계</span>
          <span className="font-bold text-blue-700">{total.toLocaleString()}원</span>
        </div>
      </div>
    </div>
  );
}

export default function StatsChart({ data }: { data: MonthlyChartData[] }) {
  const formatY = (v: number) => v === 0 ? "0" : `${Math.round(v / 10000)}만`;
  return (
    <ResponsiveContainer width="100%" height={340}>
      <BarChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={formatY} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} width={48} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f9fafb" }} />
        <Legend wrapperStyle={{ fontSize: 13, paddingTop: 12 }} />
        <Bar dataKey="tuition" name="수강료" stackId="a" fill="#3b82f6" />
        <Bar dataKey="external" name="외부수입" stackId="a" fill="#fbbf24" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}