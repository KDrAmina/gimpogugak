"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

/**
 * 신규 유입 vs 이탈 — 연도별 겹쳐보기 (YoY)
 *
 * 색상 = 연도 (YEAR_COLORS, 다른 겹쳐보기 차트와 동일)
 * 선 스타일 = 지표 (실선·채운 점 = 신규 / 점선·빈 점 = 이탈 — 누적 보기와 동일한 실선/점선 규칙)
 * 연도 토글은 해당 연도의 신규·이탈 두 선을 함께 숨긴다.
 */
type Props = {
  /** 1월~12월 × 연도 데이터. month 키 + `${연도}_new` / `${연도}_churned` 키(명) */
  data: Array<Record<string, string | number>>;
  /** 렌더링할 연도 목록 (예: ["2023", "2024", "2025", "2026"]) */
  years: string[];
  /** 연도 → HEX 색상 */
  colors: Record<string, string>;
  /** 연도 → 표시 레이블 (예: "2025" → "2025년") */
  labels: Record<string, string>;
  /** 같은 X축 차트들과 툴팁을 동기화할 syncId */
  syncId?: string;
  /** 숨길 연도 Set (페이지에서 외부 제어) */
  hiddenYears?: Set<string>;
};

interface TPayload { dataKey?: string | number; value?: number; }
interface TProps {
  active?: boolean; payload?: TPayload[]; label?: string;
  years: string[]; colors: Record<string, string>; labels: Record<string, string>;
}

function CustomTooltip({ active, payload, label, years, colors, labels }: TProps) {
  if (!active || !payload?.length) return null;
  // 숨긴 연도의 선은 Recharts가 payload에서 제외하므로, payload에 있는 연도만 표시된다
  const valueOf = (key: string) => payload.find((p) => p.dataKey === key)?.value;
  const rows = years.filter((yr) => valueOf(yr + "_new") != null || valueOf(yr + "_churned") != null);
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-xl p-4 text-sm min-w-[200px]">
      <p className="font-bold text-gray-800 mb-2">{label}</p>
      <div className="space-y-1">
        {rows.map((yr) => (
          <div key={yr} className="flex justify-between gap-4">
            <span className="flex items-center gap-1.5 text-gray-600">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: colors[yr] }} />
              {labels[yr] ?? yr}
            </span>
            <span className="text-gray-500">
              신규 <span className="font-semibold text-gray-900">+{valueOf(yr + "_new") ?? 0}명</span>
              <span className="text-gray-300 mx-1.5">·</span>
              이탈 <span className="font-semibold text-gray-900">-{valueOf(yr + "_churned") ?? 0}명</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function YoyFlowChart({ data, years, colors, labels, syncId, hiddenYears }: Props) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} syncId={syncId} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
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
        <Tooltip content={<CustomTooltip years={years} colors={colors} labels={labels} />} />
        {years.flatMap((yr) => {
          const color = colors[yr] ?? "#94a3b8";
          const hide = hiddenYears?.has(yr) ?? false;
          return [
            <Line
              key={yr + "_new"}
              type="monotone"
              dataKey={yr + "_new"}
              name={(labels[yr] ?? yr) + " 신규"}
              stroke={color}
              strokeWidth={2}
              dot={{ r: 3, fill: color, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              hide={hide}
            />,
            <Line
              key={yr + "_churned"}
              type="monotone"
              dataKey={yr + "_churned"}
              name={(labels[yr] ?? yr) + " 이탈"}
              stroke={color}
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={{ r: 3, fill: "#fff", stroke: color, strokeWidth: 1.5, strokeDasharray: "none" }}
              activeDot={{ r: 5 }}
              hide={hide}
            />,
          ];
        })}
      </LineChart>
    </ResponsiveContainer>
  );
}
