"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";

type UnpaidMember = {
  userId: string;
  name: string;
  phone: string;
  isAlimtalkEnabled: boolean;
  totalTuition: number;
  paymentDate: string | null;
  lessonIds: string[];
  categories: string[];
};

export default function UnpaidMembersPage() {
  const [members, setMembers]       = useState<UnpaidMember[]>([]);
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [month, setMonth]           = useState("");
  const [loading, setLoading]       = useState(true);
  const [sending, setSending]       = useState(false);
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/unpaid-members");
      const json = await res.json();
      if (!res.ok) { showToast(json.error ?? "조회 실패", false); return; }
      setMembers(json.unpaidMembers ?? []);
      setMonth(json.month ?? "");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleAll = () => {
    if (selected.size === members.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(members.map(m => m.userId)));
    }
  };

  const toggleOne = (userId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  };

  const sendDunning = async () => {
    const targets = members
      .filter(m => selected.has(m.userId))
      .map(m => ({
        name: m.name.replace(/[0-9]/g, "").trim(),
        phone: m.phone,
        tuition: m.totalTuition,
        paymentDate: m.paymentDate,
        lessonIds: m.lessonIds,
      }));

    if (targets.length === 0) {
      showToast("발송할 인원을 선택하세요.", false);
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/alimtalk/dunning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targets }),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error ?? "발송 실패", false); return; }
      showToast(
        `독촉 알림톡 발송 완료 — 성공 ${json.success}건 / 실패 ${json.fail}건`,
        json.fail === 0,
      );
      setSelected(new Set());
      await load();
    } catch (e) {
      showToast(String(e), false);
    } finally {
      setSending(false);
    }
  };

  const [y, m2] = month.split("-");
  const monthLabel = month ? `${y}년 ${parseInt(m2)}월` : "";

  const allSelected = members.length > 0 && selected.size === members.length;
  const someSelected = selected.size > 0 && !allSelected;

  return (
    <div className="max-w-3xl mx-auto">
      {/* 토스트 */}
      {toast && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-lg shadow-lg text-white text-sm font-medium transition-all ${toast.ok ? "bg-green-600" : "bg-red-600"}`}>
          {toast.msg}
        </div>
      )}

      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">미납자 관리</h1>
        {monthLabel && (
          <p className="mt-1 text-sm text-gray-500">
            {monthLabel} 기준 — 결제 완료 기록이 없는 수강생 목록
          </p>
        )}
      </div>

      {/* 액션 바 */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleAll}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {allSelected ? "전체 해제" : "전체 선택"}
          </button>
          {selected.size > 0 && (
            <span className="text-sm text-gray-600">
              {selected.size}명 선택됨
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            새로고침
          </button>
          <button
            onClick={sendDunning}
            disabled={sending || selected.size === 0}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-40 font-medium"
          >
            {sending ? "발송 중..." : `독촉 알림톡 발송 (${selected.size}명)`}
          </button>
        </div>
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="py-16 text-center text-gray-400">조회 중...</div>
      ) : members.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-gray-500 text-base">이번 달 미납자가 없습니다.</p>
          <p className="text-gray-400 text-sm mt-1">모든 수강생이 납부 완료했습니다.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected; }}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-gray-300 accent-red-600"
                  />
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">이름</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 hidden sm:table-cell">연락처</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 hidden md:table-cell">수강 분류</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">수강료</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600 hidden sm:table-cell">알림톡</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {members.map(member => {
                const isChecked = selected.has(member.userId);
                const baseName  = member.name.replace(/[0-9]/g, "").trim();
                const phone     = member.phone.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
                return (
                  <tr
                    key={member.userId}
                    onClick={() => toggleOne(member.userId)}
                    className={`cursor-pointer transition-colors ${isChecked ? "bg-red-50" : "hover:bg-gray-50"}`}
                  >
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleOne(member.userId)}
                        className="w-4 h-4 rounded border-gray-300 accent-red-600"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{baseName}</td>
                    <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{phone}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {member.categories.map(c => (
                          <span key={c} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">{c}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-800">
                      {member.totalTuition.toLocaleString("ko-KR")}원
                    </td>
                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                      {member.isAlimtalkEnabled ? (
                        <span className="text-green-600 text-xs">ON</span>
                      ) : (
                        <span className="text-gray-400 text-xs">OFF</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-sm text-gray-500 font-medium">
                  총 {members.length}명 미납
                </td>
                <td className="px-4 py-3 text-right text-sm font-semibold text-red-600">
                  {members.reduce((s, m) => s + m.totalTuition, 0).toLocaleString("ko-KR")}원
                </td>
                <td className="hidden sm:table-cell" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
