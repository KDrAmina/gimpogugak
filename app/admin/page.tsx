"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { CHANGELOG, CURRENT_VERSION } from "@/lib/changelog";
import { getTuitionPaymentMessage, getSmsUrl } from "@/lib/messages";

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [totalTuition, setTotalTuition] = useState<number>(0);
  const [tuitionDueList, setTuitionDueList] = useState<{ id: string; student_name: string; category: string; phone: string | null }[]>([]);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkAdminAccess();
  }, []);

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

      await Promise.all([fetchPendingCount(), fetchTotalTuition(), fetchTuitionDue()]);
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
        .select("tuition_amount")
        .eq("is_active", true);

      if (error) throw error;

      const sum = (data || []).reduce((acc, l: { tuition_amount?: number }) => acc + (l.tuition_amount || 0), 0);
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
          current_session,
          category,
          profiles!inner (name, role, phone)
        `)
        .eq("is_active", true)
        .eq("profiles.role", "user");

      if (error) throw error;

      const due = (data || []).filter(
        (l: any) => l.current_session > 0 && l.current_session % 4 === 0
      ).map((l: any) => ({
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">확인 중...</p>
      </div>
    );
  }

  const currentDateTime = new Date().toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

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

      {/* Total Tuition Card */}
      <div className="mb-6 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl shadow-sm border border-emerald-200 p-6">
        <h3 className="text-sm font-medium text-emerald-800 mb-1">
          총 등록 수강료 (Total Tuition)
        </h3>
        <p className="text-3xl md:text-4xl font-bold text-emerald-900">
          ₩ {totalTuition.toLocaleString()}
        </p>
        <p className="mt-1 text-xs text-emerald-700">
          현재 등록된 모든 수강생의 수강료 합계
        </p>
      </div>

      {/* Status Widgets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Widget 1: Pending Approvals */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600">
              대기중인 승인
            </h3>
            <div className="text-3xl">⏳</div>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-4xl font-bold text-blue-600">{pendingCount}</p>
            <span className="text-sm text-gray-500">명</span>
          </div>
          {pendingCount > 0 && (
            <p className="mt-2 text-xs text-amber-600 font-medium">
              승인 대기 중인 회원이 있습니다
            </p>
          )}
        </div>

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

        {/* Widget 3: Last Login */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600">마지막 접속</h3>
            <div className="text-3xl">🕐</div>
          </div>
          <p className="text-lg font-semibold text-gray-900">
            {currentDateTime}
          </p>
          <p className="mt-2 text-xs text-gray-500">현재 시각 기준</p>
        </div>
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
