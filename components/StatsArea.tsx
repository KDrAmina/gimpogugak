"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import type { MonthlyChartData } from "./StatsChart";

interface TPayload { name: string; value: number; }
interface TTooltipProps { active?: boolean; payload?: TPayload[]; label?: string; }

function CustomTooltip({ active, payload, label }: TTooltipProps) {
  if (!active || !payload?.length) return null;
  const tuition  = payload.find(p => p.name === "수강료")?.value  ?? 0;
  const external = payload.find(p => p.name === "외부수입")?.value ?? 0;
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-xl p-4 text-sm min-w-[180px]">
      <p className="font-bold text-gray-700 mb-3 pb-2 border-b border-gray-100">{label}</p>
      <div className="space-y-2">
        <div className="flex justify-between gap-6">
          <span className="flex items-center gap-2 text-gray-500">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />수강료
          </span>
          <span className="font-semibold text-gray-900">{tuition.toLocaleString()}원</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="flex items-center gap-2 text-gray-500">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />외부수입
          </span>
          <span className="font-semibold text-gray-900">{external.toLocaleString()}원</span>
        </div>
        <div className="pt-2 border-t border-gray-100 flex justify-between gap-6">
          <span className="font-semibold text-gray-700">합계</span>
          <span className="font-bold text-indigo-600">{(tuition + external).toLocaleString()}원</span>
        </div>
      </div>
    </div>
  );
}

export default function StatsArea({ data }: { data: MonthlyChartData[] }) {
  const fmtY = (v: number) => {
    if (v === 0) return "0";
    return Math.round(v / 10000) + "만";
  };
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="gtTuition" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}   />
          </linearGradient>
          <linearGradient id="gtExternal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}   />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={fmtY}
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
          width={44}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#e2e8f0", strokeWidth: 1 }} />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12, color: "#94a3b8" }} />
        <Area
          type="monotone"
          dataKey="tuition"
          name="수강료"
          stroke="#6366f1"
          strokeWidth={2.5}
          fill="url(#gtTuition)"
          dot={false}
          activeDot={{ r: 5, fill: "#6366f1", strokeWidth: 2, stroke: "#fff" }}
        />
        <Area
          type="monotone"
          dataKey="external"
          name="외부수입"
          stroke="#f59e0b"
          strokeWidth={2}
          fill="url(#gtExternal)"
          dot={false}
          activeDot={{ r: 4, fill: "#f59e0b", strokeWidth: 2, stroke: "#fff" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}