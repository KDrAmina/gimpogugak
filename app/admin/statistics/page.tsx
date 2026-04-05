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
const StatsArea           = nextDynamic(() => import("@/components/StatsArea"),           { ssr: false, loading: () => <Loader h={300} /> });
const StatsDonut          = nextDynamic(() => import("@/components/StatsDonut"),          { ssr: false, loading: () => <Loader h={260} /> });
const StatsLine           = nextDynamic(() => import("@/components/StatsLine"),           { ssr: false, loading: () => <Loader h={280} /> });
const InflowTrendChart    = nextDynamic(() => import("@/components/InflowTrendChart"),    { ssr: false, loading: () => <Loader h={260} /> });
const CategoryTrendChart  = nextDynamic(() => import("@/components/CategoryTrendChart"),  { ssr: false, loading: () => <Loader h={260} /> });
const ExternalTrendChart  = nextDynamic(() => import("@/components/ExternalTrendChart"),  { ssr: false, loading: () => <Loader h={240} /> });

interface ProfileInner  { name: string; phone: string | null; }
interface LessonInner   { tuition_amount: number; category: string; is_active?: boolean; profiles: ProfileInner | null; }
interface HistoryRow    { completed_date?: string; tuition_snapshot: number; prepaid_month: string | null; lessons: LessonInner | null; }
interface ExternalRow   { income_date: string; amount: number; type: string; }
interface ActiveLesson  { category: string; tuition_amount: number; }
interface InflowProfile { name: string; phone: string | null; inflow_route: string | null; }

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

// 기본 목표 금액 (사용자가 수정하지 않은 경우의 초기값)
const DEFAULT_GOAL_YEAR = 60_000_000;
const DEFAULT_GOAL_ALL  = 240_000_000;

// localStorage 키 생성 (selectedYear별로 분리 저장)
const goalKey = (year: string) => `revenueGoal_${year}`;

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

// 외부수입 트렌드에 표시할 유형 3가지
const EXT_TREND_TYPES = ["체험비", "강사수수료", "기타"];

// YoY 연도별 겹쳐보기에 사용할 연도/색상/레이블
const YEARS_YOY = ["2023", "2024", "2025", "2026"];
const YEAR_COLORS: Record<string, string> = { "2023": "#6366f1", "2024": "#10b981", "2025": "#f59e0b", "2026": "#ef4444" };
const YEAR_LABELS: Record<string, string> = { "2023": "2023년", "2024": "2024년", "2025": "2025년", "2026": "2026년" };

export default function StatisticsPage() {
  const supabase = createClient();
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [loading, setLoading]           = useState(true);
  const [allHistory, setAllHistory]     = useState<HistoryRow[]>([]);
  const [allExternal, setAllExternal]   = useState<ExternalRow[]>([]);
  const [activeLesson, setActiveLesson] = useState<ActiveLesson[]>([]);
  const [inflowProfiles, setInflowProfiles] = useState<InflowProfile[]>([]);
  const [yoyMode, setYoyMode]               = useState<"cumulative" | "overlay">("cumulative");
  const [selectedYoyCategory, setSelectedYoyCategory] = useState<string>("어린이개인");

  // ── 수입 목표 달성률 편집 상태 ────────────────────────────────────────
  const [goalAmount, setGoalAmount]     = useState<number>(DEFAULT_GOAL_ALL);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [editGoalInput, setEditGoalInput] = useState("");

  useEffect(() => { fetchAll(); }, []); // eslint-disable-line

  /**
   * selectedYear 변경 시:
   * 1. localStorage에서 해당 연도의 저장된 목표 금액을 불러옴
   * 2. 저장값 없으면 기본값(연단위 6천만, 전체 2.4억)으로 초기화
   */
  useEffect(() => {
    const saved = localStorage.getItem(goalKey(selectedYear));
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed > 0) { setGoalAmount(parsed); return; }
    }
    setGoalAmount(selectedYear === "all" ? DEFAULT_GOAL_ALL : DEFAULT_GOAL_YEAR);
    setIsEditingGoal(false);
    if (selectedYear !== "all") setYoyMode("cumulative");
  }, [selectedYear]);

  /**
   * 목표 금액 저장:
   * - input 값에서 쉼표 제거 후 정수로 파싱
   * - localStorage에 `revenueGoal_${selectedYear}` 키로 저장 (연도별 독립 관리)
   * - Progress Bar가 goalAmount 변경에 따라 즉시 리렌더링됨 (useState 반응성)
   */
  function saveGoal() {
    const parsed = parseInt(editGoalInput.replace(/,/g, ""), 10);
    if (!isNaN(parsed) && parsed > 0) {
      localStorage.setItem(goalKey(selectedYear), String(parsed));
      setGoalAmount(parsed);
    }
    setIsEditingGoal(false);
  }

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

  // ── [NEW] 카테고리별 수강료 트렌드 데이터 ────────────────────────────
  /**
   * 각 기간(period)마다 4개 카테고리(어린이개인·어린이단체·성인개인·성인단체)별
   * tuition_snapshot 합계를 계산하여 CategoryTrendChart에 전달합니다.
   *
   * selectedYear === "all" → X축: 연도(23년~26년)
   * selectedYear === "2026" → X축: 월(1월~12월)
   */
  const categoryTrendData = useMemo((): Array<Record<string, string | number>> => {
    return periods.map((period) => {
      const [start, end] = getPeriodRange(period, periodType);
      const point: Record<string, string | number> = { month: makePeriodLabel(period, periodType) };
      for (const cat of CATEGORIES) {
        point[cat] = allHistory
          .filter((r) => {
            const e = getEff(r);
            return (
              !!e &&
              (e + "-01") >= start &&
              (e + "-01") < end &&
              (r.lessons?.category?.replace(/\s/g, "") ?? "") === cat
            );
          })
          .reduce((s, r) => s + tuitionOf(r), 0);
      }
      return point;
    });
  }, [periods, periodType, allHistory]);

  // ── [NEW] 외부수입 유형별 월별 트렌드 데이터 ──────────────────────────
  /**
   * 각 기간(period)마다 체험비·강사수수료·기타 3가지 외부수입 유형별 금액을 집계합니다.
   * 어떤 달에 어떤 외부수입이 발생했는지 트렌드를 파악하는 용도입니다.
   */
  const extTrendData = useMemo((): Array<Record<string, string | number>> => {
    return periods.map((period) => {
      const [start, end] = getPeriodRange(period, periodType);
      const filtered = allExternal.filter((r) => r.income_date >= start && r.income_date < end);
      const point: Record<string, string | number> = { month: makePeriodLabel(period, periodType) };
      for (const type of EXT_TREND_TYPES) {
        point[type] = filtered.filter((r) => r.type === type).reduce((s, r) => s + r.amount, 0);
      }
      return point;
    });
  }, [periods, periodType, allExternal]);

  // ── [YoY] 연도별 겹쳐보기 — 1월~12월 X축, 연도별 선 ─────────────────────
  /** 총매출(수강료+외부수입)을 월×연도 행렬로 계산 */
  const yoyRevenueData = useMemo((): Array<Record<string, string | number>> => {
    if (selectedYear !== "all" || yoyMode !== "overlay") return [];
    return Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, "0");
      const point: Record<string, string | number> = { month: (i + 1) + "월" };
      for (const yr of YEARS_YOY) {
        const start = yr + "-" + m + "-01";
        const nextM = i + 2;
        const end = nextM > 12 ? String(parseInt(yr) + 1) + "-01-01" : yr + "-" + String(nextM).padStart(2, "0") + "-01";
        const tuition = allHistory
          .filter((r) => { const e = getEff(r); return !!e && (e + "-01") >= start && (e + "-01") < end; })
          .reduce((s, r) => s + tuitionOf(r), 0);
        const external = allExternal
          .filter((r) => r.income_date >= start && r.income_date < end)
          .reduce((s, r) => s + r.amount, 0);
        point[yr] = tuition + external;
      }
      return point;
    });
  }, [selectedYear, yoyMode, allHistory, allExternal]); // eslint-disable-line react-hooks/exhaustive-deps

  /** 외부수입 합계를 월×연도 행렬로 계산 */
  const yoyExtData = useMemo((): Array<Record<string, string | number>> => {
    if (selectedYear !== "all" || yoyMode !== "overlay") return [];
    return Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, "0");
      const point: Record<string, string | number> = { month: (i + 1) + "월" };
      for (const yr of YEARS_YOY) {
        const start = yr + "-" + m + "-01";
        const nextM = i + 2;
        const end = nextM > 12 ? String(parseInt(yr) + 1) + "-01-01" : yr + "-" + String(nextM).padStart(2, "0") + "-01";
        point[yr] = allExternal
          .filter((r) => r.income_date >= start && r.income_date < end)
          .reduce((s, r) => s + r.amount, 0);
      }
      return point;
    });
  }, [selectedYear, yoyMode, allExternal]); // eslint-disable-line react-hooks/exhaustive-deps

  /** 선택된 카테고리의 수강료를 월×연도 행렬로 계산 (카테고리별 YoY 비교) */
  const yoyCategoryData = useMemo((): Array<Record<string, string | number>> => {
    if (selectedYear !== "all" || yoyMode !== "overlay") return [];
    return Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, "0");
      const point: Record<string, string | number> = { month: (i + 1) + "월" };
      for (const yr of YEARS_YOY) {
        const start = yr + "-" + m + "-01";
        const nextM = i + 2;
        const end = nextM > 12 ? String(parseInt(yr) + 1) + "-01-01" : yr + "-" + String(nextM).padStart(2, "0") + "-01";
        point[yr] = allHistory
          .filter((r) => {
            const e = getEff(r);
            return (
              !!e &&
              (e + "-01") >= start &&
              (e + "-01") < end &&
              (r.lessons?.category?.replace(/\s/g, "") ?? "") === selectedYoyCategory
            );
          })
          .reduce((s, r) => s + tuitionOf(r), 0);
      }
      return point;
    });
  }, [selectedYear, yoyMode, selectedYoyCategory, allHistory]); // eslint-disable-line react-hooks/exhaustive-deps

  /** 신규 유입 수를 월×연도 행렬로 계산 (InflowTrendChart 형식: year 키 사용) */
  const yoyFlowData = useMemo((): Array<Record<string, string | number>> => {
    if (selectedYear !== "all" || yoyMode !== "overlay") return [];
    // 각 학생의 첫 결제 월을 찾아 "YYYY-MM" → 신규 수 집계
    const firstMonthMap = new Map<string, string>();
    for (const row of allHistory) {
      const e = getEff(row);
      if (!e) continue;
      const name = row.lessons?.profiles?.name;
      if (!name) continue;
      const nName = normalizeName(name);
      const prev = firstMonthMap.get(nName);
      if (!prev || e < prev) firstMonthMap.set(nName, e);
    }
    const newMap = new Map<string, number>(); // "YYYY-MM" → count
    for (const [, firstMonth] of firstMonthMap) {
      newMap.set(firstMonth, (newMap.get(firstMonth) ?? 0) + 1);
    }
    return Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, "0");
      const point: Record<string, string | number> = { year: (i + 1) + "월" };
      for (const yr of YEARS_YOY) {
        point[yr] = newMap.get(yr + "-" + m) ?? 0;
      }
      return point;
    });
  }, [selectedYear, yoyMode, allHistory]); // eslint-disable-line react-hooks/exhaustive-deps

  const studentStats = useMemo(() => {
    const map = new Map<string, { firstMonth: string; lastMonth: string; isActive: boolean; total: number; phone: string | null }>();
    for (const row of allHistory) {
      const prof = row.lessons?.profiles;
      if (!prof?.name) continue;
      const name = normalizeName(prof.name);
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
      const name = normalizeName(prof.name);
      const prev2 = map.get(name) ?? { name, phone: prof.phone, total: 0 };
      map.set(name, { ...prev2, total: prev2.total + tuitionOf(row) });
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [allHistory, selectedYear]);

  /** 결제 횟수(납부 개월 수) 기준 장기 수강생 TOP 10 — normalizeName 적용 */
  const periodLongevityTop10 = useMemo(() => {
    const map = new Map<string, { name: string; count: number; firstMonth: string }>();
    for (const row of allHistory) {
      const eff = getEff(row);
      if (!eff) continue;
      if (selectedYear !== "all" && !eff.startsWith(selectedYear)) continue;
      const prof = row.lessons?.profiles;
      if (!prof?.name) continue;
      const name = normalizeName(prof.name);
      const prev = map.get(name);
      if (!prev) {
        map.set(name, { name, count: 1, firstMonth: eff });
      } else {
        map.set(name, {
          name,
          count: prev.count + 1,
          firstMonth: eff < prev.firstMonth ? eff : prev.firstMonth,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 10);
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
    if (selectedYear === "all") {
      for (const l of activeLesson) {
        const cat = l.category?.replace(/\s/g, "") ?? "기타";
        const p2 = map.get(cat) ?? { count: 0, monthlyTotal: 0 };
        map.set(cat, { count: p2.count + 1, monthlyTotal: p2.monthlyTotal + l.tuition_amount });
      }
    } else {
      const seen = new Set<string>();
      for (const row of allHistory) {
        const eff = getEff(row);
        if (!eff || !eff.startsWith(selectedYear)) continue;
        const prof = row.lessons?.profiles;
        if (!prof?.name) continue;
        const name = normalizeName(prof.name);
        const cat = row.lessons?.category?.replace(/\s/g, "") ?? "기타";
        const key = `${name}:${cat}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const p2 = map.get(cat) ?? { count: 0, monthlyTotal: 0 };
        map.set(cat, { count: p2.count + 1, monthlyTotal: p2.monthlyTotal + (row.lessons?.tuition_amount ?? 0) });
      }
    }
    return map;
  }, [activeLesson, allHistory, selectedYear]);

  const INFLOW_COLORS: Record<string, string> = {
    "네이버": "#3b82f6", "지인소개": "#10b981", "배너광고": "#f59e0b",
    "체험전환": "#8b5cf6", "당근": "#f97316", "농협": "#06b6d4",
    "인스타": "#ec4899", "블로그": "#6366f1", "요양보호센터": "#14b8a6",
  };

  const isValidRoute = (route: string | null): route is string =>
    !!route && route.trim() !== "" && route !== "없음" && route !== "(빈칸)";

  const inflowTrendData = useMemo(() => {
    const validCount = inflowProfiles.filter((p) => isValidRoute(p.inflow_route)).length;

    if (selectedYear === "all") {
      const YEARS = ["2023", "2024", "2025", "2026"];
      const nameToFirstYear = new Map<string, string>();
      for (const [name, stats] of studentStats) {
        nameToFirstYear.set(name, stats.firstMonth.substring(0, 4));
      }
      const countMap = new Map<string, Map<string, number>>();
      const allRoutes = new Set<string>();
      for (const p of inflowProfiles) {
        if (!isValidRoute(p.inflow_route)) continue;
        const route = p.inflow_route;
        const normalizedName = normalizeName(p.name);
        const firstYear = nameToFirstYear.get(normalizedName);
        if (!firstYear || !YEARS.includes(firstYear)) continue;
        allRoutes.add(route);
        if (!countMap.has(firstYear)) countMap.set(firstYear, new Map());
        const yrMap = countMap.get(firstYear)!;
        yrMap.set(route, (yrMap.get(route) ?? 0) + 1);
      }
      const routes = Array.from(allRoutes).sort((a, b) => {
        const aTotal = YEARS.reduce((s, y) => s + (countMap.get(y)?.get(a) ?? 0), 0);
        const bTotal = YEARS.reduce((s, y) => s + (countMap.get(y)?.get(b) ?? 0), 0);
        return bTotal - aTotal;
      });
      const data = YEARS.map((year) => {
        const point: Record<string, string | number> = { year: year.slice(2) + "년" };
        const yrMap = countMap.get(year) ?? new Map();
        for (const route of routes) point[route] = yrMap.get(route) ?? 0;
        return point;
      });
      return { data, routes, colors: INFLOW_COLORS, validCount };
    } else {
      const nameToFirstMonth = new Map<string, string>();
      for (const [name, stats] of studentStats) {
        nameToFirstMonth.set(name, stats.firstMonth);
      }
      const countMap = new Map<string, Map<string, number>>();
      const allRoutes = new Set<string>();
      for (const p of inflowProfiles) {
        if (!isValidRoute(p.inflow_route)) continue;
        const route = p.inflow_route;
        const normalizedName = normalizeName(p.name);
        const firstMonth = nameToFirstMonth.get(normalizedName);
        if (!firstMonth || !firstMonth.startsWith(selectedYear)) continue;
        allRoutes.add(route);
        if (!countMap.has(firstMonth)) countMap.set(firstMonth, new Map());
        const mMap = countMap.get(firstMonth)!;
        mMap.set(route, (mMap.get(route) ?? 0) + 1);
      }
      const routes = Array.from(allRoutes).sort((a, b) => {
        const aTotal = [...countMap.values()].reduce((s, m) => s + (m.get(a) ?? 0), 0);
        const bTotal = [...countMap.values()].reduce((s, m) => s + (m.get(b) ?? 0), 0);
        return bTotal - aTotal;
      });
      const data = Array.from({ length: 12 }, (_, i) => {
        const monthKey = selectedYear + "-" + String(i + 1).padStart(2, "0");
        const monthLabel = (i + 1) + "월";
        const point: Record<string, string | number> = { year: monthLabel };
        const mMap = countMap.get(monthKey) ?? new Map();
        for (const route of routes) point[route] = mMap.get(route) ?? 0;
        return point;
      });
      return { data, routes, colors: INFLOW_COLORS, validCount };
    }
  }, [inflowProfiles, studentStats, selectedYear]); // eslint-disable-line react-hooks/exhaustive-deps

  const periodTuition  = periodChartData.reduce((s, d) => s + d.tuition, 0);
  const periodExtTotal = periodChartData.reduce((s, d) => s + d.external, 0);
  const periodTotal    = periodTuition + periodExtTotal;

  const AVG_DENOM: Record<string, number> = { "2023": 7, "2024": 12, "2025": 12, "2026": 4, "all": 35 };
  const periodAvgDenom = AVG_DENOM[selectedYear] ?? periodChartData.length;
  const periodAvg      = periodAvgDenom > 0 ? Math.round(periodTotal / periodAvgDenom) : 0;
  const avgSubLabel    = selectedYear === "all" ? "전체 35개월 평균" : selectedYear + "년 ÷ " + periodAvgDenom + "개월";
  const totalNewPeriod = periodStudentFlow.reduce((s, d) => s + d.new, 0);
  const totalActiveStudentsCurrent = activeLesson.length;
  const bestPeriod     = [...periodChartData].sort((a, b) => (b.tuition+b.external)-(a.tuition+a.external))[0];
  const worstPeriod    = [...periodChartData].filter(d => d.tuition+d.external > 0).sort((a, b) => (a.tuition+a.external)-(b.tuition+b.external))[0];
  const hlLabel        = selectedYear === "all" ? "연도" : "월";
  const periodRangeLabel = selectedYear === "all" ? "2023 ~ 2026년 전체" : selectedYear + "년 1월 ~ 12월";
  const chartSubtitle  = selectedYear === "all" ? "연도별 수강료 + 외부수입" : selectedYear + "년 월별 수강료 + 외부수입";

  // 목표 달성률 계산 — goalAmount(사용자가 편집 가능한 값) 기준으로 실시간 계산됨
  const achievement = goalAmount > 0 ? Math.round((periodTotal / goalAmount) * 100) : 0;

  // categoryStats totalCount (비율 계산용)
  const categoryTotal = selectedYear === "all"
    ? totalActiveStudentsCurrent
    : Array.from(categoryStats.values()).reduce((s, v) => s + v.count, 0);

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

      {/* ── YoY 모드 토글 (전체 기간 선택 시에만 표시) ── */}
      {selectedYear === "all" && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium">차트 보기:</span>
          {(["cumulative", "overlay"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setYoyMode(mode)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                yoyMode === mode
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white text-gray-500 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600"
              }`}
            >
              {mode === "cumulative" ? "누적 보기" : "연도별 겹쳐보기"}
            </button>
          ))}
        </div>
      )}

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

        {/* 활성 수강생 */}
        <div className="bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl p-5 shadow-lg text-white">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-medium text-white/70">활성 수강생</p>
            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center text-base">👥</div>
          </div>
          <p className="text-2xl font-bold">{activePeriodStudents}<span className="text-base font-normal ml-1">명</span></p>
          <p className="text-xs text-white/60 mt-1">{selectedYear === "all" ? "전체 기간 결제 학생" : selectedYear + "년 결제 학생"}</p>
        </div>

        {/* ── [STEP 1] 수입 목표 달성률 — 동적 목표 수정 기능 ──────────────
         * goalAmount: localStorage에서 불러온 값 (없으면 기본값)
         * 연필 아이콘 클릭 → 인라인 input 편집 모드
         * 저장 시 localStorage에 revenueGoal_${selectedYear} 키로 보관
         * achievement(%) = periodTotal / goalAmount * 100 → Progress Bar 즉시 반영
         ──────────────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-semibold text-gray-500">수입 목표 달성률</p>
            <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center text-base">🎯</div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{Math.min(achievement, 999)}%</p>

          {/* 목표 금액 — 클릭 편집 */}
          <div className="mt-0.5 mb-3">
            {isEditingGoal ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={editGoalInput}
                  onChange={(e) => setEditGoalInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveGoal();
                    if (e.key === "Escape") setIsEditingGoal(false);
                  }}
                  className="w-28 text-xs px-2 py-1 border border-indigo-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                  placeholder="목표금액(원)"
                />
                <button
                  onClick={saveGoal}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                >저장</button>
                <button
                  onClick={() => setIsEditingGoal(false)}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >취소</button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-gray-400">
                  {fmtAmount(periodTotal)} / 목표 {fmtAmount(goalAmount)}
                </p>
                <button
                  onClick={() => {
                    setEditGoalInput(goalAmount.toLocaleString());
                    setIsEditingGoal(true);
                  }}
                  className="text-gray-300 hover:text-indigo-500 transition-colors leading-none"
                  title="목표 금액 수정"
                >
                  ✏️
                </button>
              </div>
            )}
          </div>

          {/* Progress Bar — goalAmount 변경 시 즉시 리렌더링 */}
          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-2.5 rounded-full transition-all duration-700 ${
                achievement >= 100
                  ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
                  : "bg-gradient-to-r from-blue-400 to-indigo-500"
              }`}
              style={{ width: Math.min(achievement, 100) + "%" }}
            />
          </div>
          <p className={`text-xs mt-2 font-medium ${achievement >= 100 ? "text-emerald-600" : "text-gray-400"}`}>
            {achievement >= 100
              ? "목표 달성!"
              : "잔여 " + fmtAmount(Math.max(goalAmount - periodTotal, 0)) + "원"}
          </p>
        </div>
      </div>

      {/* ── KPI Row 2: 4 white metric cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-500">월 평균 매출</p>
            <span className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center text-sm">📊</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{fmtAmount(periodAvg)}원</p>
          <p className="text-xs text-gray-400 mt-1">{avgSubLabel}</p>
        </div>

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

      {/* ════════════════════════════════════════════════════════════════════
       * ① 카테고리별 수강료 트렌드 (LineChart) — [STEP 2: 상단 배치]
       *    기존 카테고리 카드를 제거하고 Recharts LineChart로 전면 개편.
       *    4개 카테고리 선을 겹쳐 그려 월별/연별 수익 비교가 한눈에 가능.
       ════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-5">
          <div>
            <h2 className="text-base font-bold text-gray-900">카테고리별 수강료 트렌드</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {yoyMode === "overlay"
                ? "카테고리 선택 후 연도별 수강료 비교 (YoY)"
                : (selectedYear === "all" ? "연도별" : selectedYear + "년 월별") + " 카테고리 수강료 합계 추이"}
            </p>
          </div>
          {/* YoY 모드: 카테고리 선택 탭 / 일반 모드: 카테고리별 수강료 합계 요약 */}
          {yoyMode === "overlay" ? (
            <div className="flex flex-wrap gap-2 shrink-0">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedYoyCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    selectedYoyCategory === cat
                      ? "text-white shadow-sm"
                      : "bg-white border border-gray-200 hover:border-indigo-300 text-gray-500 hover:text-indigo-600"
                  }`}
                  style={selectedYoyCategory === cat ? { background: CATEGORY_COLORS[cat] } : {}}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 shrink-0">
              {CATEGORIES.map((cat) => {
                const st = categoryStats.get(cat) ?? { count: 0, monthlyTotal: 0 };
                return (
                  <span
                    key={cat}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white"
                    style={{ background: CATEGORY_COLORS[cat] }}
                  >
                    {CATEGORY_LABELS[cat]} · {st.count}명
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <CategoryTrendChart
          data={yoyMode === "overlay" ? yoyCategoryData : categoryTrendData}
          categories={yoyMode === "overlay" ? YEARS_YOY : CATEGORIES}
          colors={yoyMode === "overlay" ? YEAR_COLORS : CATEGORY_COLORS}
          labels={yoyMode === "overlay" ? YEAR_LABELS : CATEGORY_LABELS}
        />
        {/* 카테고리별 인원/비중 요약 바 — YoY 겹쳐보기 모드에서는 숨김 */}
        {yoyMode !== "overlay" && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-gray-100">
            {CATEGORIES.map((cat) => {
              const st = categoryStats.get(cat) ?? { count: 0, monthlyTotal: 0 };
              const pct = categoryTotal > 0 ? Math.round((st.count / categoryTotal) * 100) : 0;
              const color = CATEGORY_COLORS[cat];
              return (
                <div key={cat} className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-gray-600">{CATEGORY_LABELS[cat]}</span>
                    <span className="text-xs font-bold" style={{ color }}>{st.count}명</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full" style={{ width: pct + "%", background: color }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>{fmtAmount(st.monthlyTotal)}원</span>
                    <span>{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
       * ② 매출 추이 AreaChart (2/3) + 수입 구성 도넛 (1/3)
       ════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-5">
            <div>
              <h2 className="text-base font-bold text-gray-900">매출 추이</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {yoyMode === "overlay"
                  ? "월별 연도간 총매출 비교 (YoY)"
                  : chartSubtitle}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-gray-400">기간 합산</p>
              <p className="text-lg font-bold text-indigo-600">{fmtAmount(periodTotal)}원</p>
            </div>
          </div>
          {yoyMode === "overlay" ? (
            <CategoryTrendChart
              data={yoyRevenueData}
              categories={YEARS_YOY}
              colors={YEAR_COLORS}
              labels={YEAR_LABELS}
            />
          ) : (
            <StatsArea data={periodChartData} />
          )}
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-base font-bold text-gray-900 mb-1">수입 구성 분석</h2>
          <p className="text-xs text-gray-400 mb-4">{selectedYear === "all" ? "전체 기간" : selectedYear + "년"} 수입 유형별 비중</p>
          <StatsDonut data={incomeBreakdown} />
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
       * ③ 외부수입 전용 분석 Row — [STEP 3: 매출 추이 바로 아래 배치]
       *    좌: 월별 외부수입 트렌드 LineChart (체험비·강사수수료·기타)
       *    우: 기존 외부수입 파이프라인 도넛 차트
       ════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* 좌: 월별 외부수입 트렌드 (col-span-2 → 매출 추이와 너비 일치) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-base font-bold text-gray-900 mb-1">월별 외부수입 트렌드</h2>
          <p className="text-xs text-gray-400 mb-5">
            {yoyMode === "overlay"
              ? "월별 연도간 외부수입 비교 (YoY)"
              : (selectedYear === "all" ? "연도별" : selectedYear + "년 월별") + " 외부수입 유형 추이"}
            {yoyMode !== "overlay" && <span className="ml-2 text-gray-300">· 체험비 / 강사수수료 / 기타</span>}
          </p>
          {yoyMode === "overlay" ? (
            <ExternalTrendChart
              data={yoyExtData}
              types={YEARS_YOY}
              colors={YEAR_COLORS}
            />
          ) : (
            <ExternalTrendChart
              data={extTrendData}
              types={EXT_TREND_TYPES}
              colors={EXTERNAL_COLORS}
            />
          )}
        </div>

        {/* 우: 기존 외부수입 파이프라인 도넛 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-base font-bold text-gray-900 mb-1">외부수입 파이프라인 분석</h2>
          <p className="text-xs text-gray-400 mb-4">{selectedYear === "all" ? "전체 기간" : selectedYear + "년"} 카테고리별 외부수입 비중</p>
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
              <span className="text-base font-bold text-gray-900">{fmtAmount(extPipelineTotal)}원</span>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
       * ④ 신규 유입 vs 이탈 (1/2) + 유입경로 트렌드 (1/2)
       ════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <h2 className="text-base font-bold text-gray-900">신규 유입 vs 이탈 추이</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {yoyMode === "overlay"
                  ? "월별 연도간 신규 유입 비교 (YoY)"
                  : (selectedYear === "all" ? "연도별" : selectedYear + "년 월별") + " 학생 변동"}
              </p>
            </div>
            {yoyMode !== "overlay" && (
              <div className="flex gap-4 text-xs text-gray-400 shrink-0 mt-0.5">
                <span className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-blue-500 inline-block" />신규</span>
                <span className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-dashed border-rose-400 inline-block" />이탈</span>
              </div>
            )}
          </div>
          {yoyMode === "overlay" ? (
            <InflowTrendChart
              data={yoyFlowData}
              routes={YEARS_YOY}
              colors={YEAR_COLORS}
            />
          ) : (
            <StatsLine data={periodStudentFlow} />
          )}
          <p className="text-xs text-gray-300 mt-3">
            {yoyMode === "overlay"
              ? "※ 신규: 해당 월에 첫 결제한 학생 수 (연도별 비교)"
              : "※ 신규: 첫 결제 학생 / 이탈: is_active=false의 마지막 결제 기준"}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-base font-bold text-gray-900 mb-1">
            {selectedYear === "all" ? "연도별" : selectedYear + "년 월별"} 유입경로 트렌드
          </h2>
          <p className="text-xs text-gray-400 mb-1">
            경로 확인된 수강생 {inflowTrendData.validCount}명 기준 (NULL·없음 제외)
          </p>
          <p className="text-xs text-gray-300 mb-4">
            X축: {selectedYear === "all" ? "첫 결제 연도" : selectedYear + "년 첫 결제 월"} 기준 / Y축: 유입 수강생 수
          </p>
          <InflowTrendChart
            data={inflowTrendData.data}
            routes={inflowTrendData.routes}
            colors={inflowTrendData.colors}
          />
          {inflowTrendData.routes.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {inflowTrendData.routes.map((route) => {
                const total = inflowTrendData.data.reduce(
                  (s, d) => s + (typeof d[route] === "number" ? (d[route] as number) : 0), 0
                );
                return (
                  <span
                    key={route}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white"
                    style={{ background: inflowTrendData.colors[route] ?? "#94a3b8" }}
                  >
                    {route} {total}명
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
       * ⑤ VIP 위젯 2단 분할
       *    좌: 결제 총액 순위 TOP 10
       *    우: 결제 횟수(납부 개월 수) 기준 장기 수강생 TOP 10 (신설)
       ════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* 좌: 결제 총액 기준 VIP TOP 10 */}
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
                  <th className="py-2.5 px-2 text-gray-400 font-medium text-xs hidden sm:table-cell">비중</th>
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

        {/* 우: 결제 횟수(납부 개월 수) 기준 장기 수강생 TOP 10 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="mb-5">
            <h2 className="text-base font-bold text-gray-900">장기 수강생 TOP 10</h2>
            <p className="text-xs text-gray-400 mt-0.5">{selectedYear === "all" ? "전체 기간" : selectedYear + "년"} 총 납부 횟수 순위</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2.5 px-2 text-gray-400 font-medium text-xs w-10">순위</th>
                  <th className="text-left py-2.5 px-2 text-gray-400 font-medium text-xs">이름</th>
                  <th className="text-right py-2.5 px-2 text-gray-400 font-medium text-xs">납부 횟수</th>
                  <th className="text-right py-2.5 px-2 text-gray-400 font-medium text-xs hidden sm:table-cell">최초 등록</th>
                </tr>
              </thead>
              <tbody>
                {periodLongevityTop10.map((v, i) => {
                  const medal = ["🥇","🥈","🥉"][i] ?? null;
                  const [fy, fm] = v.firstMonth.split("-");
                  const firstLabel = `${fy}년 ${parseInt(fm)}월`;
                  return (
                    <tr key={v.name + i} className="border-b border-gray-50 hover:bg-teal-50/30 transition-colors">
                      <td className="py-3 px-2">{medal ? <span className="text-lg">{medal}</span> : <span className="text-gray-400 text-xs font-medium">{i+1}</span>}</td>
                      <td className="py-3 px-2 font-semibold text-gray-900">{v.name}</td>
                      <td className="py-3 px-2 text-right font-bold text-teal-600">{v.count}회</td>
                      <td className="py-3 px-2 text-right text-xs text-gray-400 hidden sm:table-cell">{firstLabel}</td>
                    </tr>
                  );
                })}
                {periodLongevityTop10.length === 0 && <tr><td colSpan={4} className="py-10 text-center text-gray-400 text-sm">데이터 없음</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
}
