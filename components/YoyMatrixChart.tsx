"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import LineStyleKey from "./LineStyleKey";
import { seriesKey, type LineStyle } from "@/lib/yoy-chart";

/**
 * 연도별 겹쳐보기(YoY) 공용 라인 차트 — series = 행(색상) × 열(선 스타일)
 *
 *   매출 추이         연도(색) × 수강료·외부수입(실선 / 점선)
 *   신규 유입 vs 이탈  연도(색) × 신규·이탈(실선 / 점선)
 *   월별 외부수입      연도(색) × 외부수입(실선 1종)
 *   유입경로 트렌드    유입경로(색) × 연도(선 패턴)
 *
 * 행·열 토글은 Line의 hide로 처리한다. Recharts는 hide된 Line을 툴팁 payload와
 * Y축 domain 계산에서 제외하므로, 툴팁과 축은 항상 화면에 보이는 series만 반영한다.
 */
type Props = {
  /** 1월~12월 데이터. month 키 + seriesKey(행, 열) 키 */
  data: Array<Record<string, string | number>>;
  rows: string[];
  rowColors: Record<string, string>;
  rowLabels: Record<string, string>;
  cols: string[];
  colLabels: Record<string, string>;
  colStyles: Record<string, LineStyle>;
  hiddenRows?: Set<string>;
  hiddenCols?: Set<string>;
  /** 금액(원) 또는 인원(명) */
  unit: "won" | "person";
  /** 열이 2개 이상 보일 때 행별 합계 열 표시 (매출 추이: 수강료 + 외부수입 = 총매출) */
  showTotal?: boolean;
  /** 같은 X축 차트들과 툴팁을 동기화할 syncId */
  syncId?: string;
  height?: number;
};

function fmtWonTick(v: number): string {
  if (v === 0) return "0";
  if (v >= 100_000_000) return +(v / 100_000_000).toFixed(2) + "억";
  if (v >= 10_000) return Math.round(v / 10_000).toLocaleString() + "만";
  return v.toLocaleString();
}

interface TPayload { dataKey?: string | number; value?: number; }
type TooltipProps = Pick<Props, "rows" | "rowColors" | "rowLabels" | "cols" | "colLabels" | "colStyles" | "unit" | "showTotal"> & {
  active?: boolean; payload?: TPayload[]; label?: string;
};

function MatrixTooltip({ active, payload, label, rows, rowColors, rowLabels, cols, colLabels, colStyles, unit, showTotal }: TooltipProps) {
  if (!active || !payload?.length) return null;
  // payload에 남은 series = 화면에 보이는 series (숨긴 행·열은 Recharts가 이미 제외)
  const values = new Map<string, number>();
  for (const p of payload) if (p.dataKey != null) values.set(String(p.dataKey), Number(p.value ?? 0));
  const visCols = cols.filter((c) => rows.some((r) => values.has(seriesKey(r, c))));
  const visRows = rows.filter((r) => visCols.some((c) => values.has(seriesKey(r, c))));
  const withTotal = !!showTotal && visCols.length > 1;
  const fmt = (v: number) => (unit === "won" ? v.toLocaleString() + "원" : v + "명");
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-xl px-4 py-3 text-sm">
      <table className="tabular-nums">
        <thead>
          <tr>
            <th className="pr-3 pb-1.5 text-left font-bold text-gray-800">{label}</th>
            {visCols.map((c) => (
              <th key={c} className="pl-3 pb-1.5 text-right text-xs font-medium text-gray-500 whitespace-nowrap">
                <span className="inline-flex items-center gap-1"><LineStyleKey {...colStyles[c]} />{colLabels[c] ?? c}</span>
              </th>
            ))}
            {withTotal && <th className="pl-3 pb-1.5 text-right text-xs font-medium text-gray-500">합계</th>}
          </tr>
        </thead>
        <tbody>
          {visRows.map((r) => {
            const cells = visCols.map((c) => values.get(seriesKey(r, c)) ?? 0);
            return (
              <tr key={r}>
                <td className="pr-3 py-0.5 text-gray-600 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: rowColors[r] ?? "#94a3b8" }} />
                    {rowLabels[r] ?? r}
                  </span>
                </td>
                {cells.map((v, i) => (
                  <td key={visCols[i]} className={`pl-3 py-0.5 text-right font-semibold whitespace-nowrap ${v ? "text-gray-900" : "text-gray-300"}`}>
                    {fmt(v)}
                  </td>
                ))}
                {withTotal && (
                  <td className="pl-3 py-0.5 text-right font-bold text-indigo-600 whitespace-nowrap">
                    {fmt(cells.reduce((s, v) => s + v, 0))}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function YoyMatrixChart({
  data, rows, rowColors, rowLabels, cols, colLabels, colStyles,
  hiddenRows, hiddenCols, unit, showTotal, syncId, height = 260,
}: Props) {
  const isWon = unit === "won";
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} syncId={syncId} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 11, fill: "#6b7280" }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          tickFormatter={isWon ? fmtWonTick : undefined}
          width={isWon ? 56 : 28}
        />
        <Tooltip
          content={
            <MatrixTooltip
              rows={rows} rowColors={rowColors} rowLabels={rowLabels}
              cols={cols} colLabels={colLabels} colStyles={colStyles}
              unit={unit} showTotal={showTotal}
            />
          }
        />
        {rows.flatMap((r) =>
          cols.map((c) => {
            const color = rowColors[r] ?? "#94a3b8";
            const { dash, dot = "filled" } = colStyles[c] ?? {};
            return (
              <Line
                key={seriesKey(r, c)}
                type="monotone"
                dataKey={seriesKey(r, c)}
                name={`${rowLabels[r] ?? r} ${colLabels[c] ?? c}`}
                stroke={color}
                strokeWidth={2}
                strokeDasharray={dash}
                dot={
                  dot === "none" ? false
                  : dot === "hollow" ? { r: 3, fill: "#fff", stroke: color, strokeWidth: 1.5, strokeDasharray: "none" }
                  : { r: 3, fill: color, strokeWidth: 0 }
                }
                activeDot={{ r: 5 }}
                hide={(hiddenRows?.has(r) ?? false) || (hiddenCols?.has(c) ?? false)}
              />
            );
          })
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
