"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { CHANGELOG, CURRENT_VERSION } from "@/lib/changelog";
import { getTuitionPaymentMessage, getSmsUrl } from "@/lib/messages";

type PendingProfile = {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  created_at: string;
};

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [totalTuition, setTotalTuition] = useState<number>(0);
  const [monthlyTuition, setMonthlyTuition] = useState<number>(0);
  const [monthlyExternal, setMonthlyExternal] = useState<number>(0);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    // KST 기준 현재 월 (UTC+9)
    const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  });
  const [tuitionDueList, setTuitionDueList] = useState<{ id: string; student_name: string; category: string; phone: string | null }[]>([]);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [pendingModalOpen, setPendingModalOpen] = useState(false);
  const [pendingProfiles, setPendingProfiles] = useState<PendingProfile[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkAdminAccess();
  }, []);

  useEffect(() => {
    if (!loading) {
      fetchMonthlyTuition(selectedMonth);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth]);

  async function checkAdminAccess() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/admin/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, status")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "admin" || profile?.status !== "active") {
        router.push("/");
        return;
      }

      await Promise.all([fetchPendingCount(), fetchTotalTuition(), fetchTuitionDue(), fetchMonthlyTuition(selectedMonth)]);
    } catch (error) {
      console.error("Access check error:", error);
      router.push("/");
    } finally {
      setLoading(false);
    }
  }

  async function fetchPendingCount() {
    try {
      const { count, error } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending")
        .eq("role", "user");

      if (error) throw error;
      setPendingCount(count || 0);
    } catch (error) {
      console.error("Error fetching pending count:", error);
    }
  }

  async function fetchTotalTuition() {
    try {
      const { data, error } = await supabase
        .from("lessons")
        .select("user_id, tuition_amount")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Deduplicate by user_id (same logic as lessons list page)
      // created_at DESC 정렬이므로 Set에 먼저 들어오는 것(최신)이 유지됨
      const seenUserIds = new Set<string>();
      const sum = (data || []).reduce((acc, l: { user_id: string; tuition_amount?: number }) => {
        if (seenUserIds.has(l.user_id)) return acc;
        seenUserIds.add(l.user_id);
        return acc + (l.tuition_amount || 0);
      }, 0);
      setTotalTuition(sum);
    } catch (error) {
      console.error("Error fetching total tuition:", error);
      setTotalTuition(0);
    }
  }

  async function fetchTuitionDue() {
    try {
      const { data, error } = await supabase
        .from("lessons")
        .select(`
          id,
          user_id,
          current_session,
          category,
          profiles!inner (name, role, phone)
        `)
        .eq("is_active", true)
        .eq("profiles.role", "user")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // 수강생별 최신 1건만 유지 (created_at DESC 정렬이므로 Set에 먼저 들어오는 것이 최신)
      const seenUserIds = new Set<string>();
      const due = (data || [])
        .filter((l: any) => {
          if (seenUserIds.has(l.user_id)) return false;
          seenUserIds.add(l.user_id);
          return l.current_session > 0 && l.current_session % 4 === 0;
        })
        .map((l: any) => ({
          id: l.id,
          student_name: l.profiles?.name || "Unknown",
          category: l.category,
          phone: l.profiles?.phone ?? null,
        }));

      setTuitionDueList(due);
    } catch (error) {
      console.error("Error fetching tuition due:", error);
      setTuitionDueList([]);
    }
  }

  async function fetchMonthlyTuition(month: string) {
    const [year, mon] = month.split("-").map(Number);
    const startDate = `${year}-${String(mon).padStart(2, "0")}-01`;
    // KST 시차 버그 방지: Date.toISOString() 대신 순수 문자열 연산
    const nextYear = mon === 12 ? year + 1 : year;
    const nextMonth = mon === 12 ? 1 : mon + 1;
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

    // ── 정규 수강료 (lesson_history) ──
    try {
      const { data, error } = await supabase
        .from("lesson_history")
        .select("session_number, status, lessons!inner(tuition_amount, category)")
        .gte("completed_date", startDate)
        .lt("completed_date", endDate);

      if (error) throw error;

      const sum = (data || []).reduce((acc, record: any) => {
        const tuition = record.lessons?.tuition_amount || 0;
        if (record.status === "결제 완료") return acc + tuition;
        if (record.session_number > 0 && record.session_number % 4 === 0) return acc + tuition;
        return acc;
      }, 0);
      setMonthlyTuition(sum);
    } catch (error) {
      console.error("Error fetching monthly tuition:", error);
      setMonthlyTuition(0);
    }

    // ── 외부 수입 (external_income) ──
    try {
      const { data, error } = await supabase
        .from("external_income")
        .select("amount")
        .gte("income_date", startDate)
        .lt("income_date", endDate);

      if (error) {
        // 테이블 미존재(42P01) 시 조용히 0 처리
        if (error.code !== "42P01") {
          console.error("Error fetching external income:", error.message);
        }
        setMonthlyExternal(0);
      } else {
        const externalSum = (data || []).reduce((acc, r: { amount: number }) => acc + r.amount, 0);
        setMonthlyExternal(externalSum);
      }
    } catch (error) {
      console.error("Error fetching external income:", error);
      setMonthlyExternal(0);
    }
  }

  async function openPendingModal() {
    setPendingModalOpen(true);
    setPendingLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("status", "pending")
        .eq("role", "user")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPendingProfiles(data || []);
    } catch (error) {
      console.error("Error fetching pending profiles:", error);
    } finally {
      setPendingLoading(false);
    }
  }

  async function handleApprove(userId: string) {
    if (!confirm("이 수강생을 승인하시겠습니까?")) return;
    setProcessing(userId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ status: "active" })
        .eq("id", userId);
      if (error) throw error;
      alert("승인이 완료되었습니다.");
      setPendingProfiles((prev) => prev.filter((p) => p.id !== userId));
      setPendingCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error approving profile:", error);
      alert("승인 처리 중 오류가 발생했습니다.");
    } finally {
      setProcessing(null);
    }
  }

  async function handleReject(userId: string) {
    if (!confirm("이 신청을 거절하시겠습니까?")) return;
    setProcessing(userId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ status: "rejected" })
        .eq("id", userId);
      if (error) throw error;
      alert("거절 처리가 완료되었습니다.");
      setPendingProfiles((prev) => prev.filter((p) => p.id !== userId));
      setPendingCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error rejecting profile:", error);
      alert("거절 처리 중 오류가 발생했습니다.");
    } finally {
      setProcessing(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">확인 중...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          관리자 대시보드
        </h1>
        <p className="text-gray-600">
          김포국악원 관리 시스템 현황을 확인하세요
        </p>
      </div>

      {/* Google Analytics Quick Link */}
      <div className="mb-6">
        <a
          href="https://analytics.google.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200 p-5 group"
        >
          <div className="text-4xl">📊</div>
          <div className="flex-1">
            <p className="text-lg font-bold">구글 애널리틱스</p>
            <p className="text-sm text-blue-100">전체 통계 보기 →</p>
          </div>
          <div className="text-blue-200 group-hover:translate-x-1 transition-transform text-xl">↗</div>
        </a>
      </div>

      {/* Tuition Cards */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 총 등록 수강료 */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl shadow-sm border border-emerald-200 p-6">
          <h3 className="text-sm font-medium text-emerald-800 mb-1">
            총 등록 수강료 (Total Tuition)
          </h3>
          <p className="text-3xl font-bold text-emerald-900">
            ₩ {totalTuition.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-emerald-700">
            현재 등록된 모든 수강생의 수강료 합계
          </p>
        </div>

        {/* 월별 수강료 */}
        <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl shadow-sm border border-violet-200 p-6">
          <div className="flex items-start justify-between mb-1">
            <h3 className="text-sm font-medium text-violet-800">
              월 실수령 총수입
            </h3>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-xs px-2 py-1 border border-violet-300 rounded-lg bg-white text-violet-700 focus:ring-2 focus:ring-violet-400 focus:border-transparent"
            />
          </div>
          <p className="text-3xl font-bold text-violet-900">
            ₩ {(monthlyTuition + monthlyExternal).toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-violet-600">
            정규: ₩{monthlyTuition.toLocaleString()} / 외부: ₩{monthlyExternal.toLocaleString()}
          </p>
          <p className="mt-0.5 text-xs text-violet-500">
            {selectedMonth.replace("-", "년 ")}월 · 수강료 + 체험비 · 외부강의 합산
          </p>
        </div>
      </div>

      {/* Status Widgets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Widget 1: Pending Approvals */}
        <button
          type="button"
          onClick={openPendingModal}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow text-left cursor-pointer w-full"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600">
              승인 대기 중
            </h3>
            <div className="text-3xl">⏳</div>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-4xl font-bold text-blue-600">{pendingCount}</p>
            <span className="text-sm text-gray-500">명</span>
          </div>
          {pendingCount > 0 ? (
            <p className="mt-2 text-xs text-amber-600 font-medium">
              클릭하여 승인 처리하기
            </p>
          ) : (
            <p className="mt-2 text-xs text-gray-400">
              대기 중인 회원이 없습니다
            </p>
          )}
        </button>

        {/* Widget 2: System Status */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600">시스템 상태</h3>
            <div className="text-3xl">✅</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <p className="text-lg font-semibold text-green-600">
              정상 운영 중
            </p>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            모든 시스템이 정상 작동하고 있습니다
          </p>
        </div>

        {/* Widget 3: 알림톡 발송 관리 */}
        <button
          type="button"
          onClick={() => router.push("/admin/alimtalk")}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow text-left cursor-pointer w-full"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600">알림톡 발송 관리</h3>
            <div className="text-3xl">💬</div>
          </div>
          <p className="text-lg font-semibold text-gray-900">
            카카오 알림톡
          </p>
          <p className="mt-2 text-xs text-blue-600 font-medium">
            클릭하여 발송 관리 →
          </p>
        </button>
      </div>

      {/* Tuition Payment Due */}
      {tuitionDueList.length > 0 && (
        <div className="mt-6 bg-amber-50 rounded-xl shadow-sm border border-amber-200 p-6">
          <h3 className="text-lg font-bold text-amber-900 mb-3">
            💰 수강료 입금 대기
          </h3>
          <p className="text-sm text-amber-800 mb-4">
            4회차 수업을 완료하여 수강료 입금이 필요한 수강생입니다. 이름을 클릭하면 메시지가 복사되고 문자 앱이 열립니다.
          </p>
          <ul className="space-y-2">
            {tuitionDueList.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between bg-white rounded-lg px-4 py-3 border border-amber-200"
              >
                <button
                  type="button"
                  onClick={async () => {
                    const message = getTuitionPaymentMessage(item.student_name, item.category);
                    try {
                      await navigator.clipboard.writeText(message);
                      const url = getSmsUrl(item.phone, message);
                      if (url) {
                        window.location.href = url;
                      }
                      alert("메시지가 복사되었습니다. 문자 입력창에 붙여넣기 해주세요.");
                    } catch (e) {
                      alert("메시지 복사 중 오류가 발생했습니다.");
                    }
                  }}
                  disabled={!item.phone}
                  className="font-medium text-gray-900 hover:text-blue-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:no-underline text-left"
                >
                  {item.student_name}
                </button>
                <span className="text-xs text-amber-700 bg-amber-100 px-2 py-1 rounded">
                  {item.category}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* System Info (clickable → Changelog modal) */}
      <button
        type="button"
        onClick={() => setChangelogOpen(true)}
        className="mt-8 w-full text-left bg-gray-100 rounded-lg p-6 hover:bg-gray-200 transition-colors cursor-pointer"
      >
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          시스템 정보
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-gray-600">
          <div>
            <span className="font-medium">버전:</span> v{CURRENT_VERSION}
          </div>
          <div>
            <span className="font-medium">마지막 업데이트:</span>{" "}
            {CHANGELOG[0]?.date ?? "—"}
          </div>
          <div>
            <span className="font-medium">서버 상태:</span>{" "}
            <span className="text-green-600 font-medium">정상</span>
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500">클릭하여 업데이트 내역 보기</p>
      </button>

      {/* Pending Approval Modal */}
      {pendingModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setPendingModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="승인 대기 목록"
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">승인 대기 목록</h2>
              <button
                type="button"
                onClick={() => setPendingModalOpen(false)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              {pendingLoading ? (
                <p className="text-center text-gray-500 py-8">로딩 중...</p>
              ) : pendingProfiles.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  승인 대기 중인 회원이 없습니다.
                </p>
              ) : (
                <div className="space-y-3">
                  {pendingProfiles.map((profile) => (
                    <div
                      key={profile.id}
                      className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-gray-900">
                            {profile.name || "이름 미입력"}
                          </h3>
                          <p className="text-xs text-gray-500 mt-1">
                            {profile.email || "이메일 미입력"}
                          </p>
                          <p className="text-xs text-gray-500">
                            {profile.phone || "연락처 미입력"}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            신청:{" "}
                            {new Date(profile.created_at).toLocaleDateString("ko-KR", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => handleApprove(profile.id)}
                            disabled={processing === profile.id}
                            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                          >
                            {processing === profile.id ? "처리 중..." : "승인"}
                          </button>
                          <button
                            onClick={() => handleReject(profile.id)}
                            disabled={processing === profile.id}
                            className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                          >
                            거절
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Changelog Modal */}
      {changelogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setChangelogOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="업데이트 내역"
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">업데이트 내역</h2>
              <button
                type="button"
                onClick={() => setChangelogOpen(false)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-6">
              {CHANGELOG.map((entry) => (
                <div key={entry.version} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-bold text-blue-600">
                      v{entry.version}
                    </span>
                    <span className="text-xs text-gray-500">{entry.date}</span>
                  </div>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    {entry.changes.map((change, i) => (
                      <li key={i}>{change}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
