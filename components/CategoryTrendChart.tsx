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
  /** periods × categories 형태의 데이터. month 키 + 카테고리 키(금액) */
  data: Array<Record<string, string | number>>;
  /** 렌더링할 카테고리 목록 (예: ["어린이개인", "어린이단체", ...]) */
  categories: string[];
  /** 카테고리 → HEX 색상 */
  colors: Record<string, string>;
  /** 카테고리 → 표시 레이블 (예: "어린이개인" → "어린이 개인") */
  labels: Record<string, string>;
};

function fmtWan(v: unknown): string {
  const n = Number(v);
  if (n >= 10_000_000) return (n / 10_000_000).toFixed(0) + "천만";
  if (n >= 10_000) return Math.round(n / 10_000) + "만";
  return n.toLocaleString();
}

export default function CategoryTrendChart({ data, categories, colors, labels }: Props) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={fmtWan} tick={{ fontSize: 11 }} width={50} />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: unknown, name: any) => [
            Number(value).toLocaleString() + "원",
            labels[String(name)] ?? String(name),
          ]}
          contentStyle={{ fontSize: 12 }}
        />
        <Legend
          formatter={(value) => labels[value] ?? value}
          wrapperStyle={{ fontSize: 12 }}
        />
        {categories.map((cat) => (
          <Line
            key={cat}
            type="monotone"
            dataKey={cat}
            name={cat}
            stroke={colors[cat] ?? "#94a3b8"}
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
