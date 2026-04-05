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
  isToday: boolean;          // 오늘(또는 금요일 선발송 대상) 여부
  isFridayPreSend: boolean;  // 금요일 선발송 대상 (실제 결제일은 토·일)
  sentToday: boolean;        // 오늘 발송 완료 여부
  sentStatus?: string;    // 'success' | 'fail' | 'invalid_phone'
  sentAt?: string;        // ISO timestamp (발송 시각)
  alimtalkEnabled: boolean; // 알림톡 수동 ON/OFF
};

function getKSTToday(): { day: number; dateStr: string; dayOfWeek: number; satDay: number | null; sunDay: number | null } {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const dayOfWeek = kst.getUTCDay(); // 0=일, 1=월, ..., 5=금, 6=토

  let satDay: number | null = null;
  let sunDay: number | null = null;

  if (dayOfWeek === 5) {
    // 금요일: 토·일 결제일(Day)도 미리 계산
    const satDate = new Date(kst.getTime() + 24 * 60 * 60 * 1000);
    const sunDate = new Date(kst.getTime() + 48 * 60 * 60 * 1000);
    satDay = satDate.getUTCDate();
    sunDay = sunDate.getUTCDate();
  }

  return {
    day: kst.getUTCDate(),
    dateStr: `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`,
    dayOfWeek,
    satDay,
    sunDay,
  };
}

export default function AlimtalkPage() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<GroupedStudent[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDay, setEditDay] = useState("");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ message?: string; success?: number; fail?: number; error?: string } | null>(null);
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
    // 1단계: lesson.id 기준으로 완벽하게 중복 제거 (Cartesian Product 방지)
    const uniqueLessonMap = new Map<string, LessonRow>();
    for (const row of rawRows) {
      if (!uniqueLessonMap.has(row.id)) {
        uniqueLessonMap.set(row.id, row);
      }
    }
    const rows = Array.from(uniqueLessonMap.values());

    const filtered = rows.filter(
      (r) => r.profiles?.status === "active" && r.profiles?.phone
    );

    const { day: todayDay, satDay, sunDay } = getKSTToday();

    // 2단계: 수강생별 그룹화 (이미 고유한 lesson만 존재하므로 중복 합산 불가)
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
          sentToday: false,
          alimtalkEnabled: row.profiles.is_alimtalk_enabled !== false,
        });
      }
    }

    // 오늘 발송 완료 로그 조회 (status·created_at 포함)
    const { dateStr: todayDateStr } = getKSTToday();
    const { data: sentLogs } = await supabase
      .from("notification_log")
      .select("phone, status, created_at")
      .eq("sent_date", todayDateStr)
      .eq("type", "auto_cron");

    type SentLog = { phone: string; status: string; created_at: string };
    // 전화번호 → 최신 로그 맵 (중복 발송 시 마지막 기록 우선)
    const sentMap = new Map<string, SentLog>();
    for (const r of (sentLogs || []) as SentLog[]) {
      const existing = sentMap.get(r.phone);
      if (!existing || r.created_at > existing.created_at) {
        sentMap.set(r.phone, r);
      }
    }
    const sentPhones = new Set(sentMap.keys());

    // 오늘 발송 대상 마킹 (금요일이면 토·일 결제일도 포함)
    const sorted = Array.from(groupMap.values()).map((s) => {
      if (s.paymentDate) {
        const payDay = new Date(s.paymentDate + "T00:00:00").getDate();
        const isWeekendPreSend =
          (satDay !== null && payDay === satDay) ||
          (sunDay !== null && payDay === sunDay);
        s.isToday = payDay === todayDay || isWeekendPreSend;
        // 금요일에 토·일 결제일 대상이면 선발송 플래그 설정
        s.isFridayPreSend = isWeekendPreSend && payDay !== todayDay;
      }
      // 발송 완료 여부 + 상태 마킹
      const cleanPhone = s.phone.replace(/[^0-9]/g, "");
      const logEntry = sentMap.get(cleanPhone) ?? sentMap.get(s.phone);
      if (logEntry) {
        s.sentToday = true;
        s.sentStatus = logEntry.status;
        s.sentAt = logEntry.created_at;
      }
      return s;
    });

    // 1순위: 발송 제외(알림톡 OFF 또는 0원) → 최하단
    // 2순위: 결제일(payment_day) 오름차순
    // 3순위: 이름 가나다순
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
      // 현재 연월 기준으로 payment_date 생성
      const now = new Date();
      const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      const year = kst.getUTCFullYear();
      const month = kst.getUTCMonth() + 1;
      // 해당 월의 마지막 일 체크
      const lastDay = new Date(year, month, 0).getDate();
      const finalDay = Math.min(dayNum, lastDay);
      const newDate = `${year}-${String(month).padStart(2, "0")}-${String(finalDay).padStart(2, "0")}`;

      // 그룹 내 모든 lesson의 payment_date 일괄 업데이트
      const { error } = await supabase
        .from("lessons")
        .update({ payment_date: newDate })
        .in("id", student.lessonIds);

      if (error) {
        throw new Error(error.message);
      }

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

    if (error) {
      alert("저장 실패: " + error.message);
      return;
    }

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
    if (targets.length === 0) {
      alert("발송 대상을 선택해주세요.");
      return;
    }

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
          })),
          scheduledDate: scheduledDate || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "발송 실패");

      setResult({ success: data.success, fail: data.fail });
      alert(`발송 완료: 성공 ${data.success}건, 실패 ${data.fail}건`);
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

  const todayCount = students.filter((s) => s.isToday && s.totalTuition > 0).length;
  const selectedCount = students.filter((s) => s.selected).length;
  const { dateStr: todayDateStr, dayOfWeek: todayDayOfWeek } = getKSTToday();
  const isFriday = todayDayOfWeek === 5;

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
          </p>
        </div>
        {/* 크론 테스트 발송 버튼 */}
        <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
          <button
            type="button"
            onClick={handleTestCron}
            disabled={testSending}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg shadow transition-colors"
          >
            {testSending ? "발송 중..." : "테스트 발송 (크론 수동 실행)"}
          </button>
          {testResult && (
            <div className={`text-xs px-3 py-1.5 rounded-lg border ${
              testResult.error
                ? "bg-red-50 border-red-200 text-red-700"
                : "bg-green-50 border-green-200 text-green-700"
            }`}>
              {testResult.error
                ? `오류: ${testResult.error}`
                : testResult.message
                  ? testResult.message
                  : `성공 ${testResult.success}건 / 실패 ${testResult.fail}건`
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
        <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">
            {isFriday ? "오늘 자동 발송 예정 (금+토+일)" : "오늘 자동 발송 예정"}
          </p>
          <p className="text-lg font-bold text-blue-600">{todayCount}명</p>
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
      {/* 금요일 선발송 안내 배너 (금요일에만 표시) */}
      {isFriday && (
        <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800">
          <strong>금요일 선발송:</strong> 금요일에는 주말(토/일) 결제 대상자에게 문자가 선발송됩니다.
          토·일요일은 스팸 방지를 위해 자동 발송이 실행되지 않습니다.
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
                      s.isToday ? "bg-blue-50" : s.selected ? "bg-yellow-50" : "hover:bg-gray-50"
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
                    <td className="px-4 py-3 text-center">
                      {!s.alimtalkEnabled ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-500 text-xs font-medium rounded-full">
                          발송 제외(수동)
                        </span>
                      ) : s.sentToday ? (
                        s.sentStatus === "fail" || s.sentStatus === "invalid_phone" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                            🔴 발송실패
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                            🟢 발송완료{s.sentAt ? ` ${formatSentTime(s.sentAt)}` : ""}
                          </span>
                        )
                      ) : s.isToday && s.totalTuition <= 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-500 text-xs font-medium rounded-full">
                          발송 제외(0원)
                        </span>
                      ) : s.isToday && s.isFridayPreSend ? (
                        // 금요일 선발송 대기 (실제 결제일은 토·일)
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                          🟠 선발송 대기
                        </span>
                      ) : s.isToday ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
                          🟡 발송대기
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
                        onClick={() => toggleAlimtalk(i)}
                        title={s.alimtalkEnabled ? "클릭하면 발송 제외" : "클릭하면 발송 재개"}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                          s.alimtalkEnabled ? "bg-blue-500" : "bg-gray-300"
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
