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
};

export default function StudentDetailPage() {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [lessons, setLessons] = useState<StudentLesson[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;
  const supabase = createClient();

  useEffect(() => {
    checkAdminAccess();
  }, []);

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
      supabase.from("profiles").select("id, name, email, phone").eq("id", userId).single(),
      supabase.from("lessons").select("id, category, current_session, tuition_amount, payment_date, is_active, created_at").eq("user_id", userId).order("created_at", { ascending: false }),
    ]);

    if (profileRes.data) setProfile(profileRes.data);

    if (lessonsRes.data) {
      setLessons(lessonsRes.data);
      const lessonIds = lessonsRes.data.map((l: any) => l.id);
      if (lessonIds.length > 0) {
        const { data: histData } = await supabase
          .from("lesson_history")
          .select("id, lesson_id, session_number, completed_date, status, lessons!inner(category)")
          .in("lesson_id", lessonIds)
          .order("completed_date", { ascending: false })
          .limit(30);

        setHistory((histData || []).map((h: any) => ({
          id: h.id,
          session_number: h.session_number,
          completed_date: h.completed_date,
          status: h.status,
          category: h.lessons?.category || "",
        })));
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link href="/admin/lessons" className="text-sm text-gray-500 hover:text-gray-700">
          ← 수업 관리
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          {profile?.name ?? "수강생"} 상세
        </h1>
      </div>

      {/* Profile */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-800 mb-3">수강생 정보</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-gray-500 mb-1">이름</dt>
            <dd className="font-medium text-gray-900">{profile?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500 mb-1">이메일</dt>
            <dd className="font-medium text-gray-900">{profile?.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500 mb-1">전화번호</dt>
            <dd className="font-medium text-gray-900">{profile?.phone ?? "—"}</dd>
          </div>
        </dl>
      </div>

      {/* Lessons */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-800 mb-3">수업 목록</h2>
        {lessons.length === 0 ? (
          <p className="text-gray-500 text-sm">등록된 수업이 없습니다.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {lessons.map(lesson => (
              <div key={lesson.id} className="py-3 flex items-center justify-between gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${lesson.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {lesson.is_active ? "진행중" : "종료"}
                  </span>
                  <span className="font-medium text-gray-900">{lesson.category}</span>
                </div>
                <div className="text-gray-600 text-right space-x-2">
                  <span>{lesson.current_session}/4회</span>
                  <span>·</span>
                  <span>₩{lesson.tuition_amount.toLocaleString()}</span>
                  {lesson.payment_date && (
                    <>
                      <span>·</span>
                      <span>납부일 {lesson.payment_date}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent History */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-3">최근 수강 내역 (최대 30건)</h2>
        {history.length === 0 ? (
          <p className="text-gray-500 text-sm">수강 내역이 없습니다.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {history.map(h => (
              <div key={h.id} className="py-2.5 flex items-center justify-between text-sm gap-2">
                <span className="text-gray-500 w-24 shrink-0">{h.completed_date}</span>
                <span className="text-gray-800 flex-1">{h.category}</span>
                <span className="text-gray-600">{h.session_number > 0 ? `${h.session_number}회차` : "납부"}</span>
                <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${h.status === "결제 완료" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                  {h.status ?? "출석"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
