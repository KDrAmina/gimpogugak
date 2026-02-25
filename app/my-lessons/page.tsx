"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type LessonData = {
  id: string;
  category: string;
  current_session: number;
  payment_date: string | null;
  reschedule_note: string | null;
};

type LessonHistory = {
  id: string;
  lesson_id: string;
  session_number: number;
  completed_date: string;
  status: string | null;
};

const ITEMS_PER_PAGE = 10;

export default function MyLessonsPage() {
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string>("회원");
  const [lessonData, setLessonData] = useState<LessonData | null>(null);
  const [history, setHistory] = useState<LessonHistory[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkAccess();
  }, []);

  async function checkAccess() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("status, name")
        .eq("id", user.id)
        .single();

      if (profile?.status !== "active") {
        router.push("/");
        return;
      }

      setUserName(profile?.name || "회원");
      
      // Load lesson data
      await loadLessonData(user.id);
    } catch (error) {
      console.error("Access check error:", error);
      router.push("/");
    } finally {
      setLoading(false);
    }
  }

  async function loadLessonData(userId: string) {
    try {
      // Get the currently active lesson (is_active = true) to avoid picking up archived cycles
      const { data: lesson, error: lessonError } = await supabase
        .from("lessons")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .single();

      if (lessonError) {
        if (lessonError.code === "PGRST116") {
          // No lesson found
          setLessonData(null);
          return;
        }
        throw lessonError;
      }

      setLessonData(lesson);

      // Get lesson history
      if (lesson) {
        const { data: historyData, error: historyError } = await supabase
          .from("lesson_history")
          .select("id, lesson_id, session_number, completed_date, status")
          .eq("lesson_id", lesson.id)
          .order("completed_date", { ascending: false });

        console.log("Fetched Lesson History Data:", historyData, "Error:", historyError);

        if (historyError) {
          console.error("Lesson history fetch error:", historyError);
        } else {
          setHistory(historyData || []);
        }
      }
    } catch (error) {
      console.error("Error loading lesson data:", error);
    }
  }

  function handleInquiry() {
    const message = `안녕하세요, ${userName}입니다.\n\n수업 관련 문의사항이 있습니다.`;
    const directorPhone = "01059481843";
    
    if (confirm("원장님께 카카오톡으로 문의하시겠습니까?")) {
      navigator.clipboard.writeText(message).then(() => {
        window.open(`https://open.kakao.com/o/${directorPhone}`, '_blank');
        alert("✅ 메시지가 클립보드에 복사되었습니다.\n\n카카오톡에 붙여넣기 하세요.");
      }).catch(() => {
        alert(message);
      });
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-500">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!lessonData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">📚</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            수업 정보가 없습니다
          </h2>
          <p className="text-gray-600 mb-6">
            원장님께 문의하여 수업을 등록해주세요.
          </p>
          <button
            onClick={handleInquiry}
            className="w-full px-6 py-3 bg-yellow-400 text-gray-900 rounded-xl hover:bg-yellow-500 transition-colors font-bold shadow-lg"
          >
            💬 원장님께 문의하기
          </button>
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(history.length / ITEMS_PER_PAGE);
  const currentHistory = history.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const remaining = 4 - lessonData.current_session;
  const needsRenewal = lessonData.current_session === 4;
  const progressPercent = (lessonData.current_session / 4) * 100;

  // Two-track UI: group class (단체) vs private class (개인)
  const isGroupClass = lessonData.category.includes('단체');

  // For group: determine if current month is paid
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const isGroupPaidThisMonth = lessonData.payment_date != null && lessonData.payment_date.substring(0, 7) === currentMonthStr;
  // Extract regular payment day from payment_date (e.g. "2026-02-15" → 15)
  const paymentDay = lessonData.payment_date ? parseInt(lessonData.payment_date.split('-')[2], 10) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-8 rounded-b-3xl shadow-xl">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">
            안녕하세요, {userName}님! 👋
          </h1>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium">
              {lessonData.category}
            </span>
            <span className="text-sm text-blue-100">
              {isGroupClass ? "단체수업 (월정액)" : "4회 수강권"}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-6 space-y-4">
        {/* Progress Card — private class only */}
        {!isGroupClass && <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg md:text-xl font-bold text-gray-900">수업 진행 현황</h2>
            <div className="text-right">
              <div className="text-3xl font-bold text-blue-600">
                {lessonData.current_session}/4
              </div>
              <div className={`text-sm font-medium ${
                needsRenewal ? "text-red-600" : "text-green-600"
              }`}>
                {needsRenewal ? "갱신 필요" : `${remaining}회 남음`}
              </div>
            </div>
          </div>

          {/* Visual Progress - 4 Circles */}
          <div className="flex justify-center gap-3 md:gap-4 mb-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex flex-col items-center gap-2">
                <div
                  className={`w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center text-2xl md:text-3xl font-bold transition-all shadow-lg ${
                    index < lessonData.current_session
                      ? "bg-gradient-to-br from-green-400 to-green-600 text-white scale-105"
                      : "bg-gray-200 text-gray-400"
                  }`}
                >
                  {index < lessonData.current_session ? "✓" : index + 1}
                </div>
                <span className="text-xs text-gray-600 font-medium">
                  {index < lessonData.current_session ? "완료" : "대기"}
                </span>
              </div>
            ))}
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-4 mb-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 h-4 rounded-full transition-all duration-700 relative"
              style={{ width: `${progressPercent}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
            </div>
          </div>
          <p className="text-center text-sm text-gray-600">
            {needsRenewal ? (
              <span className="text-red-600 font-bold">
                🎉 4회 수업을 모두 완료했습니다! 다음 기수 등록이 필요합니다.
              </span>
            ) : (
              <>
                <strong className="text-green-600">{remaining}회</strong> 남았습니다
              </>
            )}
          </p>
        </div>}

        {/* Reschedule Note Card (if exists) */}
        {lessonData.reschedule_note && (
          <div className="bg-gradient-to-r from-yellow-400 to-orange-400 rounded-2xl shadow-xl p-6">
            <h2 className="text-lg font-bold mb-2 flex items-center gap-2 text-gray-900">
              <span>📝</span>
              <span>일정 변경 안내</span>
            </h2>
            <p className="text-gray-800 font-medium">
              {lessonData.reschedule_note}
            </p>
          </div>
        )}

        {/* 최근 수강/납부 내역 Card — both private and group */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span>📋</span>
            <span>{isGroupClass ? "최근 납부 내역" : "최근 수강 내역"}</span>
          </h2>
          {history.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              {isGroupClass ? "아직 납부 기록이 없습니다." : "아직 수강 기록이 없습니다."}
            </p>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-100" />
              <div className="space-y-3">
                {currentHistory.map((record) => {
                  const status = record.status ?? (isGroupClass ? "결제 완료" : "출석");
                  const statusStyles: Record<string, string> = {
                    "출석": "bg-green-100 text-green-700",
                    "결석": "bg-red-100 text-red-600",
                    "보강": "bg-blue-100 text-blue-700",
                    "대기": "bg-yellow-100 text-yellow-700",
                    "결제 완료": "bg-green-100 text-green-700",
                  };
                  const dotStyles: Record<string, string> = {
                    "출석": "bg-green-500",
                    "결석": "bg-red-400",
                    "보강": "bg-blue-500",
                    "대기": "bg-yellow-400",
                    "결제 완료": "bg-green-500",
                  };
                  const badgeCls = statusStyles[status] ?? "bg-gray-100 text-gray-600";
                  const dotCls = dotStyles[status] ?? "bg-gray-400";

                  return (
                    <div key={record.id} className="flex items-start gap-4 relative">
                      {/* Timeline dot */}
                      <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm flex-shrink-0 ${dotCls}`}>
                        {isGroupClass ? "✓" : record.session_number}
                      </div>
                      <div className="flex-1 bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">
                            {isGroupClass
                              ? new Date(record.completed_date).toLocaleDateString("ko-KR", {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                })
                              : `${record.session_number}회차`}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {isGroupClass
                              ? "결제 완료"
                              : new Date(record.completed_date).toLocaleDateString("ko-KR", {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                })}
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold flex-shrink-0 ${badgeCls}`}>
                          {status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-5">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    이전
                  </button>
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${
                        currentPage === i + 1
                          ? "bg-blue-600 text-white shadow"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    다음
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Group Payment Info Card — group class only */}
        {isGroupClass && (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
              <span>💳</span>
              <span>결제 안내</span>
            </h2>

            {/* Regular payment day */}
            <div className="flex items-center justify-between mb-5 pb-5 border-b border-gray-100">
              <div>
                <p className="text-xs text-gray-500 mb-1">정기 납부일</p>
                <p className="text-2xl font-bold text-gray-900">
                  {paymentDay != null ? `매월 ${paymentDay}일` : "미등록"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 mb-1">이번 달 납부</p>
                <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold ${
                  isGroupPaidThisMonth
                    ? "bg-green-100 text-green-700"
                    : lessonData.payment_date == null
                      ? "bg-gray-100 text-gray-500"
                      : "bg-red-100 text-red-600"
                }`}>
                  {isGroupPaidThisMonth
                    ? "✓ 납부 완료"
                    : lessonData.payment_date == null
                      ? "미등록"
                      : "⏳ 납부 대기"}
                </span>
              </div>
            </div>

            {/* Payment account info */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm text-gray-700">
              <p className="font-semibold text-gray-900 mb-2">💰 납부 계좌 안내</p>
              <p><strong>은행:</strong> 국민은행</p>
              <p><strong>계좌번호:</strong> 81140-20-4299435</p>
              <p><strong>예금주:</strong> 김포국악원</p>
              <p className="text-xs text-gray-500 pt-2">
                입금 후 원장님께 카톡으로 알려주시면 확인해 드립니다.
              </p>
            </div>

            {lessonData.payment_date && (
              <p className="text-xs text-gray-400 mt-3 text-right">
                최근 납부 확인일: {new Date(lessonData.payment_date).toLocaleDateString("ko-KR")}
              </p>
            )}
          </div>
        )}

        {/* Payment Status Card — private class only */}
        {!isGroupClass && <div
          className={`rounded-2xl shadow-xl p-6 ${
            needsRenewal
              ? "bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-300"
              : "bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300"
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">결제 상태</h2>
            <span
              className={`px-4 py-2 rounded-full text-sm font-bold shadow-md ${
                needsRenewal
                  ? "bg-red-500 text-white animate-pulse"
                  : "bg-green-500 text-white"
              }`}
            >
              {needsRenewal ? "⚠️ 갱신 필요" : "✓ 진행 중"}
            </span>
          </div>

          {needsRenewal ? (
            <div className="bg-white rounded-xl p-5 border border-red-200">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <span className="text-2xl">💳</span>
                <span>다음 기수 등록 안내</span>
              </h3>
              <div className="space-y-2 text-sm text-gray-700 mb-4">
                <p>
                  <strong>은행:</strong> 국민은행
                </p>
                <p>
                  <strong>계좌번호:</strong> 81140-20-4299435
                </p>
                <p>
                  <strong>예금주:</strong> 김포국악원
                </p>
                <p className="text-xs text-gray-500 mt-3">
                  입금 후 원장님께 카톡으로 알려주시면 다음 4회 수업이 등록됩니다.
                </p>
              </div>
              <button
                onClick={handleInquiry}
                className="w-full px-4 py-3 bg-yellow-400 text-gray-900 rounded-lg hover:bg-yellow-500 transition-colors font-bold"
              >
                💬 원장님께 갱신 문의하기
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-green-700 font-medium flex items-center gap-2">
                <span>✓</span>
                <span>현재 기수 진행 중입니다</span>
              </p>
              {lessonData.payment_date && (
                <p className="text-sm text-gray-600">
                  결제일: {new Date(lessonData.payment_date).toLocaleDateString("ko-KR")}
                </p>
              )}
            </div>
          )}
        </div>}

        {/* Inquiry Button */}
        <div className="bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 rounded-2xl shadow-xl p-6 text-center">
          <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-2">
            수업 변경이 필요하신가요?
          </h2>
          <p className="text-sm text-gray-800 mb-5">
            일정 조정, 보강 수업, 기타 문의사항을 원장님께 편하게 남겨주세요.
          </p>
          <button
            onClick={handleInquiry}
            className="w-full px-6 py-4 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all font-bold shadow-lg flex items-center justify-center gap-2 transform hover:scale-105"
          >
            <span className="text-2xl">💬</span>
            <span>원장님께 문의하기</span>
          </button>
        </div>

        {/* Footer Info */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-5 text-center border border-white/50">
          <div className="mb-2">
            <p className="text-sm text-gray-700 font-medium">
              📞 문의 전화
            </p>
            <p className="text-xl font-bold text-gray-900">
              010-5948-1843
            </p>
          </div>
          <p className="text-xs text-gray-500">
            김포국악원 | Gimpo Gugak Center
          </p>
        </div>
      </div>
    </div>
  );
}
