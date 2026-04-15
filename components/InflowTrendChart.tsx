"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Props = {
  data: Array<Record<string, string | number>>;
  routes: string[];
  colors: Record<string, string>;
  /** 같은 X축 차트들과 툴팁을 동기화할 syncId */
  syncId?: string;
  /** 숨길 라우트 Set (페이지에서 외부 제어) */
  hiddenRoutes?: Set<string>;
};

export default function InflowTrendChart({ data, routes, colors, syncId, hiddenRoutes }: Props) {
  if (routes.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        유입경로 데이터 없음
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} syncId={syncId} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="year" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => [`${value}명`, name]}
        />
        {routes.map((route) => (
          <Line
            key={route}
            type="monotone"
            dataKey={route}
            stroke={colors[route] ?? "#94a3b8"}
            strokeWidth={2.5}
            dot={{ r: 4, strokeWidth: 2 }}
            activeDot={{ r: 6 }}
            hide={hiddenRoutes?.has(route) ?? false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
