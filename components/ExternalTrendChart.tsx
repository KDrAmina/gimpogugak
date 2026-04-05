"use client";

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
  /** periods × types 형태의 데이터. month 키 + 외부수입 유형 키(금액) */
  data: Array<Record<string, string | number>>;
  /** 렌더링할 외부수입 유형 목록 (예: ["체험비", "강사수수료", "기타"]) */
  types: string[];
  /** 유형 → HEX 색상 */
  colors: Record<string, string>;
};

function fmtWan(v: unknown): string {
  const n = Number(v);
  if (n >= 10_000_000) return (n / 10_000_000).toFixed(0) + "천만";
  if (n >= 10_000) return Math.round(n / 10_000) + "만";
  return n.toLocaleString();
}

export default function ExternalTrendChart({ data, types, colors }: Props) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={fmtWan} tick={{ fontSize: 11 }} width={50} />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: unknown, name: any) => [
            Number(value).toLocaleString() + "원",
            String(name),
          ]}
          contentStyle={{ fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {types.map((type) => (
          <Line
            key={type}
            type="monotone"
            dataKey={type}
            stroke={colors[type] ?? "#94a3b8"}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
