import type { LineStyle } from "@/lib/yoy-chart";

/** 선 스타일 범례 아이콘 (실선/점선, 채운 점/빈 점) — 토글 칩·YoY 툴팁 헤더 공용 */
export default function LineStyleKey({ dash, dot = "filled", color = "#6b7280", bg = "#fff" }: LineStyle & { color?: string; bg?: string }) {
  return (
    <svg width="22" height="8" aria-hidden="true" className="shrink-0">
      <line x1="1" y1="4" x2="21" y2="4" stroke={color} strokeWidth="2" strokeDasharray={dash} />
      {dot !== "none" && (
        <circle cx="11" cy="4" r="3" fill={dot === "hollow" ? bg : color} stroke={color} strokeWidth={dot === "hollow" ? 1.5 : 0} />
      )}
    </svg>
  );
}
