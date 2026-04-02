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

type LessonHistoryDate = {
  completed_date: string;
};

type StudentLesson = {
  id: string;
  category: string;
  current_session: number;
  tuition_amount: number;
  payment_date: string | null;
  is_active: boolean;
  created_at: string;
  lesson_history: LessonHistoryDate[];
};

type HistoryItem = {
  id: string;
  session_number: number;
  completed_date: string;
  status: string | null;
  category: string;
  tuition_amount: number;
  category_snapshot: string | null;
};

const CATEGORY_OPTIONS = ['성인단체', '성인개인', '어린이단체', '어린이개인'] as const;

export default function StudentDetailPage() {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [lessons, setLessons] = useState<StudentLesson[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [memo, setMemo] = useState('');
  const [editingMemo, setEditingMemo] = useState(false);
  const [memoText, setMemoText] = useState('');

  // 새 과목 추가 모달
  const [showNewSubject, setShowNewSubject] = useState(false);
  const [newCategories, setNewCategories] = useState<string[]>([]);
  const [newTuition, setNewTuition] = useState('');
  const [newSubjectSaving, setNewSubjectSaving] = useState(false);

  // 타임머신 모달
  const [showTimeMachine, setShowTimeMachine] = useState(false);
  const [tmCategories, setTmCategories] = useState<string[]>([]);
  const [tmTuition, setTmTuition] = useState('');
  const [tmStartMonth, setTmStartMonth] = useState('');
  const [tmEndMonth, setTmEndMonth] = useState('');
  const [tmSaving, setTmSaving] = useState(false);

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
      supabase.from("lessons").select("id, category, current_session, tuition_amount, payment_date, is_active, created_at, lesson_history(completed_date)").eq("user_id", userId).order("created_at", { ascending: false }),
    ]);

    if (profileRes.data) setProfile(profileRes.data);

    if (lessonsRes.data) {
      setLessons(lessonsRes.data);
      const lessonIds = lessonsRes.data.map((l: any) => l.id);
      if (lessonIds.length > 0) {
        const { data: histData } = await supabase
          .from("lesson_history")
          .select("id, lesson_id, session_number, completed_date, status, tuition_snapshot, category_snapshot, lessons!inner(category, tuition_amount)")
          .in("lesson_id", lessonIds)
          .order("completed_date", { ascending: false })
          .limit(50);

        setHistory((histData || []).map((h: any) => ({
          id: h.id,
          session_number: h.session_number,
          completed_date: h.completed_date,
          status: h.status,
          // category_snapshot(결제 시점 과목) 우선, 없으면 현재 과목 fallback
          category: h.category_snapshot || h.lessons?.category || "과목 정보 없음",
          // tuition_snapshot(결제 시점 금액) 우선, 0이면 fallback으로 현재 수강료
          tuition_amount: (h.tuition_snapshot && h.tuition_snapshot > 0)
            ? h.tuition_snapshot
            : (h.lessons?.tuition_amount || 0),
          category_snapshot: h.category_snapshot || null,
        })));
      }
    }
  }

  async function handleDeleteLesson(lessonId: string, category: string) {
    if (!window.confirm(`"${category}" 수업을 정말 삭제하시겠습니까?\n관련된 모든 이력(lesson_history)도 함께 삭제됩니다.`)) {
      return;
    }
    try {
      // 먼저 관련 lesson_history 삭제
      await supabase
        .from("lesson_history")
        .delete()
        .eq("lesson_id", lessonId);

      // lessons row 삭제
      const { error } = await supabase
        .from("lessons")
        .delete()
        .eq("id", lessonId);

      if (error) throw error;

      await loadStudentData();
      alert("✅ 수업이 삭제되었습니다.");
    } catch (error) {
      console.error("Delete lesson error:", error);
      alert("수업 삭제 중 오류가 발생했습니다.");
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

  // 수업 상태 토글 핸들러 (진행중 ↔ 종료)
  async function handleToggleStatus(lessonId: string, currentActive: boolean) {
    const newStatus = !currentActive;
    const label = newStatus ? "진행중" : "종료";
    if (!window.confirm(`이 수업을 "${label}" 상태로 변경하시겠습니까?`)) return;

    try {
      const { error } = await supabase
        .from("lessons")
        .update({ is_active: newStatus })
        .eq("id", lessonId);
      if (error) throw error;
      await loadStudentData();
    } catch (err) {
      console.error("Toggle status error:", err);
      alert("상태 변경 중 오류가 발생했습니다.");
    }
  }

  // 체크박스 토글 헬퍼
  function toggleCategory(list: string[], cat: string): string[] {
    return list.includes(cat) ? list.filter(c => c !== cat) : [...list, cat];
  }

  // 새 과목 추가 핸들러
  async function handleNewSubject() {
    if (newCategories.length === 0) { alert("카테고리를 1개 이상 선택해주세요."); return; }
    const tuition = parseInt(newTuition) || 0;
    if (tuition <= 0) { alert("수강료를 입력해주세요."); return; }

    const categoryStr = newCategories.join(", ");

    setNewSubjectSaving(true);
    try {
      const { error } = await supabase.from("lessons").insert({
        user_id: userId,
        category: categoryStr,
        tuition_amount: tuition,
        is_active: true,
        current_session: 0,
      });
      if (error) throw error;

      await loadStudentData();
      setShowNewSubject(false);
      setNewCategories([]);
      setNewTuition('');
      alert("✅ 새 과목이 추가되었습니다.");
    } catch (err) {
      console.error("New subject error:", err);
      alert("과목 추가 중 오류가 발생했습니다.");
    } finally {
      setNewSubjectSaving(false);
    }
  }

  // 타임머신 (과거 이력 일괄 등록) 핸들러
  async function handleTimeMachine() {
    if (tmCategories.length === 0) { alert("카테고리를 1개 이상 선택해주세요."); return; }
    const tuition = parseInt(tmTuition) || 0;
    if (tuition <= 0) { alert("수강료를 입력해주세요."); return; }
    if (!tmStartMonth || !tmEndMonth) { alert("시작월과 종료월을 입력해주세요."); return; }
    if (tmStartMonth > tmEndMonth) { alert("시작월이 종료월보다 클 수 없습니다."); return; }

    const categoryStr = tmCategories.join(", ");

    setTmSaving(true);
    try {
      // 1. lessons 테이블에 '종료됨' 상태로 INSERT
      const { data: lessonData, error: lessonError } = await supabase
        .from("lessons")
        .insert({
          user_id: userId,
          category: categoryStr,
          tuition_amount: tuition,
          is_active: false,
          current_session: 0,
        })
        .select("id")
        .single();

      if (lessonError || !lessonData) throw lessonError || new Error("lesson 생성 실패");

      const lessonId = lessonData.id;

      // 2. 시작월~종료월 반복하며 lesson_history에 결제 완료 데이터 INSERT
      const historyRows: {
        lesson_id: string;
        session_number: number;
        completed_date: string;
        status: string;
        tuition_snapshot: number;
        category_snapshot: string;
      }[] = [];

      const [startYear, startMonth] = tmStartMonth.split("-").map(Number);
      const [endYear, endMonth] = tmEndMonth.split("-").map(Number);

      let year = startYear;
      let month = startMonth;
      let sessionNum = 1;

      while (year < endYear || (year === endYear && month <= endMonth)) {
        const dateStr = `${year}-${String(month).padStart(2, "0")}-01`;
        historyRows.push({
          lesson_id: lessonId,
          session_number: sessionNum,
          completed_date: dateStr,
          status: "결제 완료",
          tuition_snapshot: tuition,
          category_snapshot: categoryStr,
        });
        sessionNum++;
        month++;
        if (month > 12) { month = 1; year++; }
      }

      if (historyRows.length > 0) {
        const { error: histError } = await supabase
          .from("lesson_history")
          .insert(historyRows);
        if (histError) throw histError;

        // current_session 업데이트
        await supabase
          .from("lessons")
          .update({ current_session: historyRows.length })
          .eq("id", lessonId);
      }

      await loadStudentData();
      setShowTimeMachine(false);
      setTmCategories([]);
      setTmTuition('');
      setTmStartMonth('');
      setTmEndMonth('');
      alert(`✅ 과거 이력 ${historyRows.length}건이 등록되었습니다.`);
    } catch (err) {
      console.error("Time machine error:", err);
      alert("과거 이력 등록 중 오류가 발생했습니다.");
    } finally {
      setTmSaving(false);
    }
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
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <span className="text-base">📋</span> 전체 수업 내역
            <span className="text-xs text-gray-400 font-normal">({lessons.length}건)</span>
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowNewSubject(true)}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 font-medium"
            >
              + 새 과목 추가
            </button>
            <button
              onClick={() => setShowTimeMachine(true)}
              className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs hover:bg-purple-700 font-medium"
            >
              + 과거 이력 일괄 등록
            </button>
          </div>
        </div>
        {lessons.length === 0 ? (
          <p className="text-sm text-gray-400">등록된 수업이 없습니다.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {lessons.map(lesson => (
              <div key={lesson.id} className="py-3 flex items-center justify-between gap-4 text-sm">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <button
                    onClick={() => handleToggleStatus(lesson.id, lesson.is_active)}
                    className={`shrink-0 inline-block px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-colors ${lesson.is_active ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                    title={`클릭하면 "${lesson.is_active ? "종료" : "진행중"}"로 변경`}
                  >
                    {lesson.is_active ? "진행중" : "종료"}
                  </button>
                  <span className="font-medium text-gray-900 truncate">{lesson.category}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-500 text-right shrink-0 text-xs">
                  {lesson.tuition_amount > 0 && <span>₩{lesson.tuition_amount.toLocaleString()}</span>}
                  <span>{(() => {
                    const dates = (lesson.lesson_history || []).map(h => h.completed_date).filter(Boolean).sort();
                    if (dates.length === 0) return "납부 이력 없음";
                    const fmt = (d: string) => { const [y, m] = d.split("-"); return `${Number(y)}년 ${Number(m)}월`; };
                    const start = fmt(dates[0]);
                    if (lesson.is_active) return `${start} ~ 현재`;
                    const end = fmt(dates[dates.length - 1]);
                    return start === end ? start : `${start} ~ ${end}`;
                  })()}</span>
                  <button
                    onClick={() => handleDeleteLesson(lesson.id, lesson.category)}
                    className="px-2 py-0.5 bg-red-100 text-red-600 rounded text-xs font-medium hover:bg-red-200 transition-colors"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 새 과목 추가 모달 */}
      {showNewSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowNewSubject(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">새 과목 추가</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-2">카테고리 (복수 선택 가능)</label>
                <div className="flex flex-wrap gap-3">
                  {CATEGORY_OPTIONS.map(cat => (
                    <label key={cat} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newCategories.includes(cat)}
                        onChange={() => setNewCategories(prev => toggleCategory(prev, cat))}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{cat}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">수강료 (원)</label>
                <input
                  type="number"
                  value={newTuition}
                  onChange={(e) => setNewTuition(e.target.value)}
                  placeholder="예: 100000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={handleNewSubject}
                disabled={newSubjectSaving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 font-medium disabled:opacity-50"
              >
                {newSubjectSaving ? "저장 중..." : "저장"}
              </button>
              <button
                onClick={() => setShowNewSubject(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300 font-medium"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 타임머신 모달 */}
      {showTimeMachine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowTimeMachine(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-1">과거 이력 일괄 등록</h3>
            <p className="text-xs text-gray-500 mb-4">시작월~종료월까지 매월 1건씩 결제 완료 이력을 생성합니다. (종료된 과목으로 등록)</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-2">카테고리 (복수 선택 가능)</label>
                <div className="flex flex-wrap gap-3">
                  {CATEGORY_OPTIONS.map(cat => (
                    <label key={cat} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tmCategories.includes(cat)}
                        onChange={() => setTmCategories(prev => toggleCategory(prev, cat))}
                        className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-sm text-gray-700">{cat}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">수강료 (원/월)</label>
                <input
                  type="number"
                  value={tmTuition}
                  onChange={(e) => setTmTuition(e.target.value)}
                  placeholder="예: 100000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">시작월</label>
                  <input
                    type="month"
                    value={tmStartMonth}
                    onChange={(e) => setTmStartMonth(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">종료월</label>
                  <input
                    type="month"
                    value={tmEndMonth}
                    onChange={(e) => setTmEndMonth(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>
              {tmStartMonth && tmEndMonth && tmStartMonth <= tmEndMonth && (
                <p className="text-xs text-purple-600 font-medium">
                  총 {(() => {
                    const [sy, sm] = tmStartMonth.split("-").map(Number);
                    const [ey, em] = tmEndMonth.split("-").map(Number);
                    return (ey - sy) * 12 + (em - sm) + 1;
                  })()}건의 결제 이력이 생성됩니다.
                </p>
              )}
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={handleTimeMachine}
                disabled={tmSaving}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 font-medium disabled:opacity-50"
              >
                {tmSaving ? "등록 중..." : "일괄 등록"}
              </button>
              <button
                onClick={() => setShowTimeMachine(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300 font-medium"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
