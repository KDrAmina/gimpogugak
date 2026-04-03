"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";

export interface LineData {
  month: string;
  new: number;
  churned: number;
}

interface TPayload { dataKey: string; value: number; color: string; }
interface TProps { active?: boolean; payload?: TPayload[]; label?: string; }

function CustomTooltip({ active, payload, label }: TProps) {
  if (!active || !payload?.length) return null;
  const newVal     = payload.find((p) => p.dataKey === "new")?.value     ?? 0;
  const churnedVal = payload.find((p) => p.dataKey === "churned")?.value ?? 0;
  const net = newVal - churnedVal;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-xl p-4 text-sm min-w-[160px]">
      <p className="font-bold text-gray-800 mb-2">{label}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5 text-gray-600">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />신규 유입
          </span>
          <span className="font-semibold text-blue-600">+{newVal}명</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5 text-gray-600">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />이탈
          </span>
          <span className="font-semibold text-rose-500">-{churnedVal}명</span>
        </div>
        <div className="border-t border-gray-100 mt-2 pt-2 flex justify-between gap-4">
          <span className="font-semibold text-gray-700">순증감</span>
          <span className={`font-bold ${net >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {net >= 0 ? "+" : ""}{net}명
          </span>
        </div>
      </div>
    </div>
  );
}

export default function StatsLine({ data }: { data: LineData[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: "#6b7280" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#6b7280" }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          width={28}
        />
        <ReferenceLine y={0} stroke="#e5e7eb" />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 13, paddingTop: 12 }} />
        <Line
          type="monotone"
          dataKey="new"
          name="신규 유입"
          stroke="#3b82f6"
          strokeWidth={2.5}
          dot={{ r: 4, fill: "#3b82f6", strokeWidth: 0 }}
          activeDot={{ r: 6 }}
        />
        <Line
          type="monotone"
          dataKey="churned"
          name="이탈"
          stroke="#f43f5e"
          strokeWidth={2.5}
          strokeDasharray="6 3"
          dot={{ r: 4, fill: "#f43f5e", strokeWidth: 0 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}