"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import nextDynamic from "next/dynamic";
import type { MonthlyChartData } from "@/components/StatsChart";
import type { PieData } from "@/components/StatsDonut";
import type { LineData } from "@/components/StatsLine";

function Loader({ h }: { h: number }) {
  return <div className="flex items-center justify-center" style={{ height: h }}><p className="text-gray-400 text-sm animate-pulse">차트 로딩 중...</p></div>;
}
const StatsChart = nextDynamic(() => import("@/components/StatsChart"), { ssr: false, loading: () => <Loader h={340} /> });
const StatsDonut = nextDynamic(() => import("@/components/StatsDonut"), { ssr: false, loading: () => <Loader h={260} /> });
const StatsLine  = nextDynamic(() => import("@/components/StatsLine"),  { ssr: false, loading: () => <Loader h={300} /> });

// ── 타입 ──────────────────────────────────────────────────────────────
interface ProfileInner { name: string; phone: string | null; }
interface LessonInner  { tuition_amount: number; category: string; is_active?: boolean; profiles: ProfileInner | null; }
interface HistoryRow   { completed_date?: string; tuition_snapshot: number; prepaid_month: string | null; lessons: LessonInner | null; }
interface ExternalRow  { income_date: string; amount: number; type: string; }
interface ActiveLesson { category: string; tuition_amount: number; }

// ── 기간 필터 옵션 (2023~2026 + 전체 기간) ───────────────────────────
const YEAR_OPTIONS = [
  { value: "all",  label: "전체 기간" },
  { value: "2023", label: "2023년" },
  { value: "2024", label: "2024년" },
  { value: "2025", label: "2025년" },
  { value: "2026", label: "2026년" },
];

// ── 유틸 ──────────────────────────────────────────────────────────────
function fmtAmount(n: number): string {
  if (n >= 100000000) return (n / 100000000).toFixed(1) + "억";
  if (n >= 10000) return Math.round(n / 10000).toLocaleString() + "만";
  return n.toLocaleString();
}
function fmtSign(n: number): string { return n >= 0 ? "+" + n.toFixed(1) + "%" : n.toFixed(1) + "%"; }
function tuitionOf(r: HistoryRow): number { return r.tuition_snapshot > 0 ? r.tuition_snapshot : (r.lessons?.tuition_amount ?? 0); }

// 선납 결제는 prepaid_month 기준, 일반 결제는 completed_date 앞 7자(YYYY-MM)
function getEff(r: HistoryRow): string | null { return r.prepaid_month ?? r.completed_date?.substring(0, 7) ?? null; }

// period = "2024"(year) or "2024-03"(month) → [start, end) 날짜 문자열
function getPeriodRange(period: string, type: "year" | "month"): [string, string] {
  if (type === "year") return [period + "-01-01", (parseInt(period) + 1) + "-01-01"];
  const y = period.substring(0, 4); const m = parseInt(period.substring(5)); const nm = m + 1;
  return [y + "-" + String(m).padStart(2, "0") + "-01",
    nm > 12 ? (parseInt(y) + 1) + "-01-01" : y + "-" + String(nm).padStart(2, "0") + "-01"];
}

// 차트 x축 레이블: year mode="23년" / month mode="25년 4월"
function makePeriodLabel(period: string, type: "year" | "month"): string {
  if (type === "year") return period.slice(2) + "년";
  return String(parseInt(period.substring(0, 4))).slice(2) + "년 " + parseInt(period.substring(5)) + "월";
}

const CATEGORY_LABELS: Record<string, string> = { "어린이개인": "어린이 개인", "어린이단체": "어린이 단체", "성인개인": "성인 개인", "성인단체": "성인 단체" };
const CATEGORY_COLORS: Record<string, string> = { "어린이개인": "#6366f1", "어린이단체": "#22c55e", "성인개인": "#f59e0b", "성인단체": "#ef4444" };
const EXTERNAL_COLORS: Record<string, string> = { "체험비": "#f59e0b", "강사수수료": "#8b5cf6", "기타": "#6b7280" };
const CATEGORIES = ["어린이개인", "어린이단체", "성인개인", "성인단체"];

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────
export default function StatisticsPage() {
  const supabase = createClient();

  // 기간 필터 state — 기본값 전체 기간
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [loading, setLoading]       = useState(true);
  // 전체 데이터를 한 번만 fetch → 이후 클라이언트 측에서 selectedYear로 필터링
  const [allHistory, setAllHistory]   = useState<HistoryRow[]>([]);
  const [allExternal, setAllExternal] = useState<ExternalRow[]>([]);
  const [activeLesson, setActiveLesson] = useState<ActiveLesson[]>([]);

  useEffect(() => { fetchAll(); }, []); // eslint-disable-line

  async function fetchAll() {
    const [{ data: hist }, { data: ext }, { data: active }] = await Promise.all([
      // 전체 결제이력 (날짜 필터 없음) — is_active, profiles 포함
      supabase.from("lesson_history")
        .select("completed_date,tuition_snapshot,prepaid_month,lessons!inner(tuition_amount,category,is_active,profiles!inner(name,phone))")
        .eq("status", "결제 완료").limit(10000),
      // 전체 외부수입 (날짜 필터 없음) — income_date, amount, type 포함
      supabase.from("external_income").select("income_date,amount,type").limit(5000),
      // 현재 활성 수업 (카테고리 현황 전용)
      supabase.from("lessons").select("category,tuition_amount").eq("is_active", true).limit(500),
    ]);
    setAllHistory((hist as unknown as HistoryRow[]) ?? []);
    setAllExternal((ext as unknown as ExternalRow[]) ?? []);
    setActiveLesson((active as unknown as ActiveLesson[]) ?? []);
    setLoading(false);
  }

  // ── 선택 기간에 따라 periods 배열 생성 ─────────────────────────────
  // "all" → 연도별 4개 ["2023","2024","2025","2026"]
  // 특정 연도 → 해당 연도 12개 월 ["2024-01", ..., "2024-12"]
  const { periods, periodType } = useMemo<{ periods: string[]; periodType: "year" | "month" }>(() => {
    if (selectedYear === "all") return { periods: ["2023","2024","2025","2026"], periodType: "year" };
    const ms: string[] = [];
    for (let m = 1; m <= 12; m++) ms.push(selectedYear + "-" + String(m).padStart(2, "0"));
    return { periods: ms, periodType: "month" };
  }, [selectedYear]);

  // ── 기간별 차트 데이터 (StatsChart props용) ─────────────────────────
  // selectedYear 변경 → periods 변경 → periodChartData 재계산 → StatsChart 리렌더링
  const periodChartData = useMemo((): MonthlyChartData[] => {
    return periods.map((period) => {
      const [start, end] = getPeriodRange(period, periodType);
      // allHistory에서 유효 결제월(prepaid_month or completed_date)이 [start, end) 에 속하는 것 집계
      const tuition = allHistory
        .filter((r) => { const e = getEff(r); return !!e && (e + "-01") >= start && (e + "-01") < end; })
        .reduce((s, r) => s + tuitionOf(r), 0);
      // allExternal에서 income_date가 [start, end) 에 속하는 것 집계
      const external = allExternal
        .filter((r) => r.income_date >= start && r.income_date < end)
        .reduce((s, r) => s + r.amount, 0);
      return { month: makePeriodLabel(period, periodType), tuition, external };
    });
  }, [periods, periodType, allHistory, allExternal]);

  // ── 학생별 종합 통계 맵 (전체 기간 기준 — 필터 무관) ──────────────
  // key: 학생 이름 / value: 첫 결제월, 마지막 결제월, 활성여부, 누적금액, 전화번호
  // 신규/이탈 분석 · VIP · 평균유지기간에 공통 사용
  const studentStats = useMemo(() => {
    const map = new Map<string, { firstMonth: string; lastMonth: string; isActive: boolean; total: number; phone: string | null }>();
    for (const row of allHistory) {
      const prof = row.lessons?.profiles;
      if (!prof?.name) continue;
      const eff = getEff(row);
      if (!eff) continue;
      const isAct = row.lessons?.is_active ?? false;
      const prev  = map.get(prof.name);
      if (!prev) {
        map.set(prof.name, { firstMonth: eff, lastMonth: eff, isActive: isAct, total: tuitionOf(row), phone: prof.phone });
      } else {
        map.set(prof.name, {
          firstMonth: eff < prev.firstMonth ? eff : prev.firstMonth,
          lastMonth:  eff > prev.lastMonth  ? eff : prev.lastMonth,
          isActive:   isAct || prev.isActive,
          total:      prev.total + tuitionOf(row),
          phone:      prof.phone ?? prev.phone,
        });
      }
    }
    return map;
  }, [allHistory]);

  // ── 기간별 신규 유입 / 이탈 (StatsLine props용) ──────────────────────
  // 신규: 해당 기간에 첫 결제가 시작된 학생
  // 이탈: is_active=false이고 마지막 결제가 해당 기간인 학생
  // periodType에 따라 firstMonth/lastMonth를 연도 or 월 단위로 변환해 집계
  const periodStudentFlow = useMemo((): LineData[] => {
    const newMap   = new Map<string, number>();
    const churnMap = new Map<string, number>();
    for (const [, s] of studentStats) {
      const fp = periodType === "year" ? s.firstMonth.substring(0, 4) : s.firstMonth;
      const lp = periodType === "year" ? s.lastMonth.substring(0, 4)  : s.lastMonth;
      if (periods.includes(fp)) newMap.set(fp, (newMap.get(fp) ?? 0) + 1);
      if (!s.isActive && periods.includes(lp)) churnMap.set(lp, (churnMap.get(lp) ?? 0) + 1);
    }
    // periodChartData와 동일한 레이블 순서 유지
    return periodChartData.map((d, i) => ({
      month: d.month, new: newMap.get(periods[i]) ?? 0, churned: churnMap.get(periods[i]) ?? 0,
    }));
  }, [studentStats, periods, periodType, periodChartData]);

  // ── VIP TOP 10 (selectedYear 기간 내 결제 총액 기준) ────────────────
  // selectedYear 변경 시 allHistory를 재필터링해 리렌더링
  const periodVip10 = useMemo(() => {
    const map = new Map<string, { name: string; phone: string | null; total: number }>();
    for (const row of allHistory) {
      const eff = getEff(row);
      if (!eff) continue;
      // selectedYear !== "all"이면 해당 연도에 속하는 결제만 포함
      if (selectedYear !== "all" && !eff.startsWith(selectedYear)) continue;
      const prof = row.lessons?.profiles;
      if (!prof?.name) continue;
      const prev2 = map.get(prof.name) ?? { name: prof.name, phone: prof.phone, total: 0 };
      map.set(prof.name, { ...prev2, total: prev2.total + tuitionOf(row) });
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [allHistory, selectedYear]);

  // ── 수입 구성 도넛 (StatsDonut props용, 선택 기간 기준) ────────────
  // periodChartData에서 수강료 합산, allExternal에서 외부수입 type별 합산
  const incomeBreakdown = useMemo((): PieData[] => {
    const tuit = periodChartData.reduce((s, d) => s + d.tuition, 0);
    const filteredExt = selectedYear === "all" ? allExternal : allExternal.filter(r => r.income_date.startsWith(selectedYear));
    const extByType = new Map<string, number>();
    for (const r of filteredExt) extByType.set(r.type, (extByType.get(r.type) ?? 0) + r.amount);
    const result: PieData[] = [{ name: "수강료", value: tuit, color: "#3b82f6" }];
    extByType.forEach((val, key) => result.push({ name: key, value: val, color: EXTERNAL_COLORS[key] ?? "#94a3b8" }));
    return result.filter((d) => d.value > 0);
  }, [periodChartData, allExternal, selectedYear]);

  // ── 외부수입 파이프라인 (type별 그룹핑, 선택 기간 기준) ─────────────
  const extPipelineData = useMemo((): PieData[] => {
    const filtered = selectedYear === "all" ? allExternal : allExternal.filter(r => r.income_date.startsWith(selectedYear));
    const map = new Map<string, number>();
    for (const r of filtered) { if (r.type) map.set(r.type, (map.get(r.type) ?? 0) + r.amount); }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value, color: EXTERNAL_COLORS[name] ?? "#94a3b8" }))
      .filter(d => d.value > 0).sort((a, b) => b.value - a.value);
  }, [allExternal, selectedYear]);
  const extPipelineTotal = extPipelineData.reduce((s, d) => s + d.value, 0);

  // ── 전년 대비 증감 ────────────────────────────────────────────────
  // "all" → 25년 vs 24년 비교 / 특정 연도 → 해당 연도 vs 전년도 비교
  const { yoyPct, yoyPos, yoyPrevTotal, yoyCompLabel } = useMemo(() => {
    const compareYear = selectedYear === "all" ? "2025" : selectedYear;
    const prevYear = String(parseInt(compareYear) - 1);
    const sumYear = (yr: string) =>
      allHistory.filter(r => { const e = getEff(r); return !!e && e.startsWith(yr); }).reduce((s, r) => s + tuitionOf(r), 0)
      + allExternal.filter(r => r.income_date.startsWith(yr)).reduce((s, r) => s + r.amount, 0);
    const currT = sumYear(compareYear), prevT = sumYear(prevYear);
    return { yoyPct: prevT > 0 ? ((currT - prevT) / prevT) * 100 : 0, yoyPos: currT >= prevT,
             yoyPrevTotal: prevT, yoyCompLabel: prevYear + "년 대비" };
  }, [selectedYear, allHistory, allExternal]);

  // ── 평균 수강 유지 기간 (전체 기간 기준 — 필터 무관) ─────────────
  const avgDuration = useMemo(() => {
    const durs: number[] = [];
    for (const [, s] of studentStats) {
      if (s.isActive) continue;
      const fp = s.firstMonth.split("-").map(Number), lp = s.lastMonth.split("-").map(Number);
      const d = (lp[0] - fp[0]) * 12 + (lp[1] - fp[1]) + 1;
      if (d >= 1 && d <= 60) durs.push(d);
    }
    return durs.length > 0 ? durs.reduce((a, b) => a + b, 0) / durs.length : 0;
  }, [studentStats]);

  // ── 수강생 카테고리 현황 (항상 활성 수업 기준 — 필터 무관) ─────────
  const categoryStats = useMemo(() => {
    const map = new Map<string, { count: number; monthlyTotal: number }>();
    for (const l of activeLesson) {
      const cat = l.category?.replace(/\s/g, "") ?? "기타";
      const p2 = map.get(cat) ?? { count: 0, monthlyTotal: 0 };
      map.set(cat, { count: p2.count + 1, monthlyTotal: p2.monthlyTotal + l.tuition_amount });
    }
    return map;
  }, [activeLesson]);
  const totalActiveStudents = activeLesson.length;

  // ── 파생 값 ──────────────────────────────────────────────────────
  const periodTuition  = periodChartData.reduce((s, d) => s + d.tuition, 0);
  const periodExtTotal = periodChartData.reduce((s, d) => s + d.external, 0);
  const periodTotal    = periodTuition + periodExtTotal;
  const periodAvg      = periodChartData.length > 0 ? Math.round(periodTotal / periodChartData.length) : 0;
  const avgLabel       = selectedYear === "all" ? "연 평균 매출" : "월 평균 매출";
  const avgSubLabel    = selectedYear === "all" ? "4개년 평균" : selectedYear + "년 월 평균";
  const totalNewPeriod = periodStudentFlow.reduce((s, d) => s + d.new, 0);
  const bestPeriod     = [...periodChartData].sort((a, b) => (b.tuition+b.external)-(a.tuition+a.external))[0];
  const worstPeriod    = [...periodChartData].filter(d => d.tuition+d.external > 0).sort((a, b) => (a.tuition+a.external)-(b.tuition+b.external))[0];
  const hlLabel        = selectedYear === "all" ? "연도" : "월";
  const periodRangeLabel = selectedYear === "all" ? "2023 ~ 2026년 전체" : selectedYear + "년 1월 ~ 12월";
  const chartSubtitle  = selectedYear === "all" ? "연도별 수강료 + 외부수입" : selectedYear + "년 월별 수강료 + 외부수입";

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

      {/* ── 헤더 + 기간 필터 토글 ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">통계 대시보드</h1>
          <p className="text-gray-500 text-sm mt-1">{periodRangeLabel} 재무 현황</p>
        </div>
        {/* 기간 필터 — 클릭 시 selectedYear 변경 → 모든 차트/카드 즉시 리렌더링 */}
        <div className="flex flex-wrap gap-2">
          {YEAR_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSelectedYear(opt.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                selectedYear === opt.value
                  ? "bg-blue-600 text-white shadow-md scale-105"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 요약 카드 8개 (2행 × 4열) — 모두 selectedYear 기준으로 업데이트 ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-5 text-white shadow-lg">
          <p className="text-blue-100 text-xs font-medium">{selectedYear === "all" ? "전체 기간 총매출" : selectedYear + "년 총매출"}</p>
          <p className="text-2xl font-bold mt-2">{fmtAmount(periodTotal)}원</p>
          <p className="text-blue-200 text-xs mt-1">{periodRangeLabel}</p>
        </div>
        {/* 전년 대비 증감: all이면 25년vs24년, 특정 연도면 해당vs전년 */}
        <div className={`rounded-2xl p-5 shadow-lg text-white ${yoyPos ? "bg-gradient-to-br from-emerald-500 to-emerald-600" : "bg-gradient-to-br from-rose-500 to-rose-600"}`}>
          <p className="text-white/80 text-xs font-medium">{yoyCompLabel}</p>
          <p className="text-2xl font-bold mt-2">{fmtSign(yoyPct)}</p>
          <p className="text-white/70 text-xs mt-1">전년 {fmtAmount(yoyPrevTotal)}원</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <p className="text-gray-500 text-xs font-medium">기간 수강료</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{fmtAmount(periodTuition)}원</p>
          <div className="flex items-center gap-1 mt-1"><span className="w-2 h-2 rounded-full bg-blue-500" /><span className="text-xs text-gray-400">정규수업 합계</span></div>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <p className="text-gray-500 text-xs font-medium">기간 외부수입</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{fmtAmount(periodExtTotal)}원</p>
          <div className="flex items-center gap-1 mt-1"><span className="w-2 h-2 rounded-full bg-amber-400" /><span className="text-xs text-gray-400">체험비·수수료·기타</span></div>
        </div>
        <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-5 text-white shadow-lg">
          <p className="text-white/80 text-xs font-medium">활성 수강생</p>
          <p className="text-2xl font-bold mt-2">{totalActiveStudents}<span className="text-base font-normal ml-1">명</span></p>
          <p className="text-white/70 text-xs mt-1">현재 등록 수업 기준</p>
        </div>
        {/* 월/연 평균: selectedYear가 all이면 연 평균, 특정 연도면 월 평균 */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <p className="text-gray-500 text-xs font-medium">{avgLabel}</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{fmtAmount(periodAvg)}원</p>
          <p className="text-xs text-gray-400 mt-1">{avgSubLabel}</p>
        </div>
        <div className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl p-5 text-white shadow-lg">
          <p className="text-white/80 text-xs font-medium">평균 수강 유지 기간</p>
          <p className="text-2xl font-bold mt-2">{avgDuration.toFixed(1)}<span className="text-base font-normal ml-1">개월</span></p>
          <p className="text-white/70 text-xs mt-1">종료 수업 전체 기준</p>
        </div>
        {/* 신규 유입: 선택 기간 내 첫 결제 학생 수 */}
        <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl p-5 text-white shadow-lg">
          <p className="text-white/80 text-xs font-medium">기간 신규 유입</p>
          <p className="text-2xl font-bold mt-2">{totalNewPeriod}<span className="text-base font-normal ml-1">명</span></p>
          <p className="text-white/70 text-xs mt-1">{periodRangeLabel}</p>
        </div>
      </div>

      {/* ── 하이라이트 배너 (최고/최저 기간) ── */}
      {(bestPeriod || worstPeriod) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {bestPeriod && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-4">
              <span className="text-3xl">🏆</span>
              <div>
                <p className="text-xs text-amber-600 font-medium">최고 매출 {hlLabel}</p>
                <p className="font-bold text-amber-900">{bestPeriod.month} — {fmtAmount(bestPeriod.tuition + bestPeriod.external)}원</p>
                <p className="text-xs text-amber-700">수강료 {fmtAmount(bestPeriod.tuition)} · 외부 {fmtAmount(bestPeriod.external)}</p>
              </div>
            </div>
          )}
          {worstPeriod && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-4">
              <span className="text-3xl">📉</span>
              <div>
                <p className="text-xs text-slate-500 font-medium">최저 매출 {hlLabel}</p>
                <p className="font-bold text-slate-700">{worstPeriod.month} — {fmtAmount(worstPeriod.tuition + worstPeriod.external)}원</p>
                <p className="text-xs text-slate-500">수강료 {fmtAmount(worstPeriod.tuition)} · 외부 {fmtAmount(worstPeriod.external)}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 매출 추이 차트 + 수입 구성 도넛 ── */}
      {/* StatsChart data: periodChartData — selectedYear에 따라 연도별 or 월별 자동 전환 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">매출 추이</h2>
              <p className="text-gray-400 text-sm mt-0.5">{chartSubtitle}</p>
            </div>
            <div className="text-sm sm:text-right">
              <p className="text-gray-500">기간 합산</p>
              <p className="text-xl font-bold text-gray-900">{fmtAmount(periodTotal)}원</p>
            </div>
          </div>
          <StatsChart data={periodChartData} />
        </div>
        {/* StatsDonut data: incomeBreakdown — selectedYear 기준 필터링 */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">수입 구성 분석</h2>
          <p className="text-gray-400 text-sm mb-4">{selectedYear === "all" ? "전체 기간" : selectedYear + "년"} 수입 유형별 비중</p>
          <StatsDonut data={incomeBreakdown} />
        </div>
      </div>

      {/* ── 신규 유입 vs 이탈 추이 ── */}
      {/* StatsLine data: periodStudentFlow — selectedYear 기준 집계 */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">신규 유입 vs 이탈 추이</h2>
            <p className="text-gray-400 text-sm mt-0.5">{selectedYear === "all" ? "연도별" : selectedYear + "년 월별"} 첫 결제 학생 vs 수강 종료 학생</p>
          </div>
          <div className="flex gap-5 text-xs text-gray-500 flex-shrink-0">
            <span className="flex items-center gap-1.5"><span className="w-6 border-t-2 border-blue-500 inline-block" />신규 유입</span>
            <span className="flex items-center gap-1.5"><span className="w-6 border-t-2 border-dashed border-rose-400 inline-block" />이탈</span>
          </div>
        </div>
        <StatsLine data={periodStudentFlow} />
        <p className="text-xs text-gray-400 mt-4">※ 신규: 해당 기간 첫 결제 학생 / 이탈: is_active=false 수업의 마지막 결제 기준</p>
      </div>

      {/* ── 수강생 카테고리 현황 (항상 현재 활성 기준) ── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">수강생 카테고리 현황</h2>
        <p className="text-gray-400 text-sm mb-5">현재 활성 수업 기준 카테고리별 인원 및 월 수강료</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {CATEGORIES.map((cat) => {
            const st = categoryStats.get(cat) ?? { count: 0, monthlyTotal: 0 };
            const pct = totalActiveStudents > 0 ? Math.round((st.count / totalActiveStudents) * 100) : 0;
            const color = CATEGORY_COLORS[cat] ?? "#94a3b8";
            return (
              <div key={cat} className="rounded-xl border border-gray-100 bg-gray-50 p-4 hover:bg-gray-100 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">{CATEGORY_LABELS[cat] ?? cat}</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full text-white" style={{ background: color }}>{st.count}명</span>
                </div>
                <p className="text-xl font-bold text-gray-900 mb-2">{fmtAmount(st.monthlyTotal)}원</p>
                <p className="text-xs text-gray-400 mb-2">월 수강료 합계</p>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div className="h-1.5 rounded-full transition-all" style={{ width: pct + "%", background: color }} />
                </div>
                <p className="text-xs text-gray-400 mt-1">전체의 {pct}%</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 외부수입 파이프라인 (extPipelineData: selectedYear 기준 필터링) ── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">외부수입 파이프라인 분석</h2>
        <p className="text-gray-400 text-sm mb-6">{selectedYear === "all" ? "전체 기간" : selectedYear + "년"} 카테고리별 외부수입 비중 및 총액</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <StatsDonut data={extPipelineData} />
          <div className="space-y-4">
            {extPipelineData.map((d) => {
              const pct = extPipelineTotal > 0 ? Math.round((d.value / extPipelineTotal) * 100) : 0;
              return (
                <div key={d.name} className="flex items-start gap-3">
                  <span className="w-3 h-3 rounded-sm flex-shrink-0 mt-1" style={{ background: d.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-semibold text-gray-800">{d.name}</span>
                      <span className="text-sm font-bold text-gray-900">{d.value.toLocaleString()}원</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="h-2 rounded-full transition-all" style={{ width: pct + "%", background: d.color }} />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">외부수입의 {pct}%</p>
                  </div>
                </div>
              );
            })}
            {extPipelineData.length === 0 && <p className="text-gray-400 text-sm">데이터 없음</p>}
            <div className="border-t border-gray-100 pt-4 flex justify-between items-center">
              <span className="text-sm font-semibold text-gray-700">합계</span>
              <span className="text-lg font-bold text-gray-900">{extPipelineTotal.toLocaleString()}원</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── VIP TOP 10 (periodVip10: selectedYear 기간 내 결제 총액 기준) ── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-gray-900">VIP 수강생 TOP 10</h2>
          <p className="text-gray-400 text-sm mt-0.5">{selectedYear === "all" ? "전체 기간" : selectedYear + "년"} 결제 총액 순위</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-3 px-3 text-gray-400 font-medium w-12">순위</th>
                <th className="text-left py-3 px-3 text-gray-400 font-medium">이름</th>
                <th className="text-left py-3 px-3 text-gray-400 font-medium">연락처</th>
                <th className="text-right py-3 px-3 text-gray-400 font-medium">결제 총액</th>
                <th className="py-3 px-3 text-gray-400 font-medium w-36 hidden sm:table-cell">비중</th>
              </tr>
            </thead>
            <tbody>
              {periodVip10.map((v, i) => {
                const maxT = periodVip10[0]?.total ?? 1;
                const pct  = Math.round((v.total / maxT) * 100);
                const medal = ["🥇","🥈","🥉"][i] ?? null;
                return (
                  <tr key={v.name + i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-3.5 px-3">{medal ? <span className="text-lg">{medal}</span> : <span className="text-gray-400 font-medium">{i+1}</span>}</td>
                    <td className="py-3.5 px-3 font-medium text-gray-900">{v.name}</td>
                    <td className="py-3.5 px-3 text-gray-500 font-mono text-xs">{v.phone ?? "—"}</td>
                    <td className="py-3.5 px-3 text-right font-bold text-gray-900">{v.total.toLocaleString()}원</td>
                    <td className="py-3.5 px-3 hidden sm:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5"><div className="bg-blue-500 h-1.5 rounded-full" style={{ width: pct + "%" }} /></div>
                        <span className="text-gray-400 text-xs w-8 text-right">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {periodVip10.length === 0 && <tr><td colSpan={5} className="py-12 text-center text-gray-400">데이터 없음</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}