"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type LessonRow = {
  user_id: string;
  category: string;
  tuition_amount: number;
  payment_date: string | null;
  is_active: boolean;
  profiles: {
    name: string;
    phone: string | null;
    status: string;
  };
};

type GroupedStudent = {
  baseName: string;
  phone: string;
  totalTuition: number;
  paymentDate: string | null;
  categories: string[];
  selected: boolean;
};

export default function AlimtalkPage() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<GroupedStudent[]>([]);
  const [scheduledDate, setScheduledDate] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: number; fail: number } | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkAccessAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkAccessAndLoad() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) { router.push("/admin/login"); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, status")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "admin" || profile?.status !== "active") {
        router.push("/");
        return;
      }

      await loadStudents();
    } catch {
      router.push("/");
    } finally {
      setLoading(false);
    }
  }

  async function loadStudents() {
    const { data, error } = await supabase
      .from("lessons")
      .select(`
        user_id,
        category,
        tuition_amount,
        payment_date,
        is_active,
        profiles!inner(name, phone, status)
      `)
      .eq("is_active", true)
      .order("payment_date", { ascending: true, nullsFirst: false });

    if (error) {
      console.error("Error loading students:", error);
      return;
    }

    const rows = (data || []) as unknown as LessonRow[];

    // 발송 제외: is_active=false (이미 필터됨) 또는 profiles.status가 active가 아닌 경우
    const filtered = rows.filter(
      (r) => r.profiles?.status === "active" && r.profiles?.phone
    );

    // 동일인물 그룹화: 이름에서 숫자 제거 + 연락처 일치 시 동일인
    const groupMap = new Map<string, GroupedStudent>();

    for (const row of filtered) {
      const rawName = row.profiles.name || "";
      const baseName = rawName.replace(/[0-9]/g, "").trim();
      const phone = row.profiles.phone || "";
      const key = `${baseName}__${phone}`;

      if (groupMap.has(key)) {
        const existing = groupMap.get(key)!;
        existing.totalTuition += row.tuition_amount || 0;
        if (row.category && !existing.categories.includes(row.category)) {
          existing.categories.push(row.category);
        }
        // payment_date: 가장 임박한 날짜 유지
        if (row.payment_date) {
          if (!existing.paymentDate || row.payment_date < existing.paymentDate) {
            existing.paymentDate = row.payment_date;
          }
        }
      } else {
        groupMap.set(key, {
          baseName,
          phone,
          totalTuition: row.tuition_amount || 0,
          paymentDate: row.payment_date,
          categories: row.category ? [row.category] : [],
          selected: false,
        });
      }
    }

    // 결제일 임박 순 정렬 (null은 뒤로)
    const sorted = Array.from(groupMap.values()).sort((a, b) => {
      if (!a.paymentDate && !b.paymentDate) return 0;
      if (!a.paymentDate) return 1;
      if (!b.paymentDate) return -1;
      return a.paymentDate.localeCompare(b.paymentDate);
    });

    setStudents(sorted);
  }

  function toggleSelect(index: number) {
    setStudents((prev) =>
      prev.map((s, i) => (i === index ? { ...s, selected: !s.selected } : s))
    );
  }

  function toggleAll() {
    const allSelected = students.every((s) => s.selected);
    setStudents((prev) => prev.map((s) => ({ ...s, selected: !allSelected })));
  }

  async function handleSend() {
    const targets = students.filter((s) => s.selected);
    if (targets.length === 0) {
      alert("발송 대상을 선택해주세요.");
      return;
    }

    const confirmMsg = scheduledDate
      ? `${targets.length}명에게 ${new Date(scheduledDate).toLocaleString("ko-KR")}에 예약 발송합니다.`
      : `${targets.length}명에게 즉시 발송합니다.`;

    if (!confirm(confirmMsg)) return;

    setSending(true);
    setResult(null);

    try {
      const res = await fetch("/api/alimtalk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targets: targets.map((t) => ({
            name: t.baseName,
            phone: t.phone,
            tuition: t.totalTuition,
            paymentDate: t.paymentDate,
          })),
          scheduledDate: scheduledDate || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "발송 실패");

      setResult({ success: data.success, fail: data.fail });
      alert(`발송 완료: 성공 ${data.success}건, 실패 ${data.fail}건`);
    } catch (err: any) {
      alert(`발송 오류: ${err.message}`);
    } finally {
      setSending(false);
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "-";
    const d = new Date(dateStr + "T00:00:00");
    return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  const selectedCount = students.filter((s) => s.selected).length;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          💬 알림톡 발송 관리
        </h1>
        <p className="text-sm text-gray-600">
          수강생에게 카카오 알림톡을 발송합니다. 동일인물(이름+연락처)은 자동 그룹화되어 수강료가 합산됩니다.
        </p>
      </div>

      {/* 예약 발송 일시 */}
      <div className="mb-4 bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          발송 예정일시 (예약)
        </label>
        <input
          type="datetime-local"
          value={scheduledDate}
          onChange={(e) => setScheduledDate(e.target.value)}
          className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="mt-1 text-xs text-gray-500">
          {scheduledDate
            ? `${new Date(scheduledDate).toLocaleString("ko-KR")} 예약 발송`
            : "미선택 시 즉시 발송됩니다"}
        </p>
      </div>

      {/* 전체 선택 & 발송 버튼 */}
      <div className="mb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleAll}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {students.every((s) => s.selected) ? "전체 해제" : "전체 선택"}
          </button>
          <span className="text-sm text-gray-600">
            {selectedCount}명 선택 / 총 {students.length}명
          </span>
        </div>
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || selectedCount === 0}
          className="px-5 py-2.5 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow transition-colors text-sm"
        >
          {sending ? "발송 중..." : `알림톡 ${scheduledDate ? "예약" : "즉시"} 발송 (${selectedCount}명)`}
        </button>
      </div>

      {/* 결과 표시 */}
      {result && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
          발송 결과: 성공 <strong>{result.success}</strong>건, 실패 <strong>{result.fail}</strong>건
        </div>
      )}

      {/* 수강생 목록 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={students.length > 0 && students.every((s) => s.selected)}
                    onChange={toggleAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">이름</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">연락처</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">수강 과목</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">합산 수강료</th>
                <th className="px-4 py-3 text-center font-medium text-gray-700">결제일</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    발송 대상 수강생이 없습니다.
                  </td>
                </tr>
              ) : (
                students.map((s, i) => (
                  <tr
                    key={`${s.baseName}-${s.phone}`}
                    className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                      s.selected ? "bg-blue-50" : ""
                    }`}
                    onClick={() => toggleSelect(i)}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={s.selected}
                        onChange={() => toggleSelect(i)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{s.baseName}</td>
                    <td className="px-4 py-3 text-gray-600">{s.phone}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {s.categories.map((c) => (
                          <span
                            key={c}
                            className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      ₩{s.totalTuition.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">
                      {formatDate(s.paymentDate)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
