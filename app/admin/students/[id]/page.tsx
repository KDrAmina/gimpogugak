"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

type StudentProfile = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
};

type StudentLesson = {
  id: string;
  category: string;
  current_session: number;
  tuition_amount: number;
  payment_date: string | null;
  is_active: boolean;
  created_at: string;
};

type HistoryItem = {
  id: string;
  session_number: number;
  completed_date: string;
  status: string | null;
  category: string;
  tuition_amount: number;
};

export default function StudentDetailPage() {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [lessons, setLessons] = useState<StudentLesson[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [memo, setMemo] = useState('');
  const [editingMemo, setEditingMemo] = useState(false);
  const [memoText, setMemoText] = useState('');
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;
  const supabase = createClient();

  useEffect(() => {
    checkAdminAccess();
  }, []);

  // Load memo from localStorage
  useEffect(() => {
    if (userId) {
      const saved = localStorage.getItem(`student_memo_${userId}`) || '';
      setMemo(saved);
      setMemoText(saved);
    }
  }, [userId]);

  async function checkAdminAccess() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/admin/login"); return; }

      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("role, status")
        .eq("id", user.id)
        .single();

      if (adminProfile?.role !== "admin" || adminProfile?.status !== "active") {
        router.push("/");
        return;
      }

      await loadStudentData();
    } catch {
      router.push("/");
    } finally {
      setLoading(false);
    }
  }

  async function loadStudentData() {
    const [profileRes, lessonsRes] = await Promise.all([
      supabase.from("profiles").select("id, name, email, phone, created_at").eq("id", userId).single(),
      supabase.from("lessons").select("id, category, current_session, tuition_amount, payment_date, is_active, created_at").eq("user_id", userId).order("created_at", { ascending: false }),
    ]);

    if (profileRes.data) setProfile(profileRes.data);

    if (lessonsRes.data) {
      setLessons(lessonsRes.data);
      const lessonIds = lessonsRes.data.map((l: any) => l.id);
      if (lessonIds.length > 0) {
        const { data: histData } = await supabase
          .from("lesson_history")
          .select("id, lesson_id, session_number, completed_date, status, tuition_snapshot, lessons!inner(category, tuition_amount)")
          .in("lesson_id", lessonIds)
          .order("completed_date", { ascending: false })
          .limit(50);

        setHistory((histData || []).map((h: any) => ({
          id: h.id,
          session_number: h.session_number,
          completed_date: h.completed_date,
          status: h.status,
          category: h.lessons?.category || "",
          // tuition_snapshot(결제 시점 금액) 우선, 0이면 fallback으로 현재 수강료
          tuition_amount: (h.tuition_snapshot && h.tuition_snapshot > 0)
            ? h.tuition_snapshot
            : (h.lessons?.tuition_amount || 0),
        })));
      }
    }
  }

  function saveMemo() {
    localStorage.setItem(`student_memo_${userId}`, memoText);
    setMemo(memoText);
    setEditingMemo(false);
  }

  function cancelMemo() {
    setMemoText(memo);
    setEditingMemo(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  const activeLesson = lessons.find(l => l.is_active);
  const paymentHistory = history.filter(h => h.status === "결제 완료");
  const currentMonthStr = new Date().toISOString().substring(0, 7);
  const isPaidThisMonth = activeLesson?.payment_date?.substring(0, 7) === currentMonthStr;
  const totalPaidAmount = paymentHistory.reduce((sum, h) => sum + (h.tuition_amount || 0), 0);

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin/students" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          ← 수강생 목록
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900">
          {profile?.name ?? "수강생"} 상세
        </h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">수업 상태</p>
          <p className={`text-sm font-bold ${activeLesson ? "text-green-600" : "text-gray-400"}`}>
            {activeLesson ? "수업 중" : "미등록"}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">이번 달 납부</p>
          <p className={`text-sm font-bold ${isPaidThisMonth ? "text-green-600" : "text-red-500"}`}>
            {activeLesson ? (isPaidThisMonth ? "완료" : "미납부") : "—"}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">총 납부 횟수</p>
          <p className="text-sm font-bold text-blue-600">{paymentHistory.length}회</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">총 누적 납부액</p>
          <p className="text-sm font-bold text-purple-600">
            {totalPaidAmount > 0 ? `${totalPaidAmount.toLocaleString()}원` : "—"}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">등록일</p>
          <p className="text-sm font-bold text-gray-700">
            {profile?.created_at
              ? new Date(profile.created_at).toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" })
              : "—"}
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Profile */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="text-base">👤</span> 기본 정보
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="text-gray-400 w-16 shrink-0">이름</dt>
              <dd className="font-medium text-gray-900">{profile?.name ?? "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-gray-400 w-16 shrink-0">전화</dt>
              <dd className="font-medium text-gray-900">
                {profile?.phone
                  ? <a href={`tel:${profile.phone}`} className="text-blue-600 hover:underline">{profile.phone}</a>
                  : "—"}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-gray-400 w-16 shrink-0">이메일</dt>
              <dd className="font-medium text-gray-900 truncate">{profile?.email ?? "—"}</dd>
            </div>
          </dl>
        </div>

        {/* Active Lesson */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="text-base">📚</span> 현재 수업
          </h2>
          {activeLesson ? (
            <dl className="space-y-2 text-sm">
              <div className="flex gap-2">
                <dt className="text-gray-400 w-16 shrink-0">카테고리</dt>
                <dd className="font-medium text-gray-900">{activeLesson.category}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-gray-400 w-16 shrink-0">수강료</dt>
                <dd className="font-medium text-gray-900">
                  {activeLesson.tuition_amount > 0
                    ? `${activeLesson.tuition_amount.toLocaleString()}원`
                    : "—"}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-gray-400 w-16 shrink-0">최근 납부</dt>
                <dd className={`font-medium ${isPaidThisMonth ? "text-green-600" : "text-gray-900"}`}>
                  {activeLesson.payment_date
                    ? new Date(activeLesson.payment_date).toLocaleDateString("ko-KR")
                    : "—"}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-gray-400">등록된 수업이 없습니다.</p>
          )}
        </div>
      </div>

      {/* Memo */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <span className="text-base">📝</span> 상담 메모
          </h2>
          {!editingMemo && (
            <button
              onClick={() => setEditingMemo(true)}
              className="text-xs text-blue-600 hover:underline"
            >
              {memo ? "수정" : "메모 추가"}
            </button>
          )}
        </div>
        {editingMemo ? (
          <div>
            <textarea
              value={memoText}
              onChange={(e) => setMemoText(e.target.value)}
              rows={4}
              placeholder="상담 내용, 특이사항 등을 메모하세요..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={saveMemo}
                className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 font-medium"
              >
                저장
              </button>
              <button
                onClick={cancelMemo}
                className="px-4 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs hover:bg-gray-300 font-medium"
              >
                취소
              </button>
            </div>
          </div>
        ) : memo ? (
          <p className="text-sm text-gray-700 whitespace-pre-wrap bg-yellow-50 rounded-lg p-3 border border-yellow-100">
            {memo}
          </p>
        ) : (
          <p className="text-sm text-gray-400 italic">메모 없음</p>
        )}
      </div>

      {/* Payment History */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span className="text-base">💳</span> 결제 이력
          <span className="text-xs text-gray-400 font-normal">({paymentHistory.length}건)</span>
        </h2>
        {paymentHistory.length === 0 ? (
          <p className="text-sm text-gray-400">결제 이력이 없습니다.</p>
        ) : (
          <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
            {paymentHistory.map(h => (
              <div key={h.id} className="py-2 flex items-center justify-between text-sm gap-2">
                <span className="text-gray-500 w-24 shrink-0 tabular-nums">{h.completed_date}</span>
                <span className="text-gray-700 flex-1 truncate">{h.category}</span>
                {h.tuition_amount > 0 && (
                  <span className="text-xs text-gray-500 shrink-0 tabular-nums">
                    {h.tuition_amount.toLocaleString()}원
                  </span>
                )}
                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium shrink-0">
                  납부완료
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* All Lessons (History) */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span className="text-base">📋</span> 전체 수업 내역
          <span className="text-xs text-gray-400 font-normal">({lessons.length}건)</span>
        </h2>
        {lessons.length === 0 ? (
          <p className="text-sm text-gray-400">등록된 수업이 없습니다.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {lessons.map(lesson => (
              <div key={lesson.id} className="py-3 flex items-center justify-between gap-4 text-sm">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className={`shrink-0 inline-block px-2 py-0.5 rounded text-xs font-medium ${lesson.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {lesson.is_active ? "진행중" : "종료"}
                  </span>
                  <span className="font-medium text-gray-900 truncate">{lesson.category}</span>
                </div>
                <div className="text-gray-500 text-right shrink-0 space-x-2 text-xs">
                  {lesson.tuition_amount > 0 && <span>₩{lesson.tuition_amount.toLocaleString()}</span>}
                  {lesson.payment_date && (
                    <span>납부 {lesson.payment_date.substring(0, 7).replace('-', '년 ')}월</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
