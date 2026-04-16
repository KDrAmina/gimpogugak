"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getPersonalGreeting, getTuitionReminderMessage, getKakaoTalkUrl, getSmsUrl } from "@/lib/messages";
import Link from "next/link";

type LessonCategory = "성인단체" | "성인개인" | "어린이개인" | "어린이단체";
const CATEGORIES: LessonCategory[] = ["성인단체", "성인개인", "어린이개인", "어린이단체"];

type ActiveStudent = {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  created_at: string;
  is_test?: boolean;
  lesson_status?: 'active' | 'ended' | 'none';
  lesson_id?: string;
  lesson_category?: string;
  lesson_tuition?: number;
  lesson_payment_date?: string | null;
};

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<ActiveStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<'name' | 'created_at'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [nameSearch, setNameSearch] = useState('');
  const [showMessageInput, setShowMessageInput] = useState(false);
  const [sequentialSending, setSequentialSending] = useState(false);
  const [currentSendIndex, setCurrentSendIndex] = useState(0);
  const [sendingList, setSendingList] = useState<ActiveStudent[]>([]);
  const [customMessage, setCustomMessage] = useState('');
  const [messageType, setMessageType] = useState<'general' | 'tuition'>('general');
  // Edit student info modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<ActiveStudent | null>(null);
  const [editCategory, setEditCategory] = useState<string[]>([]);
  const [editTuition, setEditTuition] = useState(0);
  const [editPaymentDay, setEditPaymentDay] = useState(1);
  const supabase = createClient();

  useEffect(() => {
    fetchActiveStudents();
  }, []);

  async function fetchActiveStudents() {
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .eq("status", "active")
        .eq("role", "user")
        .order("name", { ascending: true });

      if (profilesError) throw profilesError;

      // 현재 활성 수업만 조회 (is_active=true) — 과거 수강생은 이 목록에 포함되지 않음
      const { data: lessonsData } = await supabase
        .from("lessons")
        .select("id, user_id, category, tuition_amount, payment_date")
        .eq("is_active", true);

      const lessonMap = new Map(
        lessonsData?.map(l => [l.user_id, { id: l.id, category: l.category, tuition_amount: l.tuition_amount, payment_date: l.payment_date }]) || []
      );

      const studentsWithLessons = (profilesData || []).map(student => {
        const lesson = lessonMap.get(student.id);
        return {
          ...student,
          lesson_id: lesson?.id,
          lesson_status: lesson ? 'active' as const : 'none' as const,
          lesson_category: lesson?.category || '',
          lesson_tuition: lesson?.tuition_amount || 0,
          lesson_payment_date: lesson?.payment_date || null,
        };
      });

      // 현재 활성 수업이 있는 수강생만 표시 (과거 수강생 및 미등록 제외)
      const activeOnly = studentsWithLessons.filter(s => !!s.lesson_id);

      setStudents(activeOnly);
      console.log("✅ Loaded", activeOnly.length, "currently active students");
    } catch (error) {
      console.error("Error fetching active students:", error);
      alert("수강생 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePermanentDelete(studentId: string, studentName: string) {
    const confirmMsg = `삭제하시면 해당 수강생의 모든 결제 내역과 수업 기록이 완전히 지워지며 절대 복구할 수 없습니다. 정말 삭제하시겠습니까?\n\n수강생: ${studentName}`;

    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch("/api/delete-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: studentId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "삭제 실패");
      }

      if (data.warning) {
        alert(`⚠️ ${data.warning}`);
      } else {
        alert("✅ 수강생이 영구 삭제되었습니다.");
      }

      await fetchActiveStudents();
    } catch (error: any) {
      console.error("Permanent delete error:", error);
      alert(`수강생 삭제 중 오류가 발생했습니다.\n\n${error.message || "알 수 없는 오류"}`);
    }
  }

  async function handleEndLesson(studentName: string, lessonId?: string) {
    if (!lessonId) {
      alert("수업 정보를 찾을 수 없습니다.");
      console.error("Missing lessonId for student:", studentName);
      return;
    }

    const confirmMsg = `정말 수업을 종료하시겠습니까?\n\n수강생: ${studentName}\n\n⚠️ 종료 후에는 수업관리의 '종료된 인원' 탭으로 이동합니다.`;
    
    if (!confirm(confirmMsg)) {
      return;
    }

    try {
      console.log("🔄 Ending lesson:", { studentName, lessonId });

      const { data, error } = await supabase
        .from("lessons")
        .update({ 
          is_active: false
        })
        .eq("id", lessonId)
        .select();

      if (error) {
        console.error("❌ Supabase update error:", error);
        throw error;
      }

      console.log("✅ Lesson ended successfully:", data);
      alert("✅ 수업이 종료되었습니다.");
      
      // Refresh list
      await fetchActiveStudents();
    } catch (error: any) {
      console.error("❌ End lesson error:", error);
      console.error("Error details:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      alert(`수업 종료 중 오류가 발생했습니다.\n\n${error.message || "알 수 없는 오류"}`);
    }
  }

  async function sendKakao(phone: string | null, name: string | null) {
    if (!phone) {
      alert("연락처 정보가 없습니다.");
      return;
    }

    const studentName = name || "회원";
    const message = getPersonalGreeting(studentName);
    const url = getKakaoTalkUrl(phone);

    try {
      await navigator.clipboard.writeText(message);
      if (url) window.open(url, "_blank");
      alert(`✅ 메시지가 클립보드에 복사되었습니다.\n\n수신자: ${studentName}\n\n카카오톡 앱에서 붙여넣기 하세요.`);
    } catch (error) {
      console.error("Clipboard copy error:", error);
      alert("메시지 복사 중 오류가 발생했습니다.");
    }
  }

  async function sendTuitionSms(phone: string | null, name: string | null) {
    if (!phone) {
      alert("연락처 정보가 없습니다.");
      return;
    }

    const studentName = name || "회원";
    const message = getTuitionReminderMessage(studentName);

    try {
      await navigator.clipboard.writeText(message);
      const url = getSmsUrl(phone, message);
      if (url) window.location.href = url;
      alert("메시지가 복사되었습니다. 문자 입력창에 붙여넣기 해주세요.");
    } catch (error) {
      console.error("Clipboard copy error:", error);
      alert("메시지 복사 중 오류가 발생했습니다.");
    }
  }

  function toggleSelectAll() {
    if (selectedIds.size === students.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(students.map((s) => s.id)));
    }
  }

  function toggleSelect(id: string) {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  }

  // Group KakaoTalk feature - Currently disabled
  // KakaoTalk doesn't support multiple recipients in a single action
  // Users should use "개별 연속 발송" for multiple recipients

  function handleSort(field: 'name' | 'created_at') {
    if (sortField === field) {
      // Toggle sort order if clicking the same field
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field and default to ascending
      setSortField(field);
      setSortOrder('asc');
    }
  }

  // Filter by name search
  const filteredByName = nameSearch.trim()
    ? students.filter(s => (s.name || '').toLowerCase().includes(nameSearch.toLowerCase()))
    : students;

  // Sort students based on current sort settings
  const sortedStudents = [...filteredByName].sort((a, b) => {
    let comparison = 0;
    
    if (sortField === 'name') {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      comparison = nameA.localeCompare(nameB, 'ko-KR');
    } else if (sortField === 'created_at') {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      comparison = dateA - dateB;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  function startSequentialSMS(type: 'general' | 'tuition') {
    if (selectedIds.size === 0) {
      alert("수신자를 선택해주세요.");
      return;
    }

    const selectedStudents = students.filter((s) => selectedIds.has(s.id));
    const studentsWithPhone = selectedStudents.filter((s) => s.phone);

    if (studentsWithPhone.length === 0) {
      alert("선택한 수강생 중 연락처가 없습니다.");
      return;
    }

    setSendingList(studentsWithPhone);
    setMessageType(type);
    
    // Set default message
    if (type === 'tuition') {
      const currentMonth = new Date().toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
      });
      setCustomMessage(`안녕하세요 [이름]님, 김포국악원입니다.\n\n${currentMonth} 수강료 납부를 안내드립니다.\n\n문의사항이 있으시면 언제든 연락 주세요.\n감사합니다.`);
    } else {
      setCustomMessage(`안녕하세요 [이름]님, 김포국악원입니다.\n\n`);
    }
    
    setShowMessageInput(true);
  }

  function startSending() {
    if (!customMessage.trim()) {
      alert("메시지를 입력해주세요.");
      return;
    }
    setShowMessageInput(false);
    setCurrentSendIndex(0);
    setSequentialSending(true);
  }

  async function sendCurrentMessage() {
    if (currentSendIndex >= sendingList.length) {
      return;
    }

    const student = sendingList[currentSendIndex];
    const studentName = student.name || "회원";
    const personalizedMessage = customMessage.replace(/\[이름\]/g, studentName);

    try {
      await navigator.clipboard.writeText(personalizedMessage);
      if (messageType === "tuition") {
        const url = getSmsUrl(student.phone, personalizedMessage);
        if (url) window.location.href = url;
        alert("메시지가 복사되었습니다. 문자 입력창에 붙여넣기 해주세요.");
      } else {
        const url = getKakaoTalkUrl(student.phone);
        if (url) window.open(url, "_blank");
        alert(`✅ 메시지가 클립보드에 복사되었습니다.\n\n수신자: ${studentName}\n\n카카오톡 앱에서 붙여넣기 하세요.`);
      }
    } catch (error) {
      console.error("Clipboard copy error:", error);
      alert("메시지 복사 중 오류가 발생했습니다.");
    }
  }

  function handleNextKakao() {
    if (currentSendIndex + 1 >= sendingList.length) {
      // All done
      setSequentialSending(false);
      setCurrentSendIndex(0);
      setSendingList([]);
      setCustomMessage('');
      alert("🎉 모든 메시지 발송이 완료되었습니다!");
    } else {
      setCurrentSendIndex(currentSendIndex + 1);
    }
  }

  function cancelSequentialSending() {
    setShowMessageInput(false);
    setSequentialSending(false);
    setCurrentSendIndex(0);
    setSendingList([]);
    setCustomMessage('');
  }

  function openEditModal(student: ActiveStudent) {
    setEditingStudent(student);
    setEditCategory(student.lesson_category ? student.lesson_category.split(", ").filter(c => c) : []);
    setEditTuition(student.lesson_tuition || 0);
    // Extract day from payment_date (e.g., "2026-03-15" → 15)
    const day = student.lesson_payment_date
      ? parseInt(student.lesson_payment_date.split("-")[2])
      : 1;
    setEditPaymentDay(day || 1);
    setShowEditModal(true);
  }

  function toggleEditCategory(cat: LessonCategory) {
    setEditCategory(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  }

  async function handleSaveStudentInfo() {
    if (!editingStudent?.lesson_id) {
      alert("수업 정보를 찾을 수 없습니다.");
      return;
    }
    if (editCategory.length === 0) {
      alert("최소 1개의 카테고리를 선택해주세요.");
      return;
    }
    if (editPaymentDay < 1 || editPaymentDay > 31) {
      alert("결제일은 1~31 사이의 숫자를 입력해주세요.");
      return;
    }

    try {
      // Build new payment_date: keep year-month from existing, change day only
      const existing = editingStudent.lesson_payment_date;
      let newPaymentDate: string;
      if (existing) {
        const [y, m] = existing.split("-");
        const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
        const clampedDay = Math.min(editPaymentDay, lastDay);
        newPaymentDate = `${y}-${m}-${String(clampedDay).padStart(2, "0")}`;
      } else {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, "0");
        const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
        const clampedDay = Math.min(editPaymentDay, lastDay);
        newPaymentDate = `${y}-${m}-${String(clampedDay).padStart(2, "0")}`;
      }

      const { error } = await supabase
        .from("lessons")
        .update({
          category: editCategory.join(", "),
          tuition_amount: editTuition,
          payment_date: newPaymentDate,
        })
        .eq("id", editingStudent.lesson_id);

      if (error) throw error;

      await fetchActiveStudents();
      setShowEditModal(false);
      setEditingStudent(null);
      alert("✅ 수강생 정보가 수정되었습니다.\n\n변경된 수강료는 앞으로 생성될 결제 내역부터 적용됩니다.");
    } catch (error: any) {
      console.error("Save student info error:", error);
      alert(`수정 중 오류가 발생했습니다.\n\n${error.message || "알 수 없는 오류"}`);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  const selectedCount = selectedIds.size;

  return (
    <div className="min-h-screen p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            수강생 관리
          </h1>
          <p className="text-gray-600 mb-4">
            현재 {students.length}명의 수강생이 등록되어 있습니다.
          </p>
          {/* 이름 검색 */}
          <div className="relative max-w-sm">
            <input
              type="text"
              value={nameSearch}
              onChange={(e) => setNameSearch(e.target.value)}
              placeholder="이름으로 찾기..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            {nameSearch && (
              <button
                onClick={() => setNameSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
              >
                ✕
              </button>
            )}
          </div>
          {nameSearch && (
            <p className="mt-1.5 text-xs text-gray-500">
              &quot;{nameSearch}&quot; 검색 결과: {sortedStudents.length}명
            </p>
          )}
        </div>

        {students.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">등록된 수강생이 없습니다.</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 md:px-6 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedIds.size === students.length && students.length > 0}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                      </th>
                      <th 
                        className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none"
                        onClick={() => handleSort('name')}
                      >
                        <div className="flex items-center gap-1">
                          <span>이름</span>
                          {sortField === 'name' && (
                            <span className="text-blue-600">
                              {sortOrder === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        연락처
                      </th>
                      <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        이메일
                      </th>
                      <th 
                        className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none"
                        onClick={() => handleSort('created_at')}
                      >
                        <div className="flex items-center gap-1">
                          <span>등록일</span>
                          {sortField === 'created_at' && (
                            <span className="text-blue-600">
                              {sortOrder === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th className="px-3 md:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        수업 상태
                      </th>
                      <th className="px-3 md:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        작업
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedStudents.map((student) => (
                      <tr key={student.id} className="hover:bg-gray-50">
                        <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(student.id)}
                            onChange={() => toggleSelect(student.id)}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Link href={`/admin/students/${student.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                              {student.name || "이름 미입력"}
                            </Link>
                            {student.is_test && (
                              <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded leading-none">
                                테스트 계정
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {student.phone || "미입력"}
                          </div>
                        </td>
                        <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {student.email || "미입력"}
                          </div>
                        </td>
                        <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">
                            {new Date(student.created_at).toLocaleDateString(
                              "ko-KR"
                            )}
                          </div>
                        </td>
                        <td className="px-3 md:px-6 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => handleEndLesson(student.name || "회원", student.lesson_id)}
                            disabled={!student.lesson_id}
                            className="px-2 py-1 text-xs text-red-600 border border-red-500 rounded hover:bg-red-50 transition-colors font-medium whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                            title="수업 종료"
                          >
                            종료
                          </button>
                        </td>
                        <td className="px-3 md:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end gap-1 md:gap-2">
                            <button
                              onClick={() =>
                                sendKakao(student.phone, student.name)
                              }
                              disabled={!student.phone}
                              className="px-2 md:px-3 py-1.5 bg-yellow-400 text-gray-900 rounded hover:bg-yellow-500 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-xs font-bold whitespace-nowrap"
                              title="카톡 전송"
                            >
                              카톡
                            </button>
                            <button
                              onClick={() =>
                                sendTuitionSms(student.phone, student.name)
                              }
                              disabled={!student.phone}
                              className="px-2 md:px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-xs font-medium whitespace-nowrap"
                              title="수강료 문자 발송"
                            >
                              ✉️ 문자
                            </button>
                            {student.lesson_id && (
                              <button
                                onClick={() => openEditModal(student)}
                                className="px-2 md:px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-xs font-medium whitespace-nowrap"
                                title="수강료/과목 수정"
                              >
                                수정
                              </button>
                            )}
                            <button
                              onClick={() =>
                                handlePermanentDelete(student.id, student.name || "이름 미입력")
                              }
                              className="px-2 md:px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-xs font-medium whitespace-nowrap"
                              title="수강생 영구 삭제"
                            >
                              삭제
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sticky Group Actions Bar */}
            {selectedCount > 0 && (
              <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-20">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="text-sm font-medium text-gray-900">
                      {selectedCount}명 선택됨
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => startSequentialSMS('general')}
                        className="px-3 py-2 bg-yellow-400 text-gray-900 rounded-lg hover:bg-yellow-500 transition-colors text-xs sm:text-sm font-bold whitespace-nowrap shadow-sm"
                      >
                        💬 개별 연속 카톡
                      </button>
                      <button
                        onClick={() => startSequentialSMS('tuition')}
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium whitespace-nowrap"
                      >
                        ✉️ 개별 수강료 문자 발송
                      </button>
                      <button
                        onClick={() => setSelectedIds(new Set())}
                        className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-xs sm:text-sm font-medium whitespace-nowrap"
                      >
                        선택 해제
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Message Input Modal */}
            {showMessageInput && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
                  {/* Header */}
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                      📝 메시지 작성
                    </h2>
                    <p className="text-sm text-gray-600">
                      선택한 수강생들에게 보낼 메시지를 작성하세요
                    </p>
                  </div>

                  {/* Selected Students Summary */}
                  <div className="bg-blue-50 rounded-lg p-4 mb-6 border border-blue-100">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-blue-900">발송 대상:</span>
                      <span className="text-sm font-bold text-blue-700">
                        {sendingList.length}명
                      </span>
                    </div>
                    <div className="text-sm text-blue-800">
                      {sendingList.slice(0, 3).map((s, i) => (
                        <span key={s.id}>
                          {s.name || "이름 미입력"}
                          {i < Math.min(sendingList.length, 3) - 1 && ", "}
                        </span>
                      ))}
                      {sendingList.length > 3 && ` 외 ${sendingList.length - 3}명`}
                    </div>
                  </div>

                  {/* Message Input */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      메시지 내용
                    </label>
                    <textarea
                      value={customMessage}
                      onChange={(e) => setCustomMessage(e.target.value)}
                      rows={10}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      placeholder="보낼 메시지를 입력하세요.&#10;&#10;예시:&#10;안녕하세요 [이름]님, 김포국악원입니다.&#10;&#10;이번 주 수업 안내드립니다.&#10;...&#10;&#10;[이름] 부분은 각 수강생의 이름으로 자동 변환됩니다."
                    />
                    <p className="mt-2 text-xs text-gray-500">
                      💡 <strong>[이름]</strong>을 입력하면 각 수강생의 이름으로 자동 변환됩니다.
                    </p>
                  </div>

                  {/* Instructions */}
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                    <p className="text-sm text-yellow-800">
                      <strong>💡 사용 방법:</strong><br />
                      1. 메시지 작성 후 "발송 시작" 클릭<br />
                      2. 각 수강생마다 메시지가 클립보드에 복사됨<br />
                      3. {messageType === "tuition" ? "문자 앱" : "카카오톡"}에서 붙여넣기 하여 전송<br />
                      4. "다음" 버튼으로 다음 사람에게 진행
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={startSending}
                      disabled={!customMessage.trim()}
                      className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      🚀 발송 시작
                    </button>
                    <button
                      onClick={cancelSequentialSending}
                      className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                    >
                      취소
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Edit Student Info Modal */}
            {showEditModal && editingStudent && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-2">
                    수강 정보 수정
                  </h2>
                  <p className="text-sm text-gray-600 mb-6">
                    {editingStudent.name || "이름 미입력"}님의 수강 과목과 수강료를 수정합니다.
                  </p>

                  {/* Category Selection */}
                  <div className="mb-5">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      수강 과목 (복수 선택 가능)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {CATEGORIES.map((cat) => (
                        <label
                          key={cat}
                          className={`flex items-center justify-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                            editCategory.includes(cat)
                              ? "border-blue-500 bg-blue-50 text-blue-700"
                              : "border-gray-300 hover:border-blue-300"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={editCategory.includes(cat)}
                            onChange={() => toggleEditCategory(cat)}
                            className="sr-only"
                          />
                          <span className="text-sm font-medium">{cat}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Tuition Amount */}
                  <div className="mb-5">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      수강료
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={editTuition || ""}
                        onChange={(e) => setEditTuition(parseInt(e.target.value) || 0)}
                        placeholder="예: 200000"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                      />
                      <span className="absolute right-3 top-2.5 text-sm text-gray-500">원</span>
                    </div>
                    <p className="mt-1.5 text-xs text-gray-500">
                      변경된 수강료는 앞으로 생성될 결제 내역부터 적용됩니다.
                    </p>
                  </div>

                  {/* Payment Day */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      결제일 (매월)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={editPaymentDay}
                        onChange={(e) => setEditPaymentDay(parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                      />
                      <span className="absolute right-3 top-2.5 text-sm text-gray-500">일</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={handleSaveStudentInfo}
                      disabled={editCategory.length === 0}
                      className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      저장
                    </button>
                    <button
                      onClick={() => { setShowEditModal(false); setEditingStudent(null); }}
                      className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                    >
                      취소
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Sequential Sending Modal */}
            {sequentialSending && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6">
                  {/* Header */}
                  <div className="mb-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-2">
                      {messageType === "tuition" ? "✉️ 수강료 문자 발송 중" : "💬 카카오톡 발송 중"}
                    </h2>
                    <p className="text-sm text-gray-600">
                      메시지를 확인하고 {messageType === "tuition" ? "문자 앱" : "카카오톡"}으로 전송하세요
                    </p>
                  </div>

                  {/* Progress */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        진행 상황
                      </span>
                      <span className="text-sm font-bold text-blue-600">
                        {currentSendIndex + 1} / {sendingList.length}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                        style={{
                          width: `${((currentSendIndex + 1) / sendingList.length) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Current Student */}
                  {currentSendIndex < sendingList.length && (
                    <>
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-5 mb-4 border border-blue-100">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0">
                            {currentSendIndex + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-600 mb-1">현재 발송 대상</p>
                            <p className="text-xl font-bold text-gray-900 truncate">
                              {sendingList[currentSendIndex].name || "이름 미입력"}님
                            </p>
                            <p className="text-sm text-gray-600 mt-1">
                              {sendingList[currentSendIndex].phone}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Message Preview */}
                      <div className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-200">
                        <p className="text-xs font-medium text-gray-600 mb-2">전송할 메시지 미리보기:</p>
                        <div className="text-sm text-gray-800 whitespace-pre-wrap max-h-32 overflow-y-auto">
                          {customMessage.replace(/\[이름\]/g, sendingList[currentSendIndex].name || "회원")}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Instructions */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                    <p className="text-sm text-green-800">
                      <strong>✅ 단계:</strong><br />
                      1. "{messageType === "tuition" ? "문자 전송 및 다음" : "카톡 전송 및 다음"}" 클릭 → 메시지가 클립보드에 복사됨<br />
                      2. {messageType === "tuition" ? "문자 앱" : "카카오톡 앱"}으로 이동하여 대상자에게 붙여넣기<br />
                      3. 전송 후 다음 사람으로 자동 진행
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        sendCurrentMessage();
                        handleNextKakao();
                      }}
                      className={`flex-1 px-4 py-3 rounded-lg transition-all font-bold shadow-md ${
                        messageType === "tuition"
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900 hover:from-yellow-500 hover:to-yellow-600"
                      }`}
                    >
                      {messageType === "tuition" ? "✉️ 문자 전송 및 다음" : "💬 카톡 전송 및 다음"}
                    </button>
                    <button
                      onClick={cancelSequentialSending}
                      className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                    >
                      중단
                    </button>
                  </div>

                  {/* Character Count */}
                  <div className="mt-4 text-center text-xs text-gray-500">
                    메시지 길이: {customMessage.replace(/\[이름\]/g, sendingList[currentSendIndex]?.name || "회원").length}자
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <div className="mt-6 mb-20 bg-yellow-50 rounded-lg p-4 border border-yellow-200">
          <h3 className="text-sm font-semibold text-yellow-900 mb-2">
            💬 카카오톡 전송 안내
          </h3>
          <ul className="text-xs text-yellow-900 space-y-1.5">
            <li>
              • <strong>개별 카톡:</strong> 각 수강생의 "💬 카톡" 또는 "💰 수강료" 버튼을 클릭하면 메시지가 클립보드에 복사되고 카카오톡 1:1 채팅창이 열립니다.
            </li>
            <li>
              • <strong>개별 연속 발송:</strong> 여러 수강생을 체크박스로 선택한 후, 하단의 "💬 개별 연속 카톡" 또는 "💰 개별 수강료 안내" 버튼을 클릭하세요. 각 수강생에게 이름이 포함된 개인화된 메시지를 순차적으로 보낼 수 있습니다.
            </li>
            <li>
              • <strong>전체 선택:</strong> 테이블 헤더의 체크박스를 클릭하면 모든 수강생을 선택/해제할 수 있습니다.
            </li>
            <li>
              • <strong>알림:</strong> 메시지는 클립보드에 자동 복사됩니다. 카카오톡 앱에서 붙여넣기(Ctrl+V 또는 길게 누르기)하여 전송하세요. (자동 전송은 지원되지 않습니다)
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
