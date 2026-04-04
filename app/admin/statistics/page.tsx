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
const StatsArea  = nextDynamic(() => import("@/components/StatsArea"),  { ssr: false, loading: () => <Loader h={300} /> });
const StatsDonut = nextDynamic(() => import("@/components/StatsDonut"), { ssr: false, loading: () => <Loader h={260} /> });
const StatsLine  = nextDynamic(() => import("@/components/StatsLine"),  { ssr: false, loading: () => <Loader h={280} /> });

interface ProfileInner { name: string; phone: string | null; }
interface LessonInner  { tuition_amount: number; category: string; is_active?: boolean; profiles: ProfileInner | null; }
interface HistoryRow   { completed_date?: string; tuition_snapshot: number; prepaid_month: string | null; lessons: LessonInner | null; }
interface ExternalRow  { income_date: string; amount: number; type: string; }
interface ActiveLesson { category: string; tuition_amount: number; }
interface InflowProfile { name: string; phone: string | null; inflow_route: string | null; }

// 우리인력 → 민경임 이름 강제 치환
function normalizeName(name: string): string {
  return name === "우리인력" ? "민경임" : name;
}

const YEAR_OPTIONS = [
  { value: "all",  label: "전체 기간" },
  { value: "2023", label: "2023년" },
  { value: "2024", label: "2024년" },
  { value: "2025", label: "2025년" },
  { value: "2026", label: "2026년" },
];

const TARGET_YEAR = 60_000_000;
const TARGET_ALL  = 240_000_000;

function fmtAmount(n: number): string {
  if (n >= 100000000) return (n / 100000000).toFixed(1) + "억";
  if (n >= 10000) return Math.round(n / 10000).toLocaleString() + "만";
  return n.toLocaleString();
}
function fmtSign(n: number): string { return n >= 0 ? "+" + n.toFixed(1) + "%" : n.toFixed(1) + "%"; }
function tuitionOf(r: HistoryRow): number { return r.tuition_snapshot > 0 ? r.tuition_snapshot : (r.lessons?.tuition_amount ?? 0); }
function getEff(r: HistoryRow): string | null { return r.prepaid_month ?? r.completed_date?.substring(0, 7) ?? null; }
function getPeriodRange(period: string, type: "year" | "month"): [string, string] {
  if (type === "year") return [period + "-01-01", (parseInt(period) + 1) + "-01-01"];
  const y = period.substring(0, 4); const m = parseInt(period.substring(5)); const nm = m + 1;
  return [y + "-" + String(m).padStart(2, "0") + "-01",
    nm > 12 ? (parseInt(y) + 1) + "-01-01" : y + "-" + String(nm).padStart(2, "0") + "-01"];
}
function makePeriodLabel(period: string, type: "year" | "month"): string {
  if (type === "year") return period.slice(2) + "년";
  return String(parseInt(period.substring(0, 4))).slice(2) + "년 " + parseInt(period.substring(5)) + "월";
}

const CATEGORY_LABELS: Record<string, string> = { "어린이개인": "어린이 개인", "어린이단체": "어린이 단체", "성인개인": "성인 개인", "성인단체": "성인 단체" };
const CATEGORY_COLORS: Record<string, string> = { "어린이개인": "#6366f1", "어린이단체": "#22c55e", "성인개인": "#f59e0b", "성인단체": "#ef4444" };
const EXTERNAL_COLORS: Record<string, string> = { "체험비": "#f59e0b", "강사수수료": "#8b5cf6", "기타": "#6b7280", "공연비": "#10b981" };
const CATEGORIES = ["어린이개인", "어린이단체", "성인개인", "성인단체"];
export default function StatisticsPage() {
  const supabase = createClient();
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [loading, setLoading]           = useState(true);
  const [allHistory, setAllHistory]     = useState<HistoryRow[]>([]);
  const [allExternal, setAllExternal]   = useState<ExternalRow[]>([]);
  const [activeLesson, setActiveLesson] = useState<ActiveLesson[]>([]);
  const [inflowProfiles, setInflowProfiles] = useState<InflowProfile[]>([]);

  useEffect(() => { fetchAll(); }, []); // eslint-disable-line

  async function fetchAll() {
    const [{ data: hist }, { data: ext }, { data: active }, { data: inflow }] = await Promise.all([
      supabase.from("lesson_history")
        .select("completed_date,tuition_snapshot,prepaid_month,lessons!inner(tuition_amount,category,is_active,profiles!inner(name,phone))")
        .eq("status", "결제 완료").limit(10000),
      supabase.from("external_income").select("income_date,amount,type").limit(5000),
      supabase.from("lessons").select("category,tuition_amount").eq("is_active", true).limit(500),
      supabase.from("profiles").select("name,phone,inflow_route").limit(1000),
    ]);
    setAllHistory((hist as unknown as HistoryRow[]) ?? []);
    setAllExternal((ext as unknown as ExternalRow[]) ?? []);
    setActiveLesson((active as unknown as ActiveLesson[]) ?? []);
    setInflowProfiles((inflow as unknown as InflowProfile[]) ?? []);
    setLoading(false);
  }

  const { periods, periodType } = useMemo<{ periods: string[]; periodType: "year" | "month" }>(() => {
    if (selectedYear === "all") return { periods: ["2023","2024","2025","2026"], periodType: "year" };
    const ms: string[] = [];
    for (let m = 1; m <= 12; m++) ms.push(selectedYear + "-" + String(m).padStart(2, "0"));
    return { periods: ms, periodType: "month" };
  }, [selectedYear]);

  const periodChartData = useMemo((): MonthlyChartData[] => {
    return periods.map((period) => {
      const [start, end] = getPeriodRange(period, periodType);
      const tuition = allHistory
        .filter((r) => { const e = getEff(r); return !!e && (e + "-01") >= start && (e + "-01") < end; })
        .reduce((s, r) => s + tuitionOf(r), 0);
      const external = allExternal
        .filter((r) => r.income_date >= start && r.income_date < end)
        .reduce((s, r) => s + r.amount, 0);
      return { month: makePeriodLabel(period, periodType), tuition, external };
    });
  }, [periods, periodType, allHistory, allExternal]);

  const studentStats = useMemo(() => {
    const map = new Map<string, { firstMonth: string; lastMonth: string; isActive: boolean; total: number; phone: string | null }>();
    for (const row of allHistory) {
      const prof = row.lessons?.profiles;
      if (!prof?.name) continue;
      const name = normalizeName(prof.name); // 우리인력 → 민경임 합산
      const eff = getEff(row);
      if (!eff) continue;
      const isAct = row.lessons?.is_active ?? false;
      const prev  = map.get(name);
      if (!prev) {
        map.set(name, { firstMonth: eff, lastMonth: eff, isActive: isAct, total: tuitionOf(row), phone: prof.phone });
      } else {
        map.set(name, {
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

  // [BUG FIX] 활성 수강생 & 평균 수강 유지 기간 — 선택 기간 기준으로 수정
  // 활성 수강생: 선택 기간에 결제이력이 1건이라도 있는 고유 학생 수
  // 평균 수강 기간: 선택 기간 내 첫~마지막 결제 스팬 평균
  const { activePeriodStudents, avgDuration } = useMemo(() => {
    const names = new Set<string>();
    const periodMap = new Map<string, { first: string; last: string }>();
    for (const row of allHistory) {
      const eff = getEff(row);
      if (!eff) continue;
      if (selectedYear !== "all" && !eff.startsWith(selectedYear)) continue;
      const name = row.lessons?.profiles?.name;
      if (!name) continue;
      names.add(name);
      const prev = periodMap.get(name);
      if (!prev) {
        periodMap.set(name, { first: eff, last: eff });
      } else {
        periodMap.set(name, {
          first: eff < prev.first ? eff : prev.first,
          last:  eff > prev.last  ? eff : prev.last,
        });
      }
    }
    const durs: number[] = [];
    for (const [, s] of periodMap) {
      const fp = s.first.split("-").map(Number), lp = s.last.split("-").map(Number);
      const d = (lp[0] - fp[0]) * 12 + (lp[1] - fp[1]) + 1;
      if (d >= 1 && d <= 60) durs.push(d);
    }
    const avg = durs.length > 0 ? durs.reduce((a, b) => a + b, 0) / durs.length : 0;
    return { activePeriodStudents: names.size, avgDuration: avg };
  }, [allHistory, selectedYear]);

  const periodStudentFlow = useMemo((): LineData[] => {
    const newMap   = new Map<string, number>();
    const churnMap = new Map<string, number>();
    for (const [, s] of studentStats) {
      const fp = periodType === "year" ? s.firstMonth.substring(0, 4) : s.firstMonth;
      const lp = periodType === "year" ? s.lastMonth.substring(0, 4)  : s.lastMonth;
      if (periods.includes(fp)) newMap.set(fp, (newMap.get(fp) ?? 0) + 1);
      if (!s.isActive && periods.includes(lp)) churnMap.set(lp, (churnMap.get(lp) ?? 0) + 1);
    }
    return periodChartData.map((d, i) => ({
      month: d.month, new: newMap.get(periods[i]) ?? 0, churned: churnMap.get(periods[i]) ?? 0,
    }));
  }, [studentStats, periods, periodType, periodChartData]);
  const periodVip10 = useMemo(() => {
    const map = new Map<string, { name: string; phone: string | null; total: number }>();
    for (const row of allHistory) {
      const eff = getEff(row);
      if (!eff) continue;
      if (selectedYear !== "all" && !eff.startsWith(selectedYear)) continue;
      const prof = row.lessons?.profiles;
      if (!prof?.name) continue;
      const name = normalizeName(prof.name); // 우리인력 → 민경임 합산
      const prev2 = map.get(name) ?? { name, phone: prof.phone, total: 0 };
      map.set(name, { ...prev2, total: prev2.total + tuitionOf(row) });
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [allHistory, selectedYear]);

  const incomeBreakdown = useMemo((): PieData[] => {
    const tuit = periodChartData.reduce((s, d) => s + d.tuition, 0);
    const filteredExt = selectedYear === "all" ? allExternal : allExternal.filter(r => r.income_date.startsWith(selectedYear));
    const extByType = new Map<string, number>();
    for (const r of filteredExt) extByType.set(r.type, (extByType.get(r.type) ?? 0) + r.amount);
    const result: PieData[] = [{ name: "수강료", value: tuit, color: "#6366f1" }];
    extByType.forEach((val, key) => result.push({ name: key, value: val, color: EXTERNAL_COLORS[key] ?? "#94a3b8" }));
    return result.filter((d) => d.value > 0);
  }, [periodChartData, allExternal, selectedYear]);

  const extPipelineData = useMemo((): PieData[] => {
    const filtered = selectedYear === "all" ? allExternal : allExternal.filter(r => r.income_date.startsWith(selectedYear));
    const map = new Map<string, number>();
    for (const r of filtered) { if (r.type) map.set(r.type, (map.get(r.type) ?? 0) + r.amount); }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value, color: EXTERNAL_COLORS[name] ?? "#94a3b8" }))
      .filter(d => d.value > 0).sort((a, b) => b.value - a.value);
  }, [allExternal, selectedYear]);
  const extPipelineTotal = extPipelineData.reduce((s, d) => s + d.value, 0);

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

  const categoryStats = useMemo(() => {
    const map = new Map<string, { count: number; monthlyTotal: number }>();
    for (const l of activeLesson) {
      const cat = l.category?.replace(/\s/g, "") ?? "기타";
      const p2 = map.get(cat) ?? { count: 0, monthlyTotal: 0 };
      map.set(cat, { count: p2.count + 1, monthlyTotal: p2.monthlyTotal + l.tuition_amount });
    }
    return map;
  }, [activeLesson]);

  // [NEW] 정규 수강생 유입경로 현황 — profiles.inflow_route 집계
  const inflowStats = useMemo((): Array<{ route: string; count: number; color: string }> => {
    const INFLOW_COLORS: Record<string, string> = {
      "네이버": "#3b82f6", "지인소개": "#10b981", "배너광고": "#f59e0b",
      "체험전환": "#8b5cf6", "당근": "#f97316", "농협": "#06b6d4",
      "인스타": "#ec4899", "블로그": "#6366f1", "요양보호센터": "#14b8a6", "없음": "#9ca3af",
    };
    const map = new Map<string, number>();
    for (const p of inflowProfiles) {
      const route = p.inflow_route ?? "없음";
      map.set(route, (map.get(route) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([route, count]) => ({ route, count, color: INFLOW_COLORS[route] ?? "#94a3b8" }))
      .filter(d => d.route !== "없음" || d.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [inflowProfiles]);

  const periodTuition  = periodChartData.reduce((s, d) => s + d.tuition, 0);
  const periodExtTotal = periodChartData.reduce((s, d) => s + d.external, 0);
  const periodTotal    = periodTuition + periodExtTotal;

  // [FIX] 월평균 계산 분모 정밀화 — 실제 운영 개월 수 하드코딩
  // 2023: 6월 오픈 → 7개월 (6~12월), 2024: 12개월, 2025: 12개월, 2026: 현재 4월 → 4개월, 전체: 35개월
  const AVG_DENOM: Record<string, number> = { "2023": 7, "2024": 12, "2025": 12, "2026": 4, "all": 35 };
  const periodAvgDenom = AVG_DENOM[selectedYear] ?? periodChartData.length;
  const periodAvg      = periodAvgDenom > 0 ? Math.round(periodTotal / periodAvgDenom) : 0;
  const avgLabel       = selectedYear === "all" ? "월 평균 매출" : "월 평균 매출";
  const avgSubLabel    = selectedYear === "all" ? "전체 35개월 평균" : selectedYear + "년 ÷ " + periodAvgDenom + "개월";
  const totalNewPeriod = periodStudentFlow.reduce((s, d) => s + d.new, 0);
  const totalActiveStudentsCurrent = activeLesson.length;
  const bestPeriod     = [...periodChartData].sort((a, b) => (b.tuition+b.external)-(a.tuition+a.external))[0];
  const worstPeriod    = [...periodChartData].filter(d => d.tuition+d.external > 0).sort((a, b) => (a.tuition+a.external)-(b.tuition+b.external))[0];
  const hlLabel        = selectedYear === "all" ? "연도" : "월";
  const periodRangeLabel = selectedYear === "all" ? "2023 ~ 2026년 전체" : selectedYear + "년 1월 ~ 12월";
  const chartSubtitle  = selectedYear === "all" ? "연도별 수강료 + 외부수입" : selectedYear + "년 월별 수강료 + 외부수입";

  // [NEW] 수입 목표 달성률: 선택 기간의 총수입 / 목표금액
  const TARGET      = selectedYear === "all" ? TARGET_ALL : TARGET_YEAR;
  const achievement = Math.round((periodTotal / TARGET) * 100);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">데이터 분석 중...</p>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-6 pb-12">

      {/* ── 헤더 + 기간 필터 ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">통계 대시보드</h1>
          <p className="text-sm text-gray-400 mt-0.5">{periodRangeLabel} 재무 현황</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {YEAR_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSelectedYear(opt.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                selectedYear === opt.value
                  ? "bg-indigo-600 text-white shadow-md"
                  : "bg-white text-gray-500 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI Row 1: 4 gradient cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* 기간 총매출 */}
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-5 shadow-lg text-white">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-medium text-white/70">{selectedYear === "all" ? "전체 기간 총매출" : selectedYear + "년 총매출"}</p>
            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center text-base">💰</div>
          </div>
          <p className="text-2xl font-bold">{fmtAmount(periodTotal)}원</p>
          <p className="text-xs text-white/60 mt-1">{periodRangeLabel}</p>
        </div>

        {/* 전년 대비 증감 */}
        <div className={`rounded-2xl p-5 shadow-lg text-white ${yoyPos ? "bg-gradient-to-br from-emerald-500 to-teal-600" : "bg-gradient-to-br from-rose-500 to-pink-600"}`}>
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-medium text-white/70">{yoyCompLabel}</p>
            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center text-base">{yoyPos ? "📈" : "📉"}</div>
          </div>
          <p className="text-2xl font-bold">{fmtSign(yoyPct)}</p>
          <p className="text-xs text-white/60 mt-1">전년 {fmtAmount(yoyPrevTotal)}원</p>
        </div>

        {/* [BUG FIX] 활성 수강생 — 선택 기간 결제이력 있는 고유 학생 수 */}
        <div className="bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl p-5 shadow-lg text-white">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-medium text-white/70">활성 수강생</p>
            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center text-base">👥</div>
          </div>
          <p className="text-2xl font-bold">{activePeriodStudents}<span className="text-base font-normal ml-1">명</span></p>
          <p className="text-xs text-white/60 mt-1">{selectedYear === "all" ? "전체 기간 결제 학생" : selectedYear + "년 결제 학생"}</p>
        </div>

        {/* [NEW] 수입 목표 달성률 — 진행 바 카드 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-semibold text-gray-500">수입 목표 달성률</p>
            <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center text-base">🎯</div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{Math.min(achievement, 999)}%</p>
          <p className="text-xs text-gray-400 mt-0.5 mb-3">{fmtAmount(periodTotal)} / 목표 {fmtAmount(TARGET)}</p>
          {/* 진행 바: 100% 초과 시 파란색에서 초록색으로 변경 */}
          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-2.5 rounded-full transition-all duration-700 ${achievement >= 100 ? "bg-gradient-to-r from-emerald-400 to-emerald-500" : "bg-gradient-to-r from-blue-400 to-indigo-500"}`}
              style={{ width: Math.min(achievement, 100) + "%" }}
            />
          </div>
          <p className={`text-xs mt-2 font-medium ${achievement >= 100 ? "text-emerald-600" : "text-gray-400"}`}>
            {achievement >= 100 ? "목표 달성!" : "잔여 " + fmtAmount(Math.max(TARGET - periodTotal, 0)) + "원"}
          </p>
        </div>
      </div>

      {/* ── KPI Row 2: 4 white metric cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-500">{avgLabel}</p>
            <span className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center text-sm">📊</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{fmtAmount(periodAvg)}원</p>
          <p className="text-xs text-gray-400 mt-1">{avgSubLabel}</p>
        </div>

        {/* [BUG FIX] 평균 수강 유지 기간 — 선택 기간 결제 학생 기준 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-500">평균 수강 유지 기간</p>
            <span className="w-7 h-7 bg-teal-50 rounded-lg flex items-center justify-center text-sm">⏱️</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{avgDuration.toFixed(1)}<span className="text-sm font-normal text-gray-500 ml-1">개월</span></p>
          <p className="text-xs text-gray-400 mt-1">{selectedYear === "all" ? "전체" : selectedYear + "년"} 결제 학생 기준</p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-500">기간 신규 유입</p>
            <span className="w-7 h-7 bg-orange-50 rounded-lg flex items-center justify-center text-sm">🆕</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{totalNewPeriod}<span className="text-sm font-normal text-gray-500 ml-1">명</span></p>
          <p className="text-xs text-gray-400 mt-1">{periodRangeLabel}</p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-3">기간 수입 내역</p>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-2 h-2 rounded-full bg-indigo-500" />수강료</span>
              <span className="text-sm font-bold text-gray-900">{fmtAmount(periodTuition)}원</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-2 h-2 rounded-full bg-amber-400" />외부수입</span>
              <span className="text-sm font-bold text-gray-900">{fmtAmount(periodExtTotal)}원</span>
            </div>
            <div className="border-t border-gray-100 pt-2 flex justify-between items-center">
              <span className="text-xs font-semibold text-gray-600">합계</span>
              <span className="text-sm font-bold text-indigo-600">{fmtAmount(periodTotal)}원</span>
            </div>
          </div>
        </div>
      </div>
      {/* ── 하이라이트 배너 ── */}
      {(bestPeriod || worstPeriod) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {bestPeriod && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-center gap-4">
              <span className="text-3xl">🏆</span>
              <div>
                <p className="text-xs text-amber-600 font-medium">최고 매출 {hlLabel}</p>
                <p className="font-bold text-amber-900">{bestPeriod.month} — {fmtAmount(bestPeriod.tuition + bestPeriod.external)}원</p>
                <p className="text-xs text-amber-700">수강료 {fmtAmount(bestPeriod.tuition)} · 외부 {fmtAmount(bestPeriod.external)}</p>
              </div>
            </div>
          )}
          {worstPeriod && (
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center gap-4">
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

      {/* ── 매출 추이 AreaChart (2/3) + 수입 구성 도넛 (1/3) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-5">
            <div>
              <h2 className="text-base font-bold text-gray-900">매출 추이</h2>
              <p className="text-xs text-gray-400 mt-0.5">{chartSubtitle}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-gray-400">기간 합산</p>
              <p className="text-lg font-bold text-indigo-600">{fmtAmount(periodTotal)}원</p>
            </div>
          </div>
          <StatsArea data={periodChartData} />
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-base font-bold text-gray-900 mb-1">수입 구성 분석</h2>
          <p className="text-xs text-gray-400 mb-4">{selectedYear === "all" ? "전체 기간" : selectedYear + "년"} 수입 유형별 비중</p>
          <StatsDonut data={incomeBreakdown} />
        </div>
      </div>

      {/* ── 신규/이탈 LineChart (1/2) + [NEW] 체험→등록 전환 퍼널 (1/2) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <h2 className="text-base font-bold text-gray-900">신규 유입 vs 이탈 추이</h2>
              <p className="text-xs text-gray-400 mt-0.5">{selectedYear === "all" ? "연도별" : selectedYear + "년 월별"} 학생 변동</p>
            </div>
            <div className="flex gap-4 text-xs text-gray-400 shrink-0 mt-0.5">
              <span className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-blue-500 inline-block" />신규</span>
              <span className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-dashed border-rose-400 inline-block" />이탈</span>
            </div>
          </div>
          <StatsLine data={periodStudentFlow} />
          <p className="text-xs text-gray-300 mt-3">※ 신규: 첫 결제 학생 / 이탈: is_active=false의 마지막 결제 기준</p>
        </div>

        {/* [NEW] 정규 수강생 유입경로 현황 — 가로형 바 차트 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-base font-bold text-gray-900 mb-1">정규 수강생 유입경로 현황</h2>
          <p className="text-xs text-gray-400 mb-5">총 {inflowProfiles.length}명 기준 경로별 분포</p>
          <div className="space-y-3">
            {inflowStats.map((d) => {
              const pct = inflowProfiles.length > 0 ? Math.round((d.count / inflowProfiles.length) * 100) : 0;
              return (
                <div key={d.route}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-700">{d.route}</span>
                    <span className="text-sm font-bold text-gray-900">{d.count}명
                      <span className="text-xs font-normal text-gray-400 ml-1">({pct}%)</span>
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-6 overflow-hidden">
                    <div
                      className="h-6 rounded-full flex items-center justify-end pr-2.5 transition-all duration-700"
                      style={{ width: Math.max(pct, 3) + "%", background: d.color }}
                    >
                      {pct >= 12 && <span className="text-white text-xs font-bold">{pct}%</span>}
                    </div>
                  </div>
                </div>
              );
            })}
            {inflowStats.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-6">
                데이터 없음 — profiles.inflow_route 컬럼 확인 필요
              </p>
            )}
          </div>
        </div>
      </div>
      {/* ── 수강생 카테고리 현황 ── */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-base font-bold text-gray-900 mb-1">수강생 카테고리 현황</h2>
        <p className="text-xs text-gray-400 mb-5">현재 활성 수업 기준 카테고리별 인원 및 월 수강료</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {CATEGORIES.map((cat) => {
            const st = categoryStats.get(cat) ?? { count: 0, monthlyTotal: 0 };
            const pct = totalActiveStudentsCurrent > 0 ? Math.round((st.count / totalActiveStudentsCurrent) * 100) : 0;
            const color = CATEGORY_COLORS[cat] ?? "#94a3b8";
            return (
              <div key={cat} className="rounded-2xl border border-gray-100 p-4 hover:border-indigo-200 transition-colors bg-gray-50/50">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-gray-700">{CATEGORY_LABELS[cat] ?? cat}</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: color }}>{st.count}명</span>
                </div>
                <p className="text-xl font-bold text-gray-900 mb-1">{fmtAmount(st.monthlyTotal)}원</p>
                <p className="text-xs text-gray-400 mb-3">월 수강료 합계</p>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div className="h-1.5 rounded-full transition-all" style={{ width: pct + "%", background: color }} />
                </div>
                <p className="text-xs text-gray-400 mt-1.5">전체의 {pct}%</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 외부수입 파이프라인 (1/2) + VIP TOP 10 (1/2) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-base font-bold text-gray-900 mb-1">외부수입 파이프라인 분석</h2>
          <p className="text-xs text-gray-400 mb-5">{selectedYear === "all" ? "전체 기간" : selectedYear + "년"} 카테고리별 외부수입 비중</p>
          <StatsDonut data={extPipelineData} />
          <div className="space-y-3 mt-4">
            {extPipelineData.map((d) => {
              const pct = extPipelineTotal > 0 ? Math.round((d.value / extPipelineTotal) * 100) : 0;
              return (
                <div key={d.name} className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-gray-700">{d.name}</span>
                      <span className="text-sm font-bold text-gray-900">{d.value.toLocaleString()}원</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full" style={{ width: pct + "%", background: d.color }} />
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 w-8 text-right shrink-0">{pct}%</span>
                </div>
              );
            })}
            {extPipelineData.length === 0 && <p className="text-gray-400 text-sm">데이터 없음</p>}
            <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
              <span className="text-sm font-semibold text-gray-700">합계</span>
              <span className="text-base font-bold text-gray-900">{extPipelineTotal.toLocaleString()}원</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="mb-5">
            <h2 className="text-base font-bold text-gray-900">VIP 수강생 TOP 10</h2>
            <p className="text-xs text-gray-400 mt-0.5">{selectedYear === "all" ? "전체 기간" : selectedYear + "년"} 결제 총액 순위</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2.5 px-2 text-gray-400 font-medium text-xs w-10">순위</th>
                  <th className="text-left py-2.5 px-2 text-gray-400 font-medium text-xs">이름</th>
                  <th className="text-right py-2.5 px-2 text-gray-400 font-medium text-xs">결제 총액</th>
                  <th className="py-2.5 px-2 text-gray-400 font-medium text-xs w-28 hidden sm:table-cell">비중</th>
                </tr>
              </thead>
              <tbody>
                {periodVip10.map((v, i) => {
                  const maxT = periodVip10[0]?.total ?? 1;
                  const pct  = Math.round((v.total / maxT) * 100);
                  const medal = ["🥇","🥈","🥉"][i] ?? null;
                  return (
                    <tr key={v.name + i} className="border-b border-gray-50 hover:bg-indigo-50/30 transition-colors">
                      <td className="py-3 px-2">{medal ? <span className="text-lg">{medal}</span> : <span className="text-gray-400 text-xs font-medium">{i+1}</span>}</td>
                      <td className="py-3 px-2 font-semibold text-gray-900">{v.name}</td>
                      <td className="py-3 px-2 text-right font-bold text-gray-900">{v.total.toLocaleString()}원</td>
                      <td className="py-3 px-2 hidden sm:table-cell">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5"><div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: pct + "%" }} /></div>
                          <span className="text-gray-400 text-xs w-7 text-right">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {periodVip10.length === 0 && <tr><td colSpan={4} className="py-10 text-center text-gray-400 text-sm">데이터 없음</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}