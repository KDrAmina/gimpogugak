"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type LessonRow = {
  id: string;
  user_id: string;
  category: string;
  tuition_amount: number;
  payment_date: string | null;
  is_active: boolean;
  profiles: {
    name: string;
    phone: string | null;
    status: string;
    is_alimtalk_enabled: boolean;
  };
};

type GroupedStudent = {
  baseName: string;
  phone: string;
  userId: string;
  totalTuition: number;
  paymentDate: string | null;
  categories: string[];
  lessonIds: string[]; // 그룹 내 모든 lesson ID (결제일 일괄 수정용)
  selected: boolean;
  /**
   * 발송 대상 여부 플래그
   * - 월~목: 오늘 결제일이면 true
   * - 금요일: 오늘(금)+토+일 결제일이면 true  (말일 보정 포함)
   * - 토·일: 항상 false  → todayCount가 0으로 표시됨
   */
  isToday: boolean;
  /** 금요일 선발송 대상 여부 (실제 결제일은 내일(토) 또는 모레(일)) */
  isFridayPreSend: boolean;
  /**
   * 주말 당일 결제자 여부
   * - 오늘이 토·일이고 payDay가 오늘과 일치 → 금요일에 선발송됐어야 하는 대상
   * - isToday는 false지만 UI에서 별도 배지로 "금요일 발송 완료/미발송" 표시
   */
  isWeekendTarget: boolean;
  sentToday: boolean;     // 발송 완료 여부
  sentStatus?: string;    // 'success' | 'manual_success' | 'fail' | 'manual_fail' | 'invalid_phone'
  sentAt?: string;        // ISO timestamp (발송 시각)
  sentType?: string;      // 'auto_cron' | 'manual'
  sentDate?: string;      // "YYYY-MM-DD" (발송일)
  alimtalkEnabled: boolean;
  /** 이번 달 lesson_history에 결제 완료 기록이 있는지 여부 — 스마트 스킵 UI 표시용 */
  hasPaidThisMonth: boolean;
};

// ─── 날짜 유틸 ────────────────────────────────────────────────────────────────

function formatDateStr(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * KST 기준 오늘 날짜/요일 정보를 반환합니다.
 *
 * 반환값:
 *   kstDate     : KST 현재 시각 (Date 객체)
 *   todayDay    : 오늘 날짜 (1~31)
 *   todayStr    : "YYYY-MM-DD"
 *   dayOfWeek   : 0=일 1=월 2=화 3=수 4=목 5=금 6=토
 *   isFriday    : 오늘이 금요일인지
 *   isWeekend   : 오늘이 토·일요일인지
 *   satDate     : 금요일일 때만 설정 — 내일(토) Date 객체
 *   sunDate     : 금요일일 때만 설정 — 모레(일) Date 객체
 *   prevFridayStr : 토·일요일일 때만 설정 — 직전 금요일 날짜 문자열
 */
function getKSTInfo() {
  const now = new Date();
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const kstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const dayOfWeek = kstDate.getUTCDay(); // 0=일 1=월 … 5=금 6=토
  const isFriday = dayOfWeek === 5;
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // 금요일: 토·일 날짜 계산
  let satDate: Date | null = null;
  let sunDate: Date | null = null;
  if (isFriday) {
    satDate = new Date(kstDate.getTime() + MS_PER_DAY);
    sunDate = new Date(kstDate.getTime() + 2 * MS_PER_DAY);
  }

  // 토·일: 직전 금요일 날짜 계산
  // 토요일(6)이면 1일 전, 일요일(0)이면 2일 전이 금요일
  let prevFridayStr: string | null = null;
  if (dayOfWeek === 6) {
    prevFridayStr = formatDateStr(new Date(kstDate.getTime() - MS_PER_DAY));
  } else if (dayOfWeek === 0) {
    prevFridayStr = formatDateStr(new Date(kstDate.getTime() - 2 * MS_PER_DAY));
  }

  return {
    kstDate,
    todayDay: kstDate.getUTCDate(),
    todayStr: formatDateStr(kstDate),
    dayOfWeek,
    isFriday,
    isWeekend,
    satDate,
    sunDate,
    prevFridayStr,
  };
}

/**
 * payDay(결제일 숫자)가 targetDate와 일치하는지 확인합니다.
 *
 * 말일 보정:
 *   payDay가 targetDate가 속한 달의 마지막 날을 초과하는 경우,
 *   해당 달의 말일로 간주하여 일치 여부를 판정합니다.
 *
 *   예) payDay=31, 대상 날짜 = 4월 30일
 *       → 4월의 마지막 날은 30일이므로 31 > 30 → 말일(30)로 보정 → 일치 ✓
 *
 *   예) payDay=31, 대상 날짜 = 3월 15일
 *       → targetDay=15 ≠ 31, 15 ≠ lastDay(31) → 불일치 ✗
 */
function matchesPayDay(payDay: number, targetDate: Date): boolean {
  const targetDay = targetDate.getUTCDate();
  const targetYear = targetDate.getUTCFullYear();
  const targetMonth = targetDate.getUTCMonth() + 1; // 1-based
  const lastDayOfMonth = new Date(targetYear, targetMonth, 0).getDate();

  if (payDay === targetDay) return true;
  // 결제일이 해당 월의 마지막 날을 초과하면 말일로 보정
  if (payDay > lastDayOfMonth && targetDay === lastDayOfMonth) return true;
  return false;
}

// ─── 컴포넌트 ────────────────────────────────────────────────────────────────

export default function AlimtalkPage() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<GroupedStudent[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDay, setEditDay] = useState("");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{
    message?: string;
    success?: number;
    fail?: number;
    /** 0원 제외 건수 — 크론잡이 반환하는 skippedZero 값 */
    skippedZero?: number;
    /** 주말 등 발송 자체가 없는 경우 */
    skipped?: boolean;
    error?: string;
  } | null>(null);
  const [result, setResult] = useState<{ success: number; fail: number } | null>(null);
  const [scheduledDate, setScheduledDate] = useState("");
  const [showManualSend, setShowManualSend] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const loadStudents = useCallback(async () => {
    const { data, error } = await supabase
      .from("lessons")
      .select(`
        id,
        user_id,
        category,
        tuition_amount,
        payment_date,
        is_active,
        profiles!inner(name, phone, status, is_alimtalk_enabled)
      `)
      .eq("is_active", true)
      .order("payment_date", { ascending: true, nullsFirst: false });

    if (error) {
      console.error("Error loading students:", error);
      return;
    }

    const rawRows = (data || []) as unknown as LessonRow[];
    // lesson.id 기준 완벽 중복 제거 (Cartesian Product 방지)
    const uniqueLessonMap = new Map<string, LessonRow>();
    for (const row of rawRows) {
      if (!uniqueLessonMap.has(row.id)) uniqueLessonMap.set(row.id, row);
    }
    const rows = Array.from(uniqueLessonMap.values());

    const filtered = rows.filter(
      (r) => r.profiles?.status === "active" && r.profiles?.phone
    );

    // ── 날짜·요일 정보 계산 ────────────────────────────────────────────
    const { kstDate, todayDay, todayStr, isFriday, isWeekend, satDate, sunDate, prevFridayStr } = getKSTInfo();

    // ── 수강생별 그룹화 ────────────────────────────────────────────────
    const groupMap = new Map<string, GroupedStudent>();

    for (const row of filtered) {
      const rawName = row.profiles.name || "";
      const baseName = rawName.replace(/[0-9]/g, "").trim();
      const phone = row.profiles.phone || "";
      const key = `${baseName}__${phone}`;

      if (groupMap.has(key)) {
        const existing = groupMap.get(key)!;
        existing.totalTuition += row.tuition_amount || 0;
        existing.lessonIds.push(row.id);
        if (row.category && !existing.categories.includes(row.category)) {
          existing.categories.push(row.category);
        }
        if (row.payment_date) {
          if (!existing.paymentDate || row.payment_date < existing.paymentDate) {
            existing.paymentDate = row.payment_date;
          }
        }
      } else {
        groupMap.set(key, {
          baseName,
          phone,
          userId: row.user_id,
          totalTuition: row.tuition_amount || 0,
          paymentDate: row.payment_date,
          categories: row.category ? [row.category] : [],
          lessonIds: [row.id],
          selected: false,
          isToday: false,
          isFridayPreSend: false,
          isWeekendTarget: false,
          sentToday: false,
          alimtalkEnabled: row.profiles.is_alimtalk_enabled !== false,
          hasPaidThisMonth: false,
        });
      }
    }

    // ── 발송 로그 조회 ─────────────────────────────────────────────────
    /**
     * [이번 달 전체 발송 이력을 조회하는 이유]
     *
     * 오늘 결제일인 수강생뿐 아니라, 이번 달 중 과거에 수동으로 미리
     * 발송한 수강생의 이력도 UI에 반드시 고정 표시해야 합니다.
     *
     * 예) 5일 결제자를 3일에 수동 발송 → 오늘이 4일이어도 발송완료 배지 표시
     *
     * 조회 조건: sent_date >= 이번 달 1일 (auto_cron + manual 모두 포함)
     * 인덱싱 키: phone (notification_log에는 숫자만으로 정규화된 전화번호 저장)
     * 우선순위: created_at 내림차순 → 같은 수강생에게 여러 번 발송 시 최신 이력 우선
     *
     * ⚠️ 주의: sentToday 변수명은 레거시이며, 실제 의미는
     *          "이번 달 발송 이력 존재 여부"입니다. (오늘만이 아님)
     */
    const monthStart = `${kstDate.getUTCFullYear()}-${String(kstDate.getUTCMonth() + 1).padStart(2, "0")}-01`;

    const { data: sentLogs } = await supabase
      .from("notification_log")
      .select("phone, status, created_at, type, sent_date")
      .gte("sent_date", monthStart)
      .order("created_at", { ascending: false });

    type SentLog = { phone: string; status: string; created_at: string; type: string; sent_date: string };

    /**
     * sentMap: 전화번호(숫자 정규화 키) → 이번 달 최신 실제 발송 로그
     *
     * ── 핵심 규칙 ──────────────────────────────────────────────────────────
     * 1. 스킵 상태(skipped_already_paid, skipped_zero_tuition)는 sentMap에서 완전 제외.
     *    → 스킵 로그가 최신이어도 sentToday=false, "대기" 배지가 잘못 표시되는 버그 방지.
     * 2. 전화번호 키를 항상 숫자(digits-only)로 정규화하여 저장.
     *    → 조회 시 cleanPhone(숫자 정규화)과 100% 일치 보장.
     *    → profiles에 대시 포함 "010-XXXX-XXXX" 형식도 정확히 매칭됨.
     * 3. 동일 수강생에게 이번 달 여러 번 발송한 경우 created_at 최신 기록만 유지.
     *
     * ── 발송 배지가 화면에 고정되는 원리 ────────────────────────────────────
     * 1. loadStudents() 호출 시 이번달 1일 이후 notification_log 전체 조회
     * 2. 스킵 제외 + 전화번호 정규화 후 sentMap 구성
     * 3. 각 수강생 cleanPhone → sentMap 조회 → sentToday/sentStatus/sentType 마킹
     * 4. 수동/자동 발송 직후 loadStudents()를 재호출하므로 배지가 즉시 반영됨
     */
    const SKIP_STATUSES = new Set(["skipped_already_paid", "skipped_zero_tuition"]);
    const sentMap = new Map<string, SentLog>();
    for (const r of (sentLogs || []) as SentLog[]) {
      // 스킵 상태는 sentMap에서 제외 — UI의 sentToday 마킹에 사용하지 않음
      if (SKIP_STATUSES.has(r.status)) continue;
      // 전화번호를 숫자로 정규화하여 키로 사용 → cleanPhone 조회와 100% 일치
      const key = r.phone.replace(/[^0-9]/g, "");
      const existing = sentMap.get(key);
      if (!existing || r.created_at > existing.created_at) {
        sentMap.set(key, r);
      }
    }

    // ── 이번 달 납부 완료 여부 조회 (스마트 스킵 UI 동기화) ────────────────
    // lesson_history에서 이번 달 결제 완료 기록이 있는 lesson_id 집합을 구성.
    // UI에서 선결제자를 "이번달 납부완료 (발송제외)" 배지로 표시하기 위해 사용.
    const allLessonIdsForPaidCheck = Array.from(groupMap.values()).flatMap((s) => s.lessonIds);
    const paidThisMonthLessonIds = new Set<string>();

    if (allLessonIdsForPaidCheck.length > 0) {
      const { data: paidRecords } = await supabase
        .from("lesson_history")
        .select("lesson_id")
        .in("lesson_id", allLessonIdsForPaidCheck)
        .eq("status", "결제 완료")
        .gte("completed_date", monthStart);

      for (const r of (paidRecords || []) as { lesson_id: string }[]) {
        paidThisMonthLessonIds.add(r.lesson_id);
      }
    }

    // ── isToday / isFridayPreSend / isWeekendTarget 마킹 ──────────────
    /**
     * 요일별 발송 대상 판정 로직:
     *
     * [토·일요일]
     *   - isToday      = false  → 발송 예정 카운트 0명 표시
     *   - isWeekendTarget = payDay가 오늘과 일치하면 true
     *     (이 대상자는 금요일에 이미 선발송됐으므로 "금요일 발송 완료" 배지 표시)
     *
     * [금요일]
     *   - isToday      = 오늘(금) OR 내일(토) OR 모레(일) 결제일이면 true  (말일 보정 포함)
     *   - isFridayPreSend = 토·일 결제일이면 true (실제 결제일이 주말)
     *
     * [월~목요일]
     *   - isToday      = 오늘 결제일이면 true  (말일 보정 포함)
     */
    const sorted = Array.from(groupMap.values()).map((s) => {
      if (s.paymentDate) {
        const payDay = new Date(s.paymentDate + "T00:00:00").getDate();

        if (isWeekend) {
          // 토·일: 발송 카운트에는 포함하지 않되, 당일 결제자 표시용 플래그 설정
          s.isToday = false;
          s.isWeekendTarget = matchesPayDay(payDay, kstDate);
          s.isFridayPreSend = false;
        } else if (isFriday) {
          // 금요일: 오늘 + 토 + 일 결제자 모두 포함 (말일 보정 포함)
          const matchesToday = matchesPayDay(payDay, kstDate);
          const matchesSat = satDate ? matchesPayDay(payDay, satDate) : false;
          const matchesSun = sunDate ? matchesPayDay(payDay, sunDate) : false;
          s.isToday = matchesToday || matchesSat || matchesSun;
          s.isFridayPreSend = !matchesToday && (matchesSat || matchesSun);
        } else {
          // 월~목: 오늘만 (말일 보정 포함)
          s.isToday = matchesPayDay(payDay, kstDate);
          s.isFridayPreSend = false;
        }
      }

      // ── 이번 달 납부 완료 여부 마킹 ─────────────────────────────────
      s.hasPaidThisMonth = s.lessonIds.some((id) => paidThisMonthLessonIds.has(id));

      // ── 발송 완료 여부 마킹 ──────────────────────────────────────────
      // sentMap은 이미 숫자 정규화된 키 → cleanPhone으로만 조회 (fallback 불필요)
      const cleanPhone = s.phone.replace(/[^0-9]/g, "");
      const logEntry = sentMap.get(cleanPhone);
      if (logEntry) {
        s.sentToday = true;
        s.sentStatus = logEntry.status;
        s.sentAt = logEntry.created_at;
        s.sentType = logEntry.type;
        s.sentDate = logEntry.sent_date;
      }
      return s;
    });

    // 정렬: 1순위 발송 제외(OFF·0원) → 최하단, 2순위 결제일 오름차순, 3순위 이름
    sorted.sort((a, b) => {
      const aExcluded = !a.alimtalkEnabled || a.totalTuition <= 0;
      const bExcluded = !b.alimtalkEnabled || b.totalTuition <= 0;
      if (aExcluded && !bExcluded) return 1;
      if (!aExcluded && bExcluded) return -1;

      const aDay = a.paymentDate ? new Date(a.paymentDate + "T00:00:00").getDate() : 32;
      const bDay = b.paymentDate ? new Date(b.paymentDate + "T00:00:00").getDate() : 32;
      if (aDay !== bDay) return aDay - bDay;

      return a.baseName.localeCompare(b.baseName, "ko");
    });

    // todayDay를 loadStudents 스코프에서 사용하지 않도록 경고 방지
    void todayDay;

    setStudents(sorted);
  }, [supabase]);

  useEffect(() => {
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) { router.push("/admin/login"); return; }

        const { data: profile } = await supabase
          .from("profiles")
          .select("role, status")
          .eq("id", user.id)
          .single();

        if (profile?.role !== "admin" || profile?.status !== "active") {
          router.push("/");
          return;
        }

        await loadStudents();
      } catch {
        router.push("/");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── 결제일 인라인 수정 ─── */
  function startEditing(index: number) {
    const student = students[index];
    const currentDay = student.paymentDate
      ? String(new Date(student.paymentDate + "T00:00:00").getDate())
      : "";
    setEditingIndex(index);
    setEditDay(currentDay);
  }

  async function savePaymentDay(index: number) {
    const student = students[index];
    const dayNum = parseInt(editDay, 10);

    if (!editDay || isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
      alert("1~31 사이의 유효한 일(Day)을 입력해주세요.");
      return;
    }

    setSaving(true);
    try {
      const now = new Date();
      const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      const year = kst.getUTCFullYear();
      const month = kst.getUTCMonth() + 1;
      const lastDay = new Date(year, month, 0).getDate();
      const finalDay = Math.min(dayNum, lastDay);
      const newDate = `${year}-${String(month).padStart(2, "0")}-${String(finalDay).padStart(2, "0")}`;

      const { error } = await supabase
        .from("lessons")
        .update({ payment_date: newDate })
        .in("id", student.lessonIds);

      if (error) throw new Error(error.message);

      setEditingIndex(null);
      setEditDay("");
      await loadStudents();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "저장 실패";
      alert(`결제일 수정 실패: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  function cancelEditing() {
    setEditingIndex(null);
    setEditDay("");
  }

  /* ─── 알림톡 ON/OFF 토글 ─── */
  async function toggleAlimtalk(index: number) {
    const student = students[index];
    const newValue = !student.alimtalkEnabled;

    const { error } = await supabase
      .from("profiles")
      .update({ is_alimtalk_enabled: newValue })
      .eq("id", student.userId);

    if (error) { alert("저장 실패: " + error.message); return; }

    setStudents((prev) =>
      prev.map((s, i) => (i === index ? { ...s, alimtalkEnabled: newValue } : s))
    );
  }

  /* ─── 수동 발송 ─── */
  function toggleSelect(index: number) {
    setStudents((prev) =>
      prev.map((s, i) => (i === index ? { ...s, selected: !s.selected } : s))
    );
  }

  function toggleAll() {
    const allSelected = students.every((s) => s.selected);
    setStudents((prev) => prev.map((s) => ({ ...s, selected: !allSelected })));
  }

  async function handleSend() {
    const targets = students.filter((s) => s.selected);
    if (targets.length === 0) { alert("발송 대상을 선택해주세요."); return; }

    const confirmMsg = scheduledDate
      ? `${targets.length}명에게 ${new Date(scheduledDate).toLocaleString("ko-KR")}에 예약 발송합니다.`
      : `${targets.length}명에게 즉시 발송합니다.`;
    if (!confirm(confirmMsg)) return;

    setSending(true);
    setResult(null);

    try {
      const res = await fetch("/api/alimtalk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targets: targets.map((t) => ({
            name: t.baseName,
            phone: t.phone,
            tuition: t.totalTuition,
            paymentDate: t.paymentDate,
            lessonIds: t.lessonIds,
          })),
          scheduledDate: scheduledDate || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "발송 실패");

      setResult({ success: data.success, fail: data.fail });
      const skipMsg = data.skippedAlreadyPaid > 0 ? `, 이미 납부 제외 ${data.skippedAlreadyPaid}건` : "";
      alert(`발송 완료: 성공 ${data.success}건, 실패 ${data.fail}건${skipMsg}`);
      // 수동 발송 직후 목록 새로고침 → 발송완료 배지가 즉시 표시됨
      await loadStudents();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "발송 오류";
      alert(`발송 오류: ${msg}`);
    } finally {
      setSending(false);
    }
  }

  function formatPaymentDay(dateStr: string | null): string {
    if (!dateStr) return "-";
    const d = new Date(dateStr + "T00:00:00");
    return `매월 ${d.getDate()}일`;
  }

  function formatSentTime(iso: string): string {
    try {
      const d = new Date(iso);
      const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
      const h = String(kst.getUTCHours()).padStart(2, "0");
      const m = String(kst.getUTCMinutes()).padStart(2, "0");
      return `${h}:${m}`;
    } catch { return ""; }
  }

  // "YYYY-MM-DD" → "MM/DD" 형식 (수동발송 배지 날짜 표시용)
  function formatSentDate(dateStr: string): string {
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    return `${parts[1]}/${parts[2]}`;
  }

  /* ─── 크론 테스트 발송 ─── */
  async function handleTestCron() {
    if (!confirm("오늘 결제일인 수강생에게 알림톡을 즉시 발송합니다. (크론 수동 실행)")) return;
    setTestSending(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/test-alimtalk", { method: "POST" });
      const data = await res.json();
      setTestResult(data);
      await loadStudents();
    } catch (err: unknown) {
      setTestResult({ error: err instanceof Error ? err.message : "오류 발생" });
    } finally {
      setTestSending(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  // ── 렌더링용 계산 ──────────────────────────────────────────────────────────
  /**
   * 요일별 todayCount 계산:
   *   - 토·일: isToday가 모두 false → 0명
   *   - 금요일: isToday에 토·일 선발송 대상까지 포함 → 3일치 합산
   *   - 월~목: isToday = 오늘 결제일만
   */
  const todayCount = students.filter((s) => s.isToday && s.totalTuition > 0 && !s.hasPaidThisMonth).length;
  const selectedCount = students.filter((s) => s.selected).length;

  const { todayStr: todayDateStr, isFriday, isWeekend, dayOfWeek: todayDayOfWeek } = getKSTInfo();

  // 오늘 발송 대상(수강료 > 0, 알림톡 ON) 수강생 중 전원 발송 완료 여부
  // → true이면 테스트 발송 버튼을 비활성화하여 실수 중복 발송 방지
  const todayEligible = students.filter(
    (s) => s.isToday && s.totalTuition > 0 && s.alimtalkEnabled && !s.hasPaidThisMonth
  );
  const allTodayTargetsSent =
    todayEligible.length > 0 &&
    todayEligible.every(
      (s) =>
        s.sentToday &&
        s.sentStatus !== "fail" &&
        s.sentStatus !== "manual_fail" &&
        s.sentStatus !== "invalid_phone"
    );
  const isSaturday = todayDayOfWeek === 6;
  const isSunday = todayDayOfWeek === 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            알림톡 자동 발송 관리
          </h1>
          <p className="text-sm text-gray-600">
            매일 KST 오전 10시, 결제일이 해당하는 수강생에게 알림톡이 자동 발송됩니다.
            {isFriday && (
              <span className="ml-1 font-semibold text-orange-600">
                오늘은 금요일 — 주말(토/일) 결제 대상자에게도 선발송됩니다.
              </span>
            )}
            {isWeekend && (
              <span className="ml-1 font-semibold text-purple-600">
                {isSaturday ? "오늘은 토요일" : "오늘은 일요일"} — 자동 발송 없음 (금요일 선발송 완료)
              </span>
            )}
          </p>
        </div>
        {/* 크론 테스트 발송 버튼 */}
        <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
          <button
            type="button"
            onClick={handleTestCron}
            disabled={testSending || allTodayTargetsSent}
            title={allTodayTargetsSent ? "오늘 발송 대상자 전원에게 이미 발송 완료되었습니다." : undefined}
            className={`px-4 py-2 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg shadow transition-colors ${
              allTodayTargetsSent
                ? "bg-gray-400 disabled:bg-gray-400"
                : "bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300"
            }`}
          >
            {testSending
              ? "발송 중..."
              : allTodayTargetsSent
              ? "오늘 발송 완료됨"
              : "테스트 발송 (크론 수동 실행)"}
          </button>
          {testResult && (
            <div className={`text-xs px-3 py-1.5 rounded-lg border ${
              testResult.error
                ? "bg-red-50 border-red-200 text-red-700"
                : "bg-green-50 border-green-200 text-green-700"
            }`}>
              {testResult.error
                ? `오류: ${testResult.error}`
                : testResult.skipped
                  ? (testResult.message || "주말 — 자동 발송 없음")
                  : (() => {
                      // DB 기록 기반으로 팩트를 명확히 표시
                      // 크론잡 응답: { success, fail, skippedZero } 활용
                      const s = testResult.success ?? 0;
                      const f = testResult.fail ?? 0;
                      const z = testResult.skippedZero ?? 0;
                      const p = (testResult as Record<string, unknown>).skippedAlreadyPaid as number ?? 0;
                      if (s === 0 && f === 0 && z === 0 && p === 0) {
                        return testResult.message || "발송 대상 없음";
                      }
                      const parts: string[] = [`성공: ${s}건`];
                      if (f > 0) parts.push(`실패: ${f}건`);
                      if (z > 0) parts.push(`0원 제외: ${z}건`);
                      if (p > 0) parts.push(`납부완료 제외: ${p}건`);
                      return `오전 10시 자동 발송 완료 (${parts.join(", ")})`;
                    })()
              }
            </div>
          )}
        </div>
      </div>

      {/* 오늘 발송 현황 카드 */}
      <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">오늘 날짜 (KST)</p>
          <p className="text-lg font-bold text-gray-900">{todayDateStr}</p>
        </div>
        <div className={`bg-white rounded-xl border shadow-sm p-4 ${isWeekend ? "border-gray-200" : "border-blue-200"}`}>
          <p className="text-xs text-gray-500 mb-1">
            {/* 요일에 따라 카드 레이블 동적 표시 */}
            {isWeekend
              ? "자동 발송 예정 (주말 없음)"
              : isFriday
              ? "오늘 자동 발송 예정 (금+토+일)"
              : "오늘 자동 발송 예정"}
          </p>
          <p className={`text-lg font-bold ${isWeekend ? "text-gray-400" : "text-blue-600"}`}>
            {/* 토·일: isToday=false 이므로 todayCount는 자동으로 0 */}
            {todayCount}명
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">전체 활성 수강생</p>
          <p className="text-lg font-bold text-gray-900">{students.length}명</p>
        </div>
      </div>

      {/* 안내 배너 */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <strong>자동 발송 기준:</strong> 각 수강생의 결제일(Day)이 오늘과 일치하면 자동 발송됩니다.
        아래 표에서 <strong>결제일을 클릭</strong>하여 발송 기준일을 변경할 수 있습니다.
      </div>

      {/* 금요일 선발송 안내 (금요일에만 표시) */}
      {isFriday && (
        <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800">
          <strong>금요일 선발송:</strong> 금요일에는 주말(토/일) 결제 대상자에게 문자가 선발송됩니다.
          토·일요일은 스팸 방지를 위해 자동 발송이 실행되지 않습니다.
        </div>
      )}

      {/* 주말 안내 (토·일에만 표시) */}
      {isWeekend && (
        <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-800">
          <strong>주말 발송 없음:</strong> 오늘({isSaturday ? "토요일" : "일요일"})은 자동 발송이 실행되지 않습니다.
          오늘 결제일인 수강생은 <strong>지난 금요일에 선발송</strong>되었습니다.
          아래 목록에서 금요일 발송 결과를 확인할 수 있습니다.
        </div>
      )}

      {/* 수강생 스케줄 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {showManualSend && (
                  <th className="px-3 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      checked={students.length > 0 && students.every((s) => s.selected)}
                      onChange={toggleAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                )}
                <th className="px-4 py-3 text-left font-medium text-gray-700">이름</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">연락처</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">수강 과목</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">합산 수강료</th>
                <th className="px-4 py-3 text-center font-medium text-gray-700">
                  결제일 (클릭 수정)
                </th>
                <th className="px-4 py-3 text-center font-medium text-gray-700">상태</th>
                <th className="px-4 py-3 text-center font-medium text-gray-700">알림톡</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr>
                  <td colSpan={showManualSend ? 8 : 7} className="px-4 py-8 text-center text-gray-500">
                    활성 수강생이 없습니다.
                  </td>
                </tr>
              ) : (
                students.map((s, i) => (
                  <tr
                    key={`${s.baseName}-${s.phone}`}
                    className={`border-b border-gray-100 ${
                      // 행 배경색:
                      // - 오늘/금요일 발송 대상(isToday) → 파란 배경
                      // - 토·일 당일 결제자(isWeekendTarget) → 보라 배경 (금요일 이미 발송)
                      // - 선택됨 → 노란 배경
                      // - 기본 → 호버 시 회색
                      s.isToday
                        ? "bg-blue-50"
                        : s.isWeekendTarget
                        ? "bg-purple-50"
                        : s.selected
                        ? "bg-yellow-50"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    {showManualSend && (
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={s.selected}
                          onChange={() => toggleSelect(i)}
                          className="rounded border-gray-300"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 font-medium text-gray-900">{s.baseName}</td>
                    <td className="px-4 py-3 text-gray-600">{s.phone}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {s.categories.map((c) => (
                          <span
                            key={c}
                            className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {s.totalTuition.toLocaleString("ko-KR")}원
                    </td>
                    <td className="px-4 py-3 text-center">
                      {editingIndex === i ? (
                        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <span className="text-xs text-gray-500">매월</span>
                          <input
                            type="number"
                            min={1}
                            max={31}
                            value={editDay}
                            onChange={(e) => setEditDay(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") savePaymentDay(i);
                              if (e.key === "Escape") cancelEditing();
                            }}
                            className="w-14 px-1 py-0.5 text-center border border-blue-400 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            autoFocus
                            disabled={saving}
                          />
                          <span className="text-xs text-gray-500">일</span>
                          <button
                            onClick={() => savePaymentDay(i)}
                            disabled={saving}
                            className="ml-1 px-2 py-0.5 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 disabled:bg-gray-300"
                          >
                            {saving ? "..." : "저장"}
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded hover:bg-gray-300"
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditing(i)}
                          className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                            s.paymentDate
                              ? "bg-gray-100 hover:bg-gray-200 text-gray-800"
                              : "bg-red-50 hover:bg-red-100 text-red-600 border border-red-200"
                          }`}
                          title="클릭하여 결제일 수정"
                        >
                          {s.paymentDate ? formatPaymentDay(s.paymentDate) : "미설정"}
                        </button>
                      )}
                    </td>

                    {/* ── 상태 배지 ────────────────────────────────────────────
                     * 우선순위 (엄격 순서):
                     * 1. 알림톡 OFF          → 발송 제외(수동)   [영구 설정]
                     * 2. 수강료 0원          → 발송 제외(0원)    [항상 제외]
                     * 3. 이번 달 납부 완료   → 이번달 납부완료   [최우선 정보]
                     * 4. 발송 성공/실패 이력 → 수동발송/발송완료/발송실패
                     * 5. 금요일 선발송 대상  → 선발송 대상
                     * 6. 오늘 발송 대기      → 발송대기
                     * 7. 토·일 결제자        → 금요일 미발송
                     * 8. 결제일 있음         → 대기
                     * 9. 결제일 없음         → 미설정
                     *
                     * ⚠️ hasPaidThisMonth는 sentToday보다 반드시 위에 위치해야 함.
                     *    sentToday는 실제 발송(success/fail) 이력만 포함
                     *    (skipped_already_paid·skipped_zero_tuition은 sentMap에서 제외됨)
                     ──────────────────────────────────────────────────── */}
                    <td className="px-4 py-3 text-center">
                      {!s.alimtalkEnabled ? (
                        // 1. 영구 발송 제외
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-500 text-xs font-medium rounded-full">
                          발송 제외(수동)
                        </span>
                      ) : s.totalTuition <= 0 ? (
                        // 2. 0원 — 결제일 여부 무관하게 항상 표시
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-500 text-xs font-medium rounded-full">
                          발송 제외(0원)
                        </span>
                      ) : s.hasPaidThisMonth ? (
                        // 3. 이번 달 납부 완료 (최우선 — 발송 여부보다 중요)
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                          🔵 이번달 납부완료 (발송제외)
                        </span>
                      ) : s.sentToday ? (
                        // 4. 실제 발송 이력 있음 (skipped 상태는 sentMap에서 제외됨)
                        s.sentStatus === "fail" || s.sentStatus === "invalid_phone" || s.sentStatus === "manual_fail" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                            🔴 발송실패{s.sentType === "manual" ? " (수동)" : isWeekend ? " (금)" : ""}
                          </span>
                        ) : s.sentStatus === "manual_success" ? (
                          // 수동 발송 성공 — 발송일(MM/DD) 고정 표시
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                            🟢 수동발송{s.sentDate ? ` (${formatSentDate(s.sentDate)})` : ""}
                          </span>
                        ) : s.sentStatus === "success" ? (
                          // 자동 크론 발송 성공 — 발송일(MM/DD) 표시
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                            🟢 {isWeekend ? "금요일 발송완료" : "발송완료"}{s.sentDate ? ` (${formatSentDate(s.sentDate)})` : ""}
                          </span>
                        ) : (
                          // 알 수 없는 상태 — 발송일만 표시
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                            🟢 발송완료{s.sentDate ? ` (${formatSentDate(s.sentDate)})` : ""}
                          </span>
                        )
                      ) : s.isToday && s.isFridayPreSend ? (
                        // 금요일: 토·일 결제자 → 오늘 선발송 예정
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                          🟠 금요일 선발송 대상
                        </span>
                      ) : s.isToday ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
                          🟡 발송대기
                        </span>
                      ) : s.isWeekendTarget ? (
                        // 토·일: 오늘 결제자인데 sentToday=false → 금요일 미발송(비정상)
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-500 text-xs font-medium rounded-full">
                          ⚠️ 금요일 미발송
                        </span>
                      ) : s.paymentDate ? (
                        <span className="text-xs text-gray-400">대기</span>
                      ) : (
                        <span className="text-xs text-red-500">미설정</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => !s.hasPaidThisMonth && toggleAlimtalk(i)}
                        title={
                          s.hasPaidThisMonth
                            ? "이번 달 이미 납부 완료 — 발송이 자동 제외됩니다"
                            : s.alimtalkEnabled
                            ? "클릭하면 발송 제외"
                            : "클릭하면 발송 재개"
                        }
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                          s.hasPaidThisMonth
                            ? "bg-gray-200 opacity-40 cursor-not-allowed"
                            : s.alimtalkEnabled
                            ? "bg-blue-500"
                            : "bg-gray-300"
                        }`}
                      >
                        <span
                          className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                            s.alimtalkEnabled ? "translate-x-5" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 수동 발송 섹션 (접이식) */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setShowManualSend(!showManualSend)}
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
        >
          <span className="text-sm font-medium text-gray-700">
            수동 발송 (즉시/예약)
          </span>
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform ${showManualSend ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showManualSend && (
          <div className="px-4 pb-4 border-t border-gray-200 pt-3">
            <p className="text-xs text-gray-500 mb-3">
              위 표에서 체크박스로 대상을 선택한 후 발송하세요. 동일인물은 수강료가 합산됩니다.
            </p>

            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                예약 발송 일시 (선택)
              </label>
              <input
                type="datetime-local"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">
                {scheduledDate
                  ? `${new Date(scheduledDate).toLocaleString("ko-KR")} 예약 발송`
                  : "미선택 시 즉시 발송"}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {selectedCount}명 선택 / 총 {students.length}명
              </span>
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || selectedCount === 0}
                className="px-5 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow transition-colors text-sm"
              >
                {sending
                  ? "발송 중..."
                  : `알림톡 ${scheduledDate ? "예약" : "즉시"} 발송 (${selectedCount}명)`}
              </button>
            </div>

            {result && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                발송 결과: 성공 <strong>{result.success}</strong>건, 실패{" "}
                <strong>{result.fail}</strong>건
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
