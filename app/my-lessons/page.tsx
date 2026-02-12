"use client";

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
  session_number: number;
  completed_date: string;
  note: string | null;
};

export default function MyLessonsPage() {
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string>("회원");
  const [lessonData, setLessonData] = useState<LessonData | null>(null);
  const [history, setHistory] = useState<LessonHistory[]>([]);
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
      // Get lesson data
      const { data: lesson, error: lessonError } = await supabase
        .from("lessons")
        .select("*")
        .eq("user_id", userId)
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
          .select("session_number, completed_date, note")
          .eq("lesson_id", lesson.id)
          .order("session_number", { ascending: false });

        if (!historyError) {
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

  const remaining = 4 - lessonData.current_session;
  const needsRenewal = lessonData.current_session === 4;
  const progressPercent = (lessonData.current_session / 4) * 100;

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
              4회 수강권
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-6 space-y-4">
        {/* Progress Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
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
        </div>

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

        {/* Payment Status Card */}
        <div
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
                  <strong>계좌번호:</strong> 123-456-789012
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
        </div>

        {/* Past Lessons Card */}
        {history.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span>📖</span>
              <span>지난 수업 기록</span>
            </h2>
            <div className="space-y-2">
              {history.map((record) => (
                <div
                  key={record.session_number}
                  className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl hover:from-gray-100 hover:to-gray-200 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 text-white rounded-full flex items-center justify-center font-bold shadow-md">
                      {record.session_number}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {record.session_number}회차 수업
                      </p>
                      <p className="text-xs text-gray-600">
                        {new Date(record.completed_date).toLocaleDateString("ko-KR", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">
                    완료
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

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
