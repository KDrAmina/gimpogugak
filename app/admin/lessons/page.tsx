"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { getTodayKST } from "@/lib/date-utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

type LessonCategory = "성인단체" | "성인개인" | "어린이개인" | "어린이단체";

type Lesson = {
  id: string;
  user_id: string;
  student_name: string;
  student_email: string;
  category: string; // Changed to string to support multiple categories (comma-separated)
  current_session: number;
  tuition_amount: number;
  payment_date: string | null;
  is_active: boolean;
  created_at: string;
};

type UnassignedUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
};

type LessonHistoryItem = {
  id: string;
  lesson_id: string;
  session_number: number;
  completed_date: string;
  student_name: string;
  category: LessonCategory;
};

const CATEGORIES: LessonCategory[] = ["성인단체", "성인개인", "어린이개인", "어린이단체"];

export default function AdminLessonsPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [unassignedUsers, setUnassignedUsers] = useState<UnassignedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<LessonCategory | "전체">("전체");
  const [sortBy, setSortBy] = useState<"remaining" | "name" | "date">("remaining");
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"active" | "inactive">("active");
  const [lessonHistory, setLessonHistory] = useState<LessonHistoryItem[]>([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [viewDate, setViewDate] = useState(() => new Date());
  
  // Tuition editing
  const [editingTuition, setEditingTuition] = useState<string | null>(null);
  const [tuitionValue, setTuitionValue] = useState(0);
  
  // Category editing
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [categoryValue, setCategoryValue] = useState<string[]>([]);
  
  // Payment date editing
  const [editingPaymentDate, setEditingPaymentDate] = useState<string | null>(null);
  const [paymentDateValue, setPaymentDateValue] = useState("");
  
  // Date detail modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedDateLessons, setSelectedDateLessons] = useState<LessonHistoryItem[]>([]);
  
  // Add lesson by date modal (when clicking empty calendar cell)
  const [showAddLessonByDateModal, setShowAddLessonByDateModal] = useState(false);
  const [selectedDateForAdd, setSelectedDateForAdd] = useState<string>("");
  const [selectedLessonForAdd, setSelectedLessonForAdd] = useState<Lesson | null>(null);
  
  const router = useRouter();
  const supabase = createClient();

  // New lesson form - SIMPLIFIED STATE (categories: multi-select)
  const [newLesson, setNewLesson] = useState({
    user_id: "",
    categories: [] as LessonCategory[],
    tuition_amount: 0,
    payment_date: getTodayKST(),
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UnassignedUser | null>(null);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  useEffect(() => {
    if (showCalendar) loadLessonHistory();
  }, [viewDate, showCalendar]);

  // Sync Daily Schedule modal list when lessonHistory updates (e.g. after adding a lesson)
  useEffect(() => {
    if (showDetailModal && selectedDate) {
      setSelectedDateLessons(lessonHistory.filter((h) => h.completed_date === selectedDate));
    }
  }, [lessonHistory, showDetailModal, selectedDate]);

  async function checkAdminAccess() {
    try {
      const { data: { user } } = await supabase.auth.getUser();

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

      await Promise.all([loadLessons(), loadUnassignedUsers()]);
    } catch (error) {
      console.error("Access check error:", error);
      router.push("/");
    } finally {
      setLoading(false);
    }
  }

  async function loadLessons() {
    try {
      const { data: lessonsData, error } = await supabase
        .from("lessons")
        .select(`
          id,
          user_id,
          category,
          current_session,
          tuition_amount,
          payment_date,
          is_active,
          created_at,
          profiles!inner (
            name,
            email,
            role
          )
        `)
        .eq("profiles.role", "user")
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("Lessons load error:", error);
        setLessons([]);
        return;
      }

      const formattedLessons = (lessonsData || []).map((lesson: any) => ({
        id: lesson.id,
        user_id: lesson.user_id,
        student_name: lesson.profiles?.name || "Unknown",
        student_email: lesson.profiles?.email || "",
        category: lesson.category,
        current_session: lesson.current_session || 0,
        tuition_amount: lesson.tuition_amount || 0,
        payment_date: lesson.payment_date,
        is_active: lesson.is_active !== false,
        created_at: lesson.created_at,
      }));

      setLessons(formattedLessons);
    } catch (error) {
      console.error("Error loading lessons:", error);
      setLessons([]);
    }
  }

  async function loadUnassignedUsers() {
    try {
      const { data: allUsers, error: usersError } = await supabase
        .from("profiles")
        .select("id, name, email, phone")
        .eq("status", "active")
        .eq("role", "user");

      if (usersError) {
        console.warn("Users load error:", usersError);
        setUnassignedUsers([]);
        return;
      }

      // CRITICAL: Exclude ALL users in lessons table (active OR inactive)
      const { data: assignedLessons, error: lessonsError } = await supabase
        .from("lessons")
        .select("user_id");
        // NO .eq("is_active", true) filter - exclude all users in lessons table

      if (lessonsError) {
        console.warn("Assigned lessons check error:", lessonsError);
        setUnassignedUsers(allUsers || []);
        return;
      }

      const assignedUserIds = new Set(assignedLessons?.map(l => l.user_id) || []);
      const unassigned = (allUsers || []).filter(user => !assignedUserIds.has(user.id));

      setUnassignedUsers(unassigned);
    } catch (error) {
      console.error("Error loading unassigned users:", error);
      setUnassignedUsers([]);
    }
  }

  async function loadLessonHistory() {
    try {
      const year = viewDate.getFullYear();
      const month = viewDate.getMonth();
      const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      // First, check if table exists by trying a simple query
      const { error: testError } = await supabase
        .from("lesson_history")
        .select("id")
        .limit(1);

      if (testError) {
        console.error("❌ lesson_history table not found or not accessible:", testError.message);
        setLessonHistory([]);
        return;
      }

      // Fetch lesson history for the visible month (date range filter)
      const { data: historyData, error } = await supabase
        .from("lesson_history")
        .select(`
          id,
          lesson_id,
          session_number,
          completed_date,
          lessons (
            category,
            user_id,
            profiles (
              name,
              role
            )
          )
        `)
        .gte("completed_date", startDate)
        .lte("completed_date", endDate)
        .order("completed_date", { ascending: false });

      if (error) {
        console.error("❌ Lesson history query error:", error);
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);
        setLessonHistory([]);
        return;
      }

      if (!historyData || historyData.length === 0) {
        console.log("ℹ️ No lesson history records found (table is empty)");
        setLessonHistory([]);
        return;
      }

      const formatted = historyData
        .filter((item: any) => item.lessons?.profiles?.role === "user")
        .map((item: any) => {
          const studentName = item.lessons?.profiles?.name || "Unknown";
          const category = item.lessons?.category || "성인개인";
          return {
            id: item.id,
            lesson_id: item.lesson_id,
            session_number: item.session_number,
            completed_date: item.completed_date,
            student_name: studentName,
            category: category,
          };
        });

      setLessonHistory(formatted);
    } catch (error: any) {
      console.error("❌ Unexpected error loading lesson history:", error);
      console.error("Stack trace:", error.stack);
      setLessonHistory([]);
    }
  }

  async function handleCheckIn(lessonId: string) {
    try {
      const lesson = lessons.find(l => l.id === lessonId);
      if (!lesson || lesson.current_session >= 4) return;

      const newSession = lesson.current_session + 1;

      // Step 1: Update session count
      const { error } = await supabase
        .from("lessons")
        .update({ current_session: newSession })
        .eq("id", lessonId);

      if (error) throw error;

      // Step 2: Insert history record with KST date (avoid UTC timezone bug)
      const todayDate = getTodayKST();
      console.log("📝 Inserting history record:", { 
        lesson_id: lessonId, 
        session_number: newSession,
        completed_date: todayDate 
      });

      const { data: insertedData, error: historyError } = await supabase
        .from("lesson_history")
        .insert({
          lesson_id: lessonId,
          session_number: newSession,
          completed_date: todayDate,
        })
        .select();

      if (historyError) {
        console.error("❌ History insert error:", historyError);
        console.error("Error details:", JSON.stringify(historyError, null, 2));
      } else {
        console.log("✅ History inserted successfully:", insertedData);
      }

      // Step 3: Refresh data
      await Promise.all([loadLessons(), loadLessonHistory()]);

      if (newSession === 4) {
        alert(`🎉 ${lesson.student_name}님의 4회 수업이 모두 완료되었습니다!`);
      }
    } catch (error) {
      console.error("Check-in error:", error);
      alert("출석 체크 중 오류가 발생했습니다.");
    }
  }

  async function handleUndoSession(lessonId: string) {
    try {
      const lesson = lessons.find(l => l.id === lessonId);
      if (!lesson || lesson.current_session <= 0) return;

      if (!confirm(`${lesson.student_name}님의 마지막 수업을 취소하시겠습니까?`)) {
        return;
      }

      const sessionToRemove = lesson.current_session;

      // Step 1: Delete the most recent attendance record from lesson_history FIRST
      const { error: deleteError } = await supabase
        .from("lesson_history")
        .delete()
        .eq("lesson_id", lessonId)
        .eq("session_number", sessionToRemove);

      if (deleteError) {
        console.error("Lesson history delete error:", deleteError);
        throw deleteError;
      }

      // Step 2: Decrement session count in lessons
      const newSession = sessionToRemove - 1;
      const { error } = await supabase
        .from("lessons")
        .update({ current_session: newSession })
        .eq("id", lessonId);

      if (error) throw error;

      await Promise.all([loadLessons(), loadLessonHistory()]);
      alert("✅ 마지막 수업이 취소되었습니다.");
    } catch (error) {
      console.error("Undo error:", error);
      alert("취소 중 오류가 발생했습니다.");
    }
  }

  async function handleResetCalendar() {
    if (!confirm("⚠️ 모든 출석 기록과 진도를 초기화합니다. 수강생 정보는 유지됩니다. 계속하시겠습니까?")) {
      return;
    }
    try {
      const { error: deleteError } = await supabase
        .from("lesson_history")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
      if (deleteError) throw deleteError;

      await supabase
        .from("lessons")
        .update({ current_session: 0 })
        .neq("id", "00000000-0000-0000-0000-000000000000");

      await Promise.all([loadLessons(), loadLessonHistory()]);
      alert("✅ 캘린더가 리셋되었습니다.");
    } catch (error) {
      console.error("Reset calendar error:", error);
      alert("캘린더 리셋 중 오류가 발생했습니다.");
    }
  }

  async function handleRequestPayment(lesson: Lesson) {
    const message = `안녕하세요 ${lesson.student_name}님, 김포국악원입니다.\n\n${lesson.category} 수업 4회차가 모두 완료되었습니다.\n\n다음 기수 수강을 원하시면 수강료 입금 후 연락 주세요.\n\n감사합니다.`;
    
    try {
      await navigator.clipboard.writeText(message);
      alert(`✅ 메시지가 클립보드에 복사되었습니다.\n\n카카오톡으로 전송하세요.`);
    } catch (error) {
      alert(message);
    }
  }

  async function handleSaveTuition(lessonId: string) {
    try {
      const { error } = await supabase
        .from("lessons")
        .update({ tuition_amount: tuitionValue })
        .eq("id", lessonId);

      if (error) throw error;

      await loadLessons();
      setEditingTuition(null);
      alert("✅ 수강료가 수정되었습니다.");
    } catch (error) {
      console.error("Save tuition error:", error);
      alert("수강료 수정 중 오류가 발생했습니다.");
    }
  }

  async function handleSaveCategory(lessonId: string) {
    if (categoryValue.length === 0) {
      alert("최소 1개의 카테고리를 선택해주세요.");
      return;
    }

    try {
      const categoryString = categoryValue.join(", ");
      
      const { error } = await supabase
        .from("lessons")
        .update({ category: categoryString })
        .eq("id", lessonId);

      if (error) throw error;

      await loadLessons();
      setEditingCategory(null);
      alert("✅ 카테고리가 수정되었습니다.");
    } catch (error) {
      console.error("Save category error:", error);
      alert("카테고리 수정 중 오류가 발생했습니다.");
    }
  }

  async function handleSavePaymentDate(lessonId: string) {
    if (!paymentDateValue) {
      alert("결제일을 입력해주세요.");
      return;
    }

    try {
      const { error } = await supabase
        .from("lessons")
        .update({ payment_date: paymentDateValue })
        .eq("id", lessonId);

      if (error) throw error;

      await loadLessons();
      setEditingPaymentDate(null);
      alert("✅ 결제일이 수정되었습니다.");
    } catch (error) {
      console.error("Save payment date error:", error);
      alert("결제일 수정 중 오류가 발생했습니다.");
    }
  }

  function toggleCategorySelection(category: LessonCategory) {
    setCategoryValue(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  }

  async function handleRestoreLesson(lessonId: string) {
    const lesson = lessons.find(l => l.id === lessonId);
    if (!lesson) return;

    if (!confirm(`${lesson.student_name}님의 수업을 재개하시겠습니까?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("lessons")
        .update({ is_active: true })
        .eq("id", lessonId);

      if (error) throw error;

      await Promise.all([loadLessons(), loadUnassignedUsers()]);
      alert("✅ 수업이 재개되었습니다.");
    } catch (error) {
      console.error("Restore lesson error:", error);
      alert("수업 재개 중 오류가 발생했습니다.");
    }
  }

  async function handleDeleteLesson(lessonId: string) {
    const lesson = lessons.find(l => l.id === lessonId);
    if (!lesson) return;

    const confirmMsg = `정말 삭제하시겠습니까?\n\n수강생: ${lesson.student_name}\n\n⚠️ 데이터가 완전히 사라집니다.\n기록을 남기려면 [회원관리]에서 '수업 종료'를 이용해 주세요.`;
    
    if (!confirm(confirmMsg)) {
      return;
    }

    try {
      await supabase.from("lesson_history").delete().eq("lesson_id", lessonId);
      const { error } = await supabase.from("lessons").delete().eq("id", lessonId);

      if (error) throw error;

      await Promise.all([loadLessons(), loadUnassignedUsers(), loadLessonHistory()]);
      alert("✅ 수업이 삭제되었습니다.");
    } catch (error) {
      console.error("Delete lesson error:", error);
      alert("수업 삭제 중 오류가 발생했습니다.");
    }
  }

  async function handleAddLesson() {
    if (!newLesson.user_id) {
      alert("수강생을 선택해주세요.");
      return;
    }

    if (newLesson.categories.length === 0) {
      alert("최소 1개의 카테고리를 선택해주세요.");
      return;
    }

    if (!newLesson.payment_date) {
      alert("결제일을 입력해주세요.");
      return;
    }

    try {
      const categoryString = newLesson.categories.join(", ");
      const lessonData = {
        user_id: newLesson.user_id,
        category: categoryString,
        current_session: 0,
        tuition_amount: newLesson.tuition_amount || 0,
        payment_date: newLesson.payment_date,
        is_active: true,
      };

      console.log("Adding lesson:", lessonData);

      const { data, error } = await supabase
        .from("lessons")
        .insert(lessonData)
        .select();

      if (error) {
        console.error("Supabase insert error:", error);
        throw error;
      }

      console.log("Lesson added successfully:", data);

      await Promise.all([loadLessons(), loadUnassignedUsers()]);
      
      // Reset modal
      setShowAddModal(false);
      setNewLesson({
        user_id: "",
        categories: [],
        tuition_amount: 0,
        payment_date: getTodayKST(),
      });
      setSearchQuery("");
      setSelectedUser(null);
      setIsDropdownOpen(false);

      alert("✅ 수강생이 추가되었습니다.");
    } catch (error: any) {
      console.error("Add lesson error:", error);
      alert(`수강생 추가 중 오류가 발생했습니다.\n\n${error.message || "알 수 없는 오류"}`);
    }
  }

  function handleSelectUser(user: UnassignedUser) {
    setSelectedUser(user);
    setNewLesson({ ...newLesson, user_id: user.id });
    setSearchQuery(user.name);
    setIsDropdownOpen(false);
  }

  function handleClearSelection() {
    setSelectedUser(null);
    setNewLesson({ ...newLesson, user_id: "" });
    setSearchQuery("");
  }

  // Filter users - show all by default, filter when typing
  const filteredUsers = searchQuery.trim()
    ? unassignedUsers.filter(user =>
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : unassignedUsers;

  async function handleRenewLesson(lessonId: string) {
    if (!confirm("수업을 갱신하시겠습니까? (진도가 0으로 초기화됩니다)")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("lessons")
        .update({
          current_session: 0,
          payment_date: getTodayKST(),
        })
        .eq("id", lessonId);

      if (error) throw error;
      await loadLessons();
      alert("✅ 수업이 갱신되었습니다.");
    } catch (error) {
      console.error("Renew error:", error);
      alert("수업 갱신 중 오류가 발생했습니다.");
    }
  }

  // Handle date click: detail modal (has lessons) or add lesson modal (empty)
  function handleDateClick(dateStr: string, sessions: LessonHistoryItem[]) {
    if (sessions.length > 0) {
      setSelectedDate(dateStr);
      setSelectedDateLessons(sessions);
      setShowDetailModal(true);
    } else {
      setSelectedDateForAdd(dateStr);
      setSelectedLessonForAdd(null);
      setShowAddLessonByDateModal(true);
    }
  }

  function closeDetailModal() {
    setShowDetailModal(false);
    setSelectedDate("");
    setSelectedDateLessons([]);
  }

  function closeAddLessonByDateModal() {
    setShowAddLessonByDateModal(false);
    setSelectedDateForAdd("");
    setSelectedLessonForAdd(null);
  }

  function openAddLessonFromDailySchedule() {
    setSelectedDateForAdd(selectedDate);
    setSelectedLessonForAdd(null);
    setShowAddLessonByDateModal(true);
  }

  async function handleConfirmLessonByDate() {
    if (!selectedLessonForAdd || !selectedDateForAdd) {
      alert("수강생을 선택해주세요.");
      return;
    }

    const lesson = selectedLessonForAdd;
    if (lesson.current_session >= 4) {
      alert("이미 4회차가 완료된 수강생입니다. 수강료 갱신 후 진행해주세요.");
      return;
    }

    try {
      const newSession = lesson.current_session + 1;

      const { error } = await supabase
        .from("lessons")
        .update({ current_session: newSession })
        .eq("id", lesson.id);

      if (error) throw error;

      const { error: historyError } = await supabase
        .from("lesson_history")
        .insert({
          lesson_id: lesson.id,
          session_number: newSession,
          completed_date: selectedDateForAdd,
        });

      if (historyError) throw historyError;

      await Promise.all([loadLessons(), loadLessonHistory()]);
      closeAddLessonByDateModal();
      alert(`✅ ${lesson.student_name}님의 수업이 ${selectedDateForAdd}로 기록되었습니다.`);
    } catch (error: any) {
      console.error("Add lesson by date error:", error);
      alert("수업 기록 중 오류가 발생했습니다.");
    }
  }

  // Filter by active/inactive
  const displayLessons = lessons.filter(lesson => 
    activeFilter === "active" ? lesson.is_active : !lesson.is_active
  );

  // Filter and sort
  const filteredLessons = displayLessons
    .filter(lesson => {
      if (selectedCategory === "전체") return true;
      // Split comma-separated categories and check if selected category is included
      const categories = lesson.category.split(", ").map(c => c.trim());
      return categories.includes(selectedCategory);
    })
    .sort((a, b) => {
      if (sortBy === "remaining") {
        return (4 - a.current_session) - (4 - b.current_session);
      } else if (sortBy === "name") {
        return a.student_name.localeCompare(b.student_name, "ko-KR");
      } else if (sortBy === "date") {
        const dateA = a.payment_date ? new Date(a.payment_date).getTime() : 0;
        const dateB = b.payment_date ? new Date(b.payment_date).getTime() : 0;
        return dateB - dateA;
      }
      return 0;
    });

  // Calendar helpers
  const getCalendarData = () => {
    const currentMonth = viewDate.getMonth();
    const currentYear = viewDate.getFullYear();
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);

    const days = [];
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const year = currentYear;
      const month = String(currentMonth + 1).padStart(2, "0");
      const day = String(i).padStart(2, "0");
      const dateStr = `${year}-${month}-${day}`;
      const sessionsOnThisDay = lessonHistory.filter((h) => h.completed_date === dateStr);
      days.push({ date: i, dateStr, sessions: sessionsOnThisDay });
    }

    return {
      days,
      month: currentMonth,
      year: currentYear,
      firstDay: firstDay.getDay(),
    };
  };

  const handlePrevMonth = () => {
    setViewDate((d) => {
      const next = new Date(d);
      next.setMonth(next.getMonth() - 1);
      return next;
    });
  };
  const handleNextMonth = () => {
    setViewDate((d) => {
      const next = new Date(d);
      next.setMonth(next.getMonth() + 1);
      return next;
    });
  };
  const handleToday = () => setViewDate(new Date());

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  const calendarData = showCalendar ? getCalendarData() : null;

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">수업 관리</h1>
              <p className="text-sm text-gray-600 mt-1">
                4회 단위 출석 체크 및 갱신 관리
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCalendar(!showCalendar)}
                className={`px-4 py-2 rounded-lg transition-colors font-medium text-sm whitespace-nowrap ${
                  showCalendar
                    ? "bg-indigo-600 text-white hover:bg-indigo-700"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                📅 {showCalendar ? "캘린더 닫기" : "캘린더 보기"}
              </button>
              <button
                onClick={handleResetCalendar}
                className="px-4 py-2 rounded-lg transition-colors font-medium text-sm whitespace-nowrap bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300"
              >
                🔄 캘린더 리셋
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm whitespace-nowrap shadow-md hover:shadow-lg"
              >
                + 수강생 추가
              </button>
            </div>
          </div>

          {/* Active/Inactive Tabs */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setActiveFilter("active")}
              className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                activeFilter === "active"
                  ? "bg-green-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              🟢 수업 중 ({lessons.filter(l => l.is_active).length})
            </button>
            <button
              onClick={() => setActiveFilter("inactive")}
              className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                activeFilter === "inactive"
                  ? "bg-gray-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              ⚫ 종료됨 ({lessons.filter(l => !l.is_active).length})
            </button>
          </div>

          {/* Filter & Sort */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                카테고리
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="전체">전체</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                정렬
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="remaining">남은 횟수순</option>
                <option value="name">이름순</option>
                <option value="date">결제일순</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats */}
        {activeFilter === "active" && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <p className="text-xs text-gray-600 mb-1">전체 수강생</p>
              <p className="text-2xl font-bold text-gray-900">{displayLessons.length}</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <p className="text-xs text-gray-600 mb-1">갱신 필요</p>
              <p className="text-2xl font-bold text-red-600">
                {displayLessons.filter(l => l.current_session === 4).length}
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <p className="text-xs text-gray-600 mb-1">진행 중</p>
              <p className="text-2xl font-bold text-blue-600">
                {displayLessons.filter(l => l.current_session > 0 && l.current_session < 4).length}
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <p className="text-xs text-gray-600 mb-1">미등록 회원</p>
              <p className="text-2xl font-bold text-purple-600">{unassignedUsers.length}</p>
            </div>
          </div>
        )}

        {/* Lessons Table/List */}
        {filteredLessons.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center border border-gray-200">
            <p className="text-gray-500">
              {activeFilter === "active" ? "등록된 수강생이 없습니다." : "종료된 수강생이 없습니다."}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
            {/* Desktop: Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">이름</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">카테고리</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">진도</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">수강료</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">결제일</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">관리</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredLessons.map((lesson) => {
                    const remaining = 4 - lesson.current_session;
                    const needsRenewal = lesson.current_session === 4;

                    return (
                      <tr key={lesson.id} className={`hover:bg-gray-50 ${needsRenewal ? "bg-red-50" : ""}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{lesson.student_name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {editingCategory === lesson.id ? (
                            <div className="flex flex-col gap-2">
                              {CATEGORIES.map(cat => (
                                <label key={cat} className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={categoryValue.includes(cat)}
                                    onChange={() => toggleCategorySelection(cat)}
                                    className="w-4 h-4 text-blue-600 rounded"
                                  />
                                  <span className="text-xs">{cat}</span>
                                </label>
                              ))}
                              <div className="flex gap-1 mt-1">
                                <button
                                  onClick={() => handleSaveCategory(lesson.id)}
                                  className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={() => setEditingCategory(null)}
                                  className="px-2 py-1 bg-gray-300 text-gray-700 rounded text-xs hover:bg-gray-400"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={() => {
                                setEditingCategory(lesson.id);
                                setCategoryValue(lesson.category.split(", ").filter(c => c));
                              }}
                              className="flex flex-wrap gap-1 cursor-pointer hover:opacity-70"
                              title="클릭하여 편집"
                            >
                              {lesson.category.split(", ").map((cat, idx) => (
                                <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                                  {cat}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${
                              needsRenewal ? "text-red-600" :
                              remaining <= 1 ? "text-orange-600" : "text-green-600"
                            }`}>
                              {lesson.current_session}/4
                            </span>
                            {!needsRenewal && (
                              <span className="text-xs text-gray-500">({remaining}회 남음)</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {editingTuition === lesson.id ? (
                            <div className="flex gap-1 items-center">
                              <input
                                type="number"
                                value={tuitionValue}
                                onChange={(e) => setTuitionValue(parseInt(e.target.value) || 0)}
                                className="w-24 px-2 py-1 border border-gray-300 rounded text-xs"
                              />
                              <button
                                onClick={() => handleSaveTuition(lesson.id)}
                                className="px-2 py-1 bg-blue-600 text-white rounded text-xs"
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => setEditingTuition(null)}
                                className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                if (activeFilter === "active") {
                                  setEditingTuition(lesson.id);
                                  setTuitionValue(lesson.tuition_amount);
                                }
                              }}
                              className={`text-sm font-medium ${
                                activeFilter === "active"
                                  ? "text-blue-600 hover:underline cursor-pointer"
                                  : "text-gray-900"
                              }`}
                            >
                              {lesson.tuition_amount > 0 
                                ? `${lesson.tuition_amount.toLocaleString()}원`
                                : "-"}
                            </button>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {editingPaymentDate === lesson.id ? (
                            <div className="flex gap-1 items-center">
                              <input
                                type="date"
                                value={paymentDateValue}
                                onChange={(e) => setPaymentDateValue(e.target.value)}
                                className="px-2 py-1 border border-gray-300 rounded text-xs"
                              />
                              <button
                                onClick={() => handleSavePaymentDate(lesson.id)}
                                className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => setEditingPaymentDate(null)}
                                className="px-2 py-1 bg-gray-300 text-gray-700 rounded text-xs hover:bg-gray-400"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div
                              onClick={() => {
                                setEditingPaymentDate(lesson.id);
                                setPaymentDateValue(lesson.payment_date || getTodayKST());
                              }}
                              className="cursor-pointer hover:text-blue-600 hover:underline"
                              title="클릭하여 편집"
                            >
                              {lesson.payment_date
                                ? new Date(lesson.payment_date).toLocaleDateString("ko-KR")
                                : "-"}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          {activeFilter === "inactive" ? (
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => handleRestoreLesson(lesson.id)}
                                className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-xs font-medium"
                              >
                                🔄 재개
                              </button>
                              <button
                                onClick={() => handleDeleteLesson(lesson.id)}
                                className="px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-xs font-medium"
                              >
                                🗑️ 삭제
                              </button>
                            </div>
                          ) : needsRenewal ? (
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => handleRequestPayment(lesson)}
                                className="px-3 py-1.5 bg-yellow-400 text-gray-900 rounded hover:bg-yellow-500 transition-colors text-xs font-bold"
                              >
                                💬
                              </button>
                              <button
                                onClick={() => handleRenewLesson(lesson.id)}
                                className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-xs font-medium"
                              >
                                🔄
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={() => handleCheckIn(lesson.id)}
                                className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-xs font-medium"
                              >
                                ✅
                              </button>
                              {lesson.current_session > 0 && (
                                <button
                                  onClick={() => handleUndoSession(lesson.id)}
                                  className="px-2 py-1.5 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors text-xs font-medium"
                                  title="직전 취소"
                                >
                                  ↩️
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile: Card View */}
            <div className="md:hidden divide-y divide-gray-200">
              {filteredLessons.map((lesson) => {
                const remaining = 4 - lesson.current_session;
                const needsRenewal = lesson.current_session === 4;

                return (
                  <div key={lesson.id} className={`p-4 ${needsRenewal ? "bg-red-50" : ""}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900">{lesson.student_name}</h3>
                        {editingCategory === lesson.id ? (
                          <div className="mt-2 space-y-1">
                            {CATEGORIES.map(cat => (
                              <label key={cat} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={categoryValue.includes(cat)}
                                  onChange={() => toggleCategorySelection(cat)}
                                  className="w-4 h-4 text-blue-600 rounded"
                                />
                                <span className="text-xs">{cat}</span>
                              </label>
                            ))}
                            <div className="flex gap-1 mt-2">
                              <button
                                onClick={() => handleSaveCategory(lesson.id)}
                                className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                              >
                                저장
                              </button>
                              <button
                                onClick={() => setEditingCategory(null)}
                                className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-xs hover:bg-gray-400"
                              >
                                취소
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => {
                              setEditingCategory(lesson.id);
                              setCategoryValue(lesson.category.split(", ").filter(c => c));
                            }}
                            className="mt-1 flex flex-wrap gap-1 cursor-pointer"
                          >
                            {lesson.category.split(", ").map((cat, idx) => (
                              <span key={idx} className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                                {cat}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className={`text-lg font-bold ${
                        needsRenewal ? "text-red-600" :
                        remaining <= 1 ? "text-orange-600" : "text-green-600"
                      }`}>
                        {lesson.current_session}/4
                      </span>
                    </div>

                    <div className="space-y-1 mb-3 text-xs text-gray-600">
                      {lesson.tuition_amount > 0 && (
                        <p>💰 수강료: {lesson.tuition_amount.toLocaleString()}원</p>
                      )}
                      {editingPaymentDate === lesson.id ? (
                        <div className="flex items-center gap-2">
                          <span>💳 결제:</span>
                          <input
                            type="date"
                            value={paymentDateValue}
                            onChange={(e) => setPaymentDateValue(e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded text-xs flex-1"
                          />
                          <button
                            onClick={() => handleSavePaymentDate(lesson.id)}
                            className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => setEditingPaymentDate(null)}
                            className="px-2 py-1 bg-gray-300 text-gray-700 rounded text-xs hover:bg-gray-400"
                          >
                            ✕
                          </button>
                        </div>
                      ) : lesson.payment_date ? (
                        <p
                          onClick={() => {
                            setEditingPaymentDate(lesson.id);
                            setPaymentDateValue(lesson.payment_date || getTodayKST());
                          }}
                          className="cursor-pointer hover:text-blue-600"
                        >
                          💳 결제: {new Date(lesson.payment_date).toLocaleDateString("ko-KR")}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      {activeFilter === "inactive" ? (
                        <>
                          <button
                            onClick={() => handleRestoreLesson(lesson.id)}
                            className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs font-medium"
                          >
                            🔄 재개
                          </button>
                          <button
                            onClick={() => handleDeleteLesson(lesson.id)}
                            className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-xs font-medium"
                          >
                            🗑️ 삭제
                          </button>
                        </>
                      ) : needsRenewal ? (
                        <>
                          <button
                            onClick={() => handleRequestPayment(lesson)}
                            className="flex-1 px-3 py-2 bg-yellow-400 text-gray-900 rounded-lg hover:bg-yellow-500 transition-colors text-xs font-bold"
                          >
                            💬 안내
                          </button>
                          <button
                            onClick={() => handleRenewLesson(lesson.id)}
                            className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs font-medium"
                          >
                            🔄 갱신
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleCheckIn(lesson.id)}
                            className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                          >
                            ✅ 수업 완료
                          </button>
                          {lesson.current_session > 0 && (
                            <button
                              onClick={() => handleUndoSession(lesson.id)}
                              className="px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-xs font-medium"
                            >
                              ↩️ 취소
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Calendar View */}
        {showCalendar && calendarData && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevMonth}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600 hover:text-gray-900"
                  aria-label="이전 달"
                >
                  <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
                </button>
                <h2 className="text-xl font-bold text-gray-900 min-w-[180px] text-center">
                  📅 {calendarData.year}년 {calendarData.month + 1}월
                </h2>
                <button
                  onClick={handleNextMonth}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600 hover:text-gray-900"
                  aria-label="다음 달"
                >
                  <ChevronRight className="w-5 h-5" strokeWidth={2.5} />
                </button>
              </div>
              <button
                onClick={handleToday}
                className="px-4 py-2 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors font-medium text-sm"
              >
                오늘
              </button>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
                <div key={day} className="text-center text-xs font-bold text-gray-500 py-2">{day}</div>
              ))}
              {Array(calendarData.firstDay).fill(null).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square"></div>
              ))}
              {calendarData.days.map((day) => {
                const hasFourthSession = day.sessions.some((s) => s.session_number % 4 === 0);
                const bgColor = hasFourthSession
                  ? "bg-orange-500 border-orange-600 hover:bg-orange-600"
                  : day.sessions.length > 0
                    ? "bg-blue-600 border-blue-700 hover:bg-blue-700"
                    : "border-gray-200 hover:bg-gray-100";
                return (
                  <button
                    key={day.date}
                    onClick={() => handleDateClick(day.dateStr, day.sessions)}
                    className={`aspect-square border rounded-lg p-1 transition-all cursor-pointer hover:shadow-lg ${bgColor}`}
                  >
                    <p className={`text-xs font-bold mb-1 ${
                      day.sessions.length > 0 ? "text-white" : "text-gray-700"
                    }`}>
                      {day.date}
                    </p>
                    <div className="space-y-0.5">
                      {day.sessions.length >= 3 && (
                        <span className="inline-block px-1.5 py-0.5 rounded bg-white/90 text-blue-800 text-[8px] font-bold">
                          {day.sessions.length}명
                        </span>
                      )}
                      {day.sessions.slice(0, day.sessions.length >= 3 ? 1 : 2).map((session) => (
                        <div
                          key={session.id}
                          className={`text-[9px] px-1 py-0.5 rounded truncate font-medium ${
                            session.session_number % 4 === 0
                              ? "bg-amber-200 text-amber-900"
                              : "bg-white text-blue-900"
                          }`}
                          title={day.sessions.map((s) => `${s.student_name} (${s.session_number}회차)`).join(", ")}
                        >
                          {session.student_name}
                        </div>
                      ))}
                      {day.sessions.length > 2 && (
                        <p className="text-[8px] text-white font-bold">+{day.sessions.length - (day.sessions.length >= 3 ? 1 : 2)}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mt-4">
              💡 날짜 클릭: 수업 있음 → 일정 보기(+ 추가 가능) / 수업 없음 → 수업 추가. 주황색 = 4회차 완료.
            </p>
          </div>
        )}

        {/* Daily Schedule Modal (date with lessons) */}
        {showDetailModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 flex flex-col max-h-[85vh]">
              {/* Header - Fixed */}
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <h2 className="text-xl font-bold text-gray-900">
                  📅 {selectedDate ? new Date(selectedDate).toLocaleDateString('ko-KR', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    weekday: 'short'
                  }) : ''} 일정
                </h2>
                <button
                  onClick={closeDetailModal}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                >
                  ✕
                </button>
              </div>

              {/* Scrollable Student List */}
              <div className="overflow-y-auto flex-1 mb-4 pr-2 modal-scroll" style={{ maxHeight: '400px' }}>
                <div className="space-y-3">
                  {selectedDateLessons.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">
                      이 날짜에 수업이 없습니다.
                    </p>
                  ) : (
                    selectedDateLessons.map((session) => (
                      <div
                        key={session.id}
                        className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-lg font-bold text-gray-900">
                            {session.student_name}
                          </h3>
                          <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded-full font-medium">
                            {session.session_number}회차
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <span className="px-2 py-0.5 bg-white rounded border border-blue-300 text-blue-700 font-medium">
                            {session.category}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Add Lesson Button */}
              <div className="flex-shrink-0 mb-4">
                <button
                  onClick={openAddLessonFromDailySchedule}
                  className="w-full py-3 border-2 border-dashed border-blue-300 rounded-lg text-blue-600 hover:bg-blue-50 hover:border-blue-400 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <span className="text-xl">+</span> 수업 추가
                </button>
              </div>

              {/* Footer - Fixed */}
              <div className="flex-shrink-0 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500 text-center mb-4">
                  총 {selectedDateLessons.length}건의 수업
                </p>

                <button
                  onClick={closeDetailModal}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold shadow-lg"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Lesson by Date Modal (empty cell or + from Daily Schedule) */}
        {showAddLessonByDateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                📅 {selectedDateForAdd ? new Date(selectedDateForAdd).toLocaleDateString("ko-KR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                }) : ""} 수업 추가
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                수강생을 선택하고 확인하면 해당 날짜로 수업이 기록됩니다.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">수강생 선택</label>
                <select
                  value={selectedLessonForAdd?.id ?? ""}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedLessonForAdd(id ? lessons.find((l) => l.id === id) ?? null : null);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">-- 수강생 선택 --</option>
                  {lessons
                    .filter((l) => l.is_active && l.current_session < 4)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.student_name} ({l.category}) - {l.current_session}/4회
                      </option>
                    ))}
                </select>
                {lessons.filter((l) => l.is_active && l.current_session < 4).length === 0 && (
                  <p className="text-xs text-amber-600 mt-2">
                    수업 추가 가능한 수강생이 없습니다. (4회차 완료 또는 수업 중인 회원만)
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={closeAddLessonByDateModal}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                >
                  취소
                </button>
                <button
                  onClick={handleConfirmLessonByDate}
                  disabled={!selectedLessonForAdd}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  수업 확인
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Lesson Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-gray-900 mb-4">수강생 추가</h2>
              
              {unassignedUsers.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">모든 회원이 이미 수업에 등록되어 있습니다.</p>
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    닫기
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Step 1: Member Selection Dropdown */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      수강생 선택 * ({unassignedUsers.length}명 가능)
                    </label>
                    
                    <div className="relative">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          if (!selectedUser) {
                            setIsDropdownOpen(true);
                          }
                        }}
                        onFocus={() => {
                          if (!selectedUser) {
                            setIsDropdownOpen(true);
                          }
                        }}
                        placeholder="클릭하면 전체 목록이 나타납니다..."
                        className="w-full px-3 py-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                      {selectedUser && (
                        <button
                          onClick={handleClearSelection}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    
                    {/* Dropdown List */}
                    {isDropdownOpen && !selectedUser && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredUsers.length === 0 ? (
                          <div className="p-3 text-center text-sm text-gray-500">
                            {searchQuery.trim() ? "검색 결과가 없습니다" : "등록 가능한 회원이 없습니다"}
                          </div>
                        ) : (
                          filteredUsers.map((user) => (
                            <button
                              key={user.id}
                              onClick={() => handleSelectUser(user)}
                              className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                            >
                              <p className="text-sm font-medium text-gray-900">{user.name}</p>
                              <p className="text-xs text-gray-500">{user.email} • {user.phone}</p>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                    
                    {/* Selected User Confirmation */}
                    {selectedUser && (
                      <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-blue-900">✅ {selectedUser.name}</p>
                            <p className="text-xs text-blue-600">{selectedUser.email}</p>
                          </div>
                          <button
                            onClick={handleClearSelection}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            변경
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Step 2: Category Selection (Multi-select) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      카테고리 선택 * (복수 선택 가능)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {CATEGORIES.map((cat) => (
                        <label
                          key={cat}
                          className={`flex items-center justify-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                            newLesson.categories.includes(cat)
                              ? "border-blue-500 bg-blue-50 text-blue-700"
                              : "border-gray-300 hover:border-blue-300"
                          }`}
                        >
                          <input
                            type="checkbox"
                            value={cat}
                            checked={newLesson.categories.includes(cat)}
                            onChange={() => {
                              setNewLesson(prev => ({
                                ...prev,
                                categories: prev.categories.includes(cat)
                                  ? prev.categories.filter(c => c !== cat)
                                  : [...prev.categories, cat],
                              }));
                            }}
                            className="sr-only"
                          />
                          <span className="text-sm font-medium">{cat}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Step 3: Tuition Amount */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      수강료 입력
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={newLesson.tuition_amount || ""}
                        onChange={(e) => setNewLesson({ ...newLesson, tuition_amount: parseInt(e.target.value) || 0 })}
                        placeholder="예: 200000"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                      />
                      <span className="absolute right-3 top-2.5 text-sm text-gray-500">원</span>
                    </div>
                  </div>

                  {/* Step 4: Payment Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      결제일 *
                    </label>
                    <input
                      type="date"
                      value={newLesson.payment_date}
                      onChange={(e) => setNewLesson({ ...newLesson, payment_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={handleAddLesson}
                      disabled={!newLesson.user_id || newLesson.categories.length === 0 || !newLesson.payment_date}
                      className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold disabled:bg-gray-300 disabled:cursor-not-allowed shadow-lg"
                    >
                      ✅ 등록하기
                    </button>
                    <button
                      onClick={() => {
                        setShowAddModal(false);
                        setNewLesson({
                          user_id: "",
                          categories: [],
                          tuition_amount: 0,
                          payment_date: getTodayKST(),
                        });
                        setSearchQuery("");
                        setSelectedUser(null);
                        setIsDropdownOpen(false);
                      }}
                      className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                    >
                      취소
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Info Section */}
        <div className="mt-8 p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg border border-yellow-200">
          <h3 className="text-sm font-bold text-yellow-900 mb-2">💬 카톡 전송 안내</h3>
          <ul className="text-xs text-yellow-800 space-y-1">
            <li>• 갱신 필요 시 "💬" 버튼으로 메시지를 클립보드에 복사할 수 있습니다</li>
            <li>• "🔄 갱신" 버튼으로 진도를 0/4로 초기화하고 새 결제일을 기록합니다</li>
            <li>• "↩️ 취소" 버튼으로 직전 수업을 취소할 수 있습니다</li>
            <li>• 수강료 금액을 클릭하면 바로 수정할 수 있습니다</li>
            <li>• 수업 종료는 [회원관리] 페이지에서 할 수 있습니다</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
