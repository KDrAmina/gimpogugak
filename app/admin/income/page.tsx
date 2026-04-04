"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

type IncomeType = "체험비" | "외부강의" | "강사수수료" | "공연비" | "기타";

type ExternalIncome = {
  id: string;
  type: IncomeType;
  description: string;
  amount: number;
  income_date: string;
  notes: string | null;
  created_at: string;
};

type FormState = {
  type: IncomeType;
  description: string;
  amount: string;
  income_date: string;
  notes: string;
};

const MIGRATION_SQL = `-- Supabase SQL Editor에서 실행하세요
CREATE TABLE IF NOT EXISTS external_income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('체험비', '외부강의')),
  description TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  income_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE external_income ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage external_income" ON external_income
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
    )
  );`;

const EMPTY_FORM: FormState = {
  type: "체험비",
  description: "",
  amount: "",
  income_date: new Date().toISOString().split("T")[0],
  notes: "",
};

const TYPE_COLORS: Record<IncomeType, string> = {
  체험비: "bg-amber-100 text-amber-800",
  외부강의: "bg-blue-100 text-blue-800",
  강사수수료: "bg-purple-100 text-purple-800",
  공연비: "bg-emerald-100 text-emerald-800",
  기타: "bg-gray-100 text-gray-800",
};

const DOW_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatShort(dateStr: string) {
  return dateStr.replace(/-/g, ".").slice(2);
}

export default function AdminIncomePage() {
  const todayStr = new Date().toISOString().split("T")[0];
  const todayDate = new Date();
  const [year, setYear] = useState(todayDate.getFullYear());
  const [month, setMonth] = useState(todayDate.getMonth() + 1);
  const [records, setRecords] = useState<ExternalIncome[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbReady, setDbReady] = useState<boolean | null>(null);
  const [showMigration, setShowMigration] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("external_income")
        .select("*")
        .order("income_date", { ascending: true });

      if (error) {
        if (error.code === "42P01") {
          setDbReady(false);
        } else {
          console.error("외부수입 조회 오류:", error.message, error.code, error.details);
          alert(`데이터 조회 오류: ${error.message}`);
        }
        setRecords([]);
      } else {
        setDbReady(true);
        setRecords(data || []);
      }
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // 현재 월 레코드
  const monthStr = `${year}-${String(month).padStart(2, "0")}`;
  const monthRecords = useMemo(
    () => records.filter((r) => r.income_date.startsWith(monthStr)),
    [records, monthStr]
  );

  // 날짜별 인덱스
  const byDate = useMemo(() => {
    const map: Record<string, ExternalIncome[]> = {};
    for (const r of monthRecords) {
      if (!map[r.income_date]) map[r.income_date] = [];
      map[r.income_date].push(r);
    }
    return map;
  }, [monthRecords]);

  // 캘린더 그리드 (null = 빈 칸)
  const calendarDays = useMemo(() => {
    const firstDow = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDow; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [year, month]);

  // 월 합계
  const totalAmount = monthRecords.reduce((s, r) => s + r.amount, 0);
  const 체험비Total = monthRecords.filter((r) => r.type === "체험비").reduce((s, r) => s + r.amount, 0);
  const 외부강의Total = monthRecords.filter((r) => r.type === "외부강의").reduce((s, r) => s + r.amount, 0);
  const 강사수수료Total = monthRecords.filter((r) => r.type === "강사수수료").reduce((s, r) => s + r.amount, 0);
  const 공연비Total = monthRecords.filter((r) => r.type === "공연비").reduce((s, r) => s + r.amount, 0);
  const 기타Total = monthRecords.filter((r) => r.type === "기타").reduce((s, r) => s + r.amount, 0);

  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
    setSelectedDate(null);
  }

  function nextMonth() {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
    setSelectedDate(null);
  }

  function openAdd(date?: string) {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, income_date: date ?? todayStr });
    setModalOpen(true);
  }

  function openEdit(item: ExternalIncome) {
    setEditingId(item.id);
    setForm({
      type: item.type,
      description: item.description,
      amount: String(item.amount),
      income_date: item.income_date,
      notes: item.notes || "",
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.description.trim()) {
      alert("내용을 입력해주세요.");
      return;
    }
    const amount = parseInt(form.amount.replace(/[^0-9]/g, ""), 10);
    if (isNaN(amount) || amount < 0) {
      alert("금액을 올바르게 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        type: form.type,
        description: form.description.trim(),
        amount,
        income_date: form.income_date,
        notes: form.notes.trim() || null,
      };
      let saveError;
      if (editingId) {
        const { error } = await supabase
          .from("external_income")
          .update(payload)
          .eq("id", editingId);
        saveError = error;
      } else {
        const { error } = await supabase
          .from("external_income")
          .insert(payload);
        saveError = error;
      }
      if (saveError) {
        const msg = saveError.message ?? JSON.stringify(saveError);
        alert(`저장 오류: ${msg}`);
        return;
      }
      setModalOpen(false);
      await fetchRecords();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
          ? String((err as Record<string, unknown>).message)
          : String(err);
      alert(`저장 오류: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, description: string) {
    if (!confirm(`"${description}" 항목을 삭제하시겠습니까?`)) return;
    const { error } = await supabase.from("external_income").delete().eq("id", id);
    if (error) {
      alert(`삭제 오류: ${error.message}`);
    } else {
      if (selectedDate) {
        // 선택 날짜의 항목이 모두 삭제되면 선택 해제
        const remaining = (byDate[selectedDate] ?? []).filter((r) => r.id !== id);
        if (remaining.length === 0) setSelectedDate(null);
      }
      await fetchRecords();
    }
  }

  const selectedItems = selectedDate ? (byDate[selectedDate] ?? []) : [];

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">외부 수입 관리</h1>
          <p className="text-sm text-gray-500 mt-1">체험비 · 외부강의 · 강사수수료 · 공연비 · 기타 수입 기록</p>
        </div>
        <button
          onClick={() => openAdd(selectedDate ?? undefined)}
          disabled={dbReady === false}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors disabled:bg-gray-400"
        >
          + 추가
        </button>
      </div>

      {/* DB 미설정 안내 */}
      {dbReady === false && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-900 mb-1">DB 테이블이 없습니다</h3>
              <p className="text-sm text-amber-800 mb-3">
                Supabase SQL Editor에서 아래 SQL을 실행하면 이 기능을 사용할 수 있습니다.
              </p>
              <button
                onClick={() => setShowMigration(!showMigration)}
                className="text-sm font-medium text-amber-700 underline"
              >
                {showMigration ? "SQL 숨기기" : "마이그레이션 SQL 보기"}
              </button>
              {showMigration && (
                <div className="mt-3">
                  <pre className="bg-gray-900 text-green-300 text-xs rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">
                    {MIGRATION_SQL}
                  </pre>
                  <button
                    onClick={() =>
                      navigator.clipboard
                        .writeText(MIGRATION_SQL)
                        .then(() => alert("SQL이 복사되었습니다."))
                    }
                    className="mt-2 px-3 py-1.5 bg-gray-800 text-white text-xs rounded-lg hover:bg-gray-700"
                  >
                    SQL 복사
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="text-center py-12 text-gray-400">로딩 중...</div>
      )}

      {!loading && dbReady === true && (
        <>
          {/* 월 내비게이션 */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={prevMonth}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 font-bold text-lg leading-none"
            >
              ←
            </button>
            <h2 className="text-lg font-bold text-gray-800">
              {year}년 {month}월
            </h2>
            <button
              onClick={nextMonth}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 font-bold text-lg leading-none"
            >
              →
            </button>
          </div>

          {/* 월 요약 카드 */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
            <div className="col-span-2 md:col-span-3 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4">
              <p className="text-xs text-emerald-700 font-medium mb-1">
                {year}년 {month}월 합계
              </p>
              <p className="text-xl font-bold text-emerald-900">
                ₩{totalAmount.toLocaleString()}
              </p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-xs text-amber-700 font-medium mb-1">체험비</p>
              <p className="text-xl font-bold text-amber-900">
                ₩{체험비Total.toLocaleString()}
              </p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-xs text-blue-700 font-medium mb-1">외부강의</p>
              <p className="text-xl font-bold text-blue-900">
                ₩{외부강의Total.toLocaleString()}
              </p>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
              <p className="text-xs text-purple-700 font-medium mb-1">강사수수료</p>
              <p className="text-xl font-bold text-purple-900">
                ₩{강사수수료Total.toLocaleString()}
              </p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <p className="text-xs text-emerald-700 font-medium mb-1">공연비</p>
              <p className="text-xl font-bold text-emerald-900">
                ₩{공연비Total.toLocaleString()}
              </p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-600 font-medium mb-1">기타</p>
              <p className="text-xl font-bold text-gray-800">
                ₩{기타Total.toLocaleString()}
              </p>
            </div>
          </div>

          {/* 캘린더 */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-5">
            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-100">
              {DOW_LABELS.map((d, i) => (
                <div
                  key={d}
                  className={`py-2 text-center text-xs font-semibold ${
                    i === 0
                      ? "text-red-500"
                      : i === 6
                      ? "text-blue-500"
                      : "text-gray-500"
                  }`}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* 날짜 셀 */}
            <div className="grid grid-cols-7">
              {calendarDays.map((day, i) => {
                if (!day) {
                  return (
                    <div
                      key={`empty-${i}`}
                      className="min-h-[76px] border-b border-r border-gray-50 bg-gray-50/40"
                    />
                  );
                }
                const dateStr = toDateStr(year, month, day);
                const items = byDate[dateStr] ?? [];
                const dayTotal = items.reduce((s, r) => s + r.amount, 0);
                const isSelected = selectedDate === dateStr;
                const isToday = dateStr === todayStr;
                const dow = new Date(year, month - 1, day).getDay();

                return (
                  <div
                    key={dateStr}
                    onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                    className={`min-h-[76px] border-b border-r border-gray-100 p-1.5 cursor-pointer transition-colors select-none ${
                      isSelected
                        ? "bg-blue-50 ring-2 ring-inset ring-blue-400"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    {/* 날짜 숫자 */}
                    <div
                      className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday
                          ? "bg-blue-600 text-white"
                          : dow === 0
                          ? "text-red-500"
                          : dow === 6
                          ? "text-blue-500"
                          : "text-gray-700"
                      }`}
                    >
                      {day}
                    </div>

                    {/* 수입 항목 미리보기 */}
                    {items.length > 0 && (
                      <div className="space-y-0.5">
                        {items.slice(0, 2).map((it) => (
                          <div
                            key={it.id}
                            className={`text-[10px] px-1 py-0.5 rounded truncate font-medium ${TYPE_COLORS[it.type]}`}
                          >
                            {it.description}
                          </div>
                        ))}
                        {items.length > 2 && (
                          <div className="text-[10px] text-gray-400 pl-1">
                            +{items.length - 2}건 더
                          </div>
                        )}
                        <div className="text-[10px] text-emerald-700 font-bold pl-1">
                          ₩{dayTotal.toLocaleString()}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 선택 날짜 상세 패널 */}
          {selectedDate && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 text-base">
                  {formatShort(selectedDate)} 수입 내역
                  <span className="ml-2 text-sm font-normal text-gray-400">
                    ({selectedItems.length}건)
                  </span>
                </h3>
                <button
                  onClick={() => openAdd(selectedDate)}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
                >
                  이 날 추가
                </button>
              </div>

              {selectedItems.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">
                  이 날짜에 등록된 수입이 없습니다.
                </p>
              ) : (
                <>
                  <div className="space-y-3">
                    {selectedItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                      >
                        <span
                          className={`mt-0.5 px-2 py-0.5 rounded text-xs font-semibold shrink-0 ${TYPE_COLORS[item.type]}`}
                        >
                          {item.type}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {item.description}
                          </p>
                          {item.notes && (
                            <p className="text-xs text-gray-500 mt-0.5 truncate">
                              {item.notes}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-emerald-700">
                            ₩{item.amount.toLocaleString()}
                          </p>
                          <div className="flex gap-1 mt-1 justify-end">
                            <button
                              onClick={() => openEdit(item)}
                              className="px-2 py-0.5 text-xs text-blue-600 border border-blue-300 rounded hover:bg-blue-50"
                            >
                              수정
                            </button>
                            <button
                              onClick={() => handleDelete(item.id, item.description)}
                              className="px-2 py-0.5 text-xs text-red-600 border border-red-300 rounded hover:bg-red-50"
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-gray-200 pt-3 mt-3 flex justify-end">
                    <span className="text-sm font-bold text-emerald-700">
                      합계: ₩{selectedItems.reduce((s, r) => s + r.amount, 0).toLocaleString()}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* 추가/수정 모달 */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-gray-900 mb-5">
              {editingId ? "수입 수정" : "외부 수입 추가"}
            </h2>
            <div className="space-y-4">
              {/* 구분 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  구분 *
                </label>
                <div className="flex gap-3 flex-wrap">
                  {(["체험비", "외부강의", "강사수수료", "공연비", "기타"] as IncomeType[]).map((t) => (
                    <label key={t} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="incomeType"
                        value={t}
                        checked={form.type === t}
                        onChange={() => setForm((f) => ({ ...f, type: t }))}
                        className="text-blue-600"
                      />
                      <span
                        className={`text-sm font-medium px-2 py-0.5 rounded ${TYPE_COLORS[t]}`}
                      >
                        {t}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {form.type === "체험비"
                    ? "단발성 · 체험 행사 수익"
                    : form.type === "외부강의"
                    ? "정기성 · 월별 외부 강의 수입"
                    : form.type === "강사수수료"
                    ? "강사에게 지급하는 수수료"
                    : form.type === "공연비"
                    ? "공연·행사 출연 등 공연 관련 수입"
                    : "위 항목에 해당하지 않는 기타 수입"}
                </p>
              </div>

              {/* 내용 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  내용/대상 *{" "}
                  <span className="text-xs text-gray-400">
                    (예: OO초등학교 체험, 어린이집 강의)
                  </span>
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="내용을 입력하세요"
                />
              </div>

              {/* 금액 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  금액 (원) *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.amount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, amount: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                />
              </div>

              {/* 날짜 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  날짜 *
                </label>
                <input
                  type="date"
                  value={form.income_date}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, income_date: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* 메모 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  메모 (선택)
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="추가 메모"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm disabled:bg-gray-400"
              >
                {saving ? "저장 중..." : editingId ? "수정하기" : "등록하기"}
              </button>
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium text-sm"
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
