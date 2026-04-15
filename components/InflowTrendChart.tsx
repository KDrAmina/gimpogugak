"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type Props = {
  data: Array<Record<string, string | number>>;
  routes: string[];
  colors: Record<string, string>;
};

// ── 커스텀 범례: 클릭 시 토글, 숨겨진 항목은 흐리게 + 취소선 표시 ──────────
type LegendPayloadItem = {
  dataKey?: string | number;
  value?: string;
  color?: string;
};

function ClickableLegend({
  payload,
  hiddenRoutes,
  onToggle,
}: {
  payload?: LegendPayloadItem[];
  hiddenRoutes: Set<string>;
  onToggle: (key: string) => void;
}) {
  if (!payload?.length) return null;
  return (
    <div className="flex flex-wrap gap-2 justify-center mt-3 px-2">
      {payload.map((entry) => {
        const key = String(entry.dataKey ?? entry.value ?? "");
        const isHidden = hiddenRoutes.has(key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => onToggle(key)}
            title={isHidden ? `${key} 표시` : `${key} 숨기기`}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all select-none"
            style={{
              opacity: isHidden ? 0.35 : 1,
              textDecoration: isHidden ? "line-through" : "none",
              borderColor: isHidden ? "#d1d5db" : (entry.color ?? "#94a3b8"),
              color: isHidden ? "#9ca3af" : (entry.color ?? "#94a3b8"),
              background: isHidden ? "#f9fafb" : `${entry.color ?? "#94a3b8"}15`,
            }}
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: isHidden ? "#d1d5db" : (entry.color ?? "#94a3b8") }}
            />
            {entry.value ?? key}
          </button>
        );
      })}
    </div>
  );
}

export default function InflowTrendChart({ data, routes, colors }: Props) {
  const [hiddenRoutes, setHiddenRoutes] = useState<Set<string>>(new Set());

  // routes 목록이 바뀌면(연도↔월 전환 등) 토글 상태 초기화
  useEffect(() => {
    setHiddenRoutes(new Set());
  }, [routes.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = useCallback((key: string) => {
    setHiddenRoutes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        // 마지막 하나는 숨기지 않음 (모두 숨겨지는 상황 방지)
        const visibleCount = routes.length - next.size;
        if (visibleCount <= 1) return prev;
        next.add(key);
      }
      return next;
    });
  }, [routes.length]);

  if (routes.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        유입경로 데이터 없음
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="year" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => [`${value}명`, name]}
        />
        <Legend
          content={(props) => (
            <ClickableLegend
              payload={props.payload as LegendPayloadItem[]}
              hiddenRoutes={hiddenRoutes}
              onToggle={handleToggle}
            />
          )}
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
            hide={hiddenRoutes.has(route)}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
