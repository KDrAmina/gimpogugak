"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import nextDynamic from "next/dynamic";
import type { MonthlyChartData } from "@/components/StatsChart";
import type { PieData } from "@/components/StatsDonut";

const StatsChart = nextDynamic(() => import("@/components/StatsChart"), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-[340px]"><p className="text-gray-400 text-sm animate-pulse">차트 로딩 중...</p></div>,
});
const StatsDonut = nextDynamic(() => import("@/components/StatsDonut"), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-[240px]"><p className="text-gray-400 text-sm animate-pulse">로딩 중...</p></div>,
});

// ── 타입 ─────────────────────────────────────────────────────────────────
interface ProfileInner { name: string; phone: string | null; }
interface LessonInner { tuition_amount: number; category: string; profiles: ProfileInner | null; }
interface LessonHistoryRow {
  completed_date?: string;
  tuition_snapshot: number;
  prepaid_month: string | null;
  lessons: LessonInner | null;
}
interface ExternalRow { income_date: string; amount: number; type: string; }
interface ActiveLesson { category: string; tuition_amount: number; }

// ── 유틸 ─────────────────────────────────────────────────────────────────
function getLast12Months(): string[] {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const result: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    result.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return result;
}
function labelMonth(ym: string): string {
  const [y, m] = ym.split("-");
  return `${String(parseInt(y)).slice(2)}년 ${parseInt(m)}월`;
}
function fmtAmount(n: number): string {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`;
  if (n >= 10000) return `${Math.round(n / 10000).toLocaleString()}만`;
  return n.toLocaleString();
}
function fmtSign(n: number): string {
  return n >= 0 ? `+${n.toFixed(1)}%` : `${n.toFixed(1)}%`;
}
function tuitionOf(r: LessonHistoryRow): number {
  return r.tuition_snapshot > 0 ? r.tuition_snapshot : (r.lessons?.tuition_amount ?? 0);
}
function monthRange(ym: string): [string, string] {
  const [y, m] = ym.split("-");
  const nm = parseInt(m) + 1;
  return [
    `${y}-${m.padStart(2, "0")}-01`,
    nm > 12 ? `${parseInt(y) + 1}-01-01` : `${y}-${String(nm).padStart(2, "0")}-01`,
  ];
}

const CATEGORY_LABELS: Record<string, string> = {
  어린이개인: "어린이 개인",
  어린이단체: "어린이 단체",
  성인개인: "성인 개인",
  성인단체: "성인 단체",
};
const CATEGORY_COLORS: Record<string, string> = {
  어린이개인: "#6366f1",
  어린이단체: "#22c55e",
  성인개인: "#f59e0b",
  성인단체: "#ef4444",
};
const EXTERNAL_COLORS: Record<string, string> = {
  체험비: "#f59e0b",
  강사수수료: "#8b5cf6",
  기타: "#6b7280",
  외부강의: "#3b82f6",
};

// ── 메인 페이지 ──────────────────────────────────────────────────────────
export default function StatisticsPage() {
  const supabase = createClient();
  const months = useMemo(() => getLast12Months(), []);
  const [loading, setLoading] = useState(true);
  const [chartRows, setChartRows] = useState<LessonHistoryRow[]>([]);
  const [externalRows, setExternalRows] = useState<ExternalRow[]>([]);
  const [vipRows, setVipRows] = useState<LessonHistoryRow[]>([]);
  const [activeLesson, setActiveLesson] = useState<ActiveLesson[]>([]);

  useEffect(() => { fetchAll(); }, []); // eslint-disable-line

  async function fetchAll() {
    const startDate = months[0] + "-01";
    const [{ data: reg }, { data: pre }, { data: ext }, { data: all }, { data: active }] =
      await Promise.all([
        supabase.from("lesson_history")
          .select("completed_date,tuition_snapshot,prepaid_month,lessons!inner(tuition_amount,category,profiles!inner(name,phone))")
          .gte("completed_date", startDate).is("prepaid_month", null).eq("status", "결제 완료").limit(5000),
        supabase.from("lesson_history")
          .select("completed_date,tuition_snapshot,prepaid_month,lessons!inner(tuition_amount,category,profiles!inner(name,phone))")
          .in("prepaid_month", months).eq("status", "결제 완료").limit(5000),
        supabase.from("external_income")
          .select("income_date,amount,type").gte("income_date", startDate).limit(5000),
        supabase.from("lesson_history")
          .select("tuition_snapshot,prepaid_month,lessons!inner(tuition_amount,category,profiles!inner(name,phone))")
          .eq("status", "결제 완료").limit(10000),
        supabase.from("lessons")
          .select("category,tuition_amount").eq("is_active", true).limit(500),
      ]);

    setChartRows([
      ...((reg as unknown as LessonHistoryRow[]) ?? []),
      ...((pre as unknown as LessonHistoryRow[]) ?? []),
    ]);
    setExternalRows((ext as unknown as ExternalRow[]) ?? []);
    setVipRows((all as unknown as LessonHistoryRow[]) ?? []);
    setActiveLesson((active as unknown as ActiveLesson[]) ?? []);
    setLoading(false);
  }

  // ── 월별 집계 ─────────────────────────────────────────────────────────
  const monthlyData = useMemo((): MonthlyChartData[] => {
    return months.map((ym) => {
      const [start, end] = monthRange(ym);
      const tuition = chartRows
        .filter((r) => r.prepaid_month === null ? (r.completed_date ?? "") >= start && (r.completed_date ?? "") < end : r.prepaid_month === ym)
        .reduce((s, r) => s + tuitionOf(r), 0);
      const external = externalRows
        .filter((r) => r.income_date >= start && r.income_date < end)
        .reduce((s, r) => s + r.amount, 0);
      return { month: labelMonth(ym), tuition, external };
    });
  }, [months, chartRows, externalRows]);

  // ── 요약 카드 값 ──────────────────────────────────────────────────────
  const curr = monthlyData[monthlyData.length - 1];
  const prev = monthlyData[monthlyData.length - 2];
  const thisTotal = (curr?.tuition ?? 0) + (curr?.external ?? 0);
  const prevTotal = (prev?.tuition ?? 0) + (prev?.external ?? 0);
  const mom = prevTotal > 0 ? ((thisTotal - prevTotal) / prevTotal) * 100 : 0;
  const momPos = mom >= 0;

  const totalAnnual = monthlyData.reduce((s, d) => s + d.tuition + d.external, 0);
  const avgMonthly = monthlyData.length > 0 ? Math.round(totalAnnual / monthlyData.length) : 0;
  const bestMonth = [...monthlyData].sort((a, b) => (b.tuition + b.external) - (a.tuition + a.external))[0];
  const worstMonth = [...monthlyData].filter(d => d.tuition + d.external > 0).sort((a, b) => (a.tuition + a.external) - (b.tuition + b.external))[0];

  // ── 활성 수강생 카테고리별 ──────────────────────────────────────────────
  const categoryStats = useMemo(() => {
    const map = new Map<string, { count: number; monthlyTotal: number }>();
    for (const l of activeLesson) {
      const cat = l.category?.replace(/\s/g, "") ?? "기타";
      const prev2 = map.get(cat) ?? { count: 0, monthlyTotal: 0 };
      map.set(cat, { count: prev2.count + 1, monthlyTotal: prev2.monthlyTotal + l.tuition_amount });
    }
    return map;
  }, [activeLesson]);

  const totalActiveStudents = activeLesson.length;

  // ── 수입 구성 도넛 데이터 ─────────────────────────────────────────────
  const incomeBreakdown = useMemo((): PieData[] => {
    const totalTuition = monthlyData.reduce((s, d) => s + d.tuition, 0);
    const extByType = new Map<string, number>();
    for (const r of externalRows) {
      extByType.set(r.type, (extByType.get(r.type) ?? 0) + r.amount);
    }
    const result: PieData[] = [{ name: "수강료", value: totalTuition, color: "#3b82f6" }];
    extByType.forEach((val, key) => {
      result.push({ name: key, value: val, color: EXTERNAL_COLORS[key] ?? "#94a3b8" });
    });
    return result.filter((d) => d.value > 0);
  }, [monthlyData, externalRows]);

  // ── VIP Top 10 ────────────────────────────────────────────────────────
  const vip10 = useMemo(() => {
    const map = new Map<string, { name: string; phone: string | null; total: number }>();
    for (const row of vipRows) {
      const p = row.lessons?.profiles;
      if (!p?.name) continue;
      const prev2 = map.get(p.name) ?? { name: p.name, phone: p.phone, total: 0 };
      map.set(p.name, { ...prev2, total: prev2.total + tuitionOf(row) });
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [vipRows]);

  const yearRange = `${labelMonth(months[0])} ~ ${labelMonth(months[11])}`;
  const CATEGORIES = ["어린이개인", "어린이단체", "성인개인", "성인단체"];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">데이터 분석 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── 헤더 ── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">통계 대시보드</h1>
        <p className="text-gray-500 text-sm mt-1">최근 12개월 ({yearRange}) 재무 현황</p>
      </div>

      {/* ── 요약 카드 6개 ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-5 text-white shadow-lg xl:col-span-1">
          <p className="text-blue-100 text-xs font-medium">이번 달 총매출</p>
          <p className="text-2xl font-bold mt-2">{fmtAmount(thisTotal)}원</p>
          <p className="text-blue-200 text-xs mt-1">{labelMonth(months[11])}</p>
        </div>

        <div className={`rounded-2xl p-5 shadow-lg text-white ${momPos ? "bg-gradient-to-br from-emerald-500 to-emerald-600" : "bg-gradient-to-br from-rose-500 to-rose-600"}`}>
          <p className="text-white/80 text-xs font-medium">전월 대비 증감</p>
          <p className="text-2xl font-bold mt-2">{fmtSign(mom)}</p>
          <p className="text-white/70 text-xs mt-1">전월 {fmtAmount(prevTotal)}원</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <p className="text-gray-500 text-xs font-medium">이번 달 수강료</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{fmtAmount(curr?.tuition ?? 0)}원</p>
          <div className="flex items-center gap-1 mt-1"><span className="w-2 h-2 rounded-full bg-blue-500" /><span className="text-xs text-gray-400">정규수업</span></div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <p className="text-gray-500 text-xs font-medium">이번 달 외부수입</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{fmtAmount(curr?.external ?? 0)}원</p>
          <div className="flex items-center gap-1 mt-1"><span className="w-2 h-2 rounded-full bg-amber-400" /><span className="text-xs text-gray-400">체험비·수수료·기타</span></div>
        </div>

        <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-5 text-white shadow-lg">
          <p className="text-white/80 text-xs font-medium">활성 수강생</p>
          <p className="text-2xl font-bold mt-2">{totalActiveStudents}<span className="text-base font-normal ml-1">명</span></p>
          <p className="text-white/70 text-xs mt-1">현재 등록 수업 기준</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <p className="text-gray-500 text-xs font-medium">월 평균 매출</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{fmtAmount(avgMonthly)}원</p>
          <p className="text-xs text-gray-400 mt-1">최근 12개월 평균</p>
        </div>
      </div>

      {/* ── 하이라이트 배너 ── */}
      {(bestMonth || worstMonth) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {bestMonth && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-4">
              <span className="text-3xl">🏆</span>
              <div>
                <p className="text-xs text-amber-600 font-medium">12개월 최고 매출월</p>
                <p className="font-bold text-amber-900">{bestMonth.month} — {fmtAmount(bestMonth.tuition + bestMonth.external)}원</p>
                <p className="text-xs text-amber-700">수강료 {fmtAmount(bestMonth.tuition)} · 외부 {fmtAmount(bestMonth.external)}</p>
              </div>
            </div>
          )}
          {worstMonth && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-4">
              <span className="text-3xl">📉</span>
              <div>
                <p className="text-xs text-blue-600 font-medium">12개월 최저 매출월</p>
                <p className="font-bold text-blue-900">{worstMonth.month} — {fmtAmount(worstMonth.tuition + worstMonth.external)}원</p>
                <p className="text-xs text-blue-700">수강료 {fmtAmount(worstMonth.tuition)} · 외부 {fmtAmount(worstMonth.external)}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 월별 차트 + 수입 구성 도넛 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">월별 매출 추이</h2>
              <p className="text-gray-400 text-sm mt-0.5">최근 12개월 수강료 + 외부수입 누적 막대</p>
            </div>
            <div className="text-sm sm:text-right">
              <p className="text-gray-500">12개월 합산</p>
              <p className="text-xl font-bold text-gray-900">{fmtAmount(totalAnnual)}원</p>
            </div>
          </div>
          <StatsChart data={monthlyData} />
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">수입 구성 분석</h2>
          <p className="text-gray-400 text-sm mb-4">12개월 수입 유형별 비중</p>
          <StatsDonut data={incomeBreakdown} />
        </div>
      </div>

      {/* ── 수강생 카테고리 현황 ── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">수강생 카테고리 현황</h2>
        <p className="text-gray-400 text-sm mb-5">현재 활성 수업 기준 카테고리별 인원 및 월 수강료</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {CATEGORIES.map((cat) => {
            const stats = categoryStats.get(cat) ?? { count: 0, monthlyTotal: 0 };
            const pct = totalActiveStudents > 0 ? Math.round((stats.count / totalActiveStudents) * 100) : 0;
            const color = CATEGORY_COLORS[cat] ?? "#94a3b8";
            return (
              <div key={cat} className="rounded-xl border border-gray-100 bg-gray-50 p-4 hover:bg-gray-100 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">{CATEGORY_LABELS[cat] ?? cat}</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full text-white" style={{ background: color }}>
                    {stats.count}명
                  </span>
                </div>
                <p className="text-xl font-bold text-gray-900 mb-2">{fmtAmount(stats.monthlyTotal)}원</p>
                <p className="text-xs text-gray-400 mb-2">월 수강료 합계</p>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                </div>
                <p className="text-xs text-gray-400 mt-1">전체 수강생의 {pct}%</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── VIP TOP 10 ── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-gray-900">누적 VIP 수강생 TOP 10</h2>
          <p className="text-gray-400 text-sm mt-0.5">전체 기간 결제 총액 순위</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-3 px-3 text-gray-400 font-medium w-12">순위</th>
                <th className="text-left py-3 px-3 text-gray-400 font-medium">이름</th>
                <th className="text-left py-3 px-3 text-gray-400 font-medium">연락처</th>
                <th className="text-right py-3 px-3 text-gray-400 font-medium">누적 결제액</th>
                <th className="py-3 px-3 text-gray-400 font-medium w-36 hidden sm:table-cell">비중</th>
              </tr>
            </thead>
            <tbody>
              {vip10.map((v, i) => {
                const maxT = vip10[0]?.total ?? 1;
                const pct = Math.round((v.total / maxT) * 100);
                const medal = ["🥇","🥈","🥉"][i] ?? null;
                return (
                  <tr key={v.name + i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-3.5 px-3">{medal ? <span className="text-lg">{medal}</span> : <span className="text-gray-400 font-medium">{i + 1}</span>}</td>
                    <td className="py-3.5 px-3 font-medium text-gray-900">{v.name}</td>
                    <td className="py-3.5 px-3 text-gray-500 font-mono text-xs">{v.phone ?? "—"}</td>
                    <td className="py-3.5 px-3 text-right font-bold text-gray-900">{v.total.toLocaleString()}원</td>
                    <td className="py-3.5 px-3 hidden sm:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                          <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-gray-400 text-xs w-8 text-right">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {vip10.length === 0 && (
                <tr><td colSpan={5} className="py-12 text-center text-gray-400">데이터 없음</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}