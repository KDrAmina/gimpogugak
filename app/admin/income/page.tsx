"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type IncomeType = "체험비" | "외부강의";

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

export default function AdminIncomePage() {
  const [records, setRecords] = useState<ExternalIncome[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbReady, setDbReady] = useState<boolean | null>(null);
  const [filterType, setFilterType] = useState<"전체" | IncomeType>("전체");
  const [filterMonth, setFilterMonth] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showMigration, setShowMigration] = useState(false);
  const [detailItem, setDetailItem] = useState<ExternalIncome | null>(null);
  const supabase = createClient();

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("external_income")
        .select("*")
        .order("income_date", { ascending: false });

      if (error) {
        if (error.code === "42P01") {
          setDbReady(false);
        } else {
          console.error("외부수입 조회 오류:", error);
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

  function openAdd() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, income_date: new Date().toISOString().split("T")[0] });
    setModalOpen(true);
  }

  function openEdit(item: ExternalIncome) {
    setDetailItem(null);
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
      if (editingId) {
        const { error } = await supabase
          .from("external_income")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
        alert("✅ 수정되었습니다.");
      } else {
        const { error } = await supabase
          .from("external_income")
          .insert(payload);
        if (error) throw error;
        alert("✅ 등록되었습니다.");
      }
      setModalOpen(false);
      await fetchRecords();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
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
      setDetailItem(null);
      await fetchRecords();
    }
  }

  const filtered = records.filter((r) => {
    if (filterType !== "전체" && r.type !== filterType) return false;
    if (filterMonth && !r.income_date.startsWith(filterMonth)) return false;
    return true;
  });

  const totalAmount = filtered.reduce((s, r) => s + r.amount, 0);
  const 체험비Total = filtered.filter((r) => r.type === "체험비").reduce((s, r) => s + r.amount, 0);
  const 외부강의Total = filtered.filter((r) => r.type === "외부강의").reduce((s, r) => s + r.amount, 0);

  const TYPE_COLORS: Record<IncomeType, string> = {
    체험비: "bg-amber-100 text-amber-800",
    외부강의: "bg-blue-100 text-blue-800",
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">외부 수입 관리</h1>
          <p className="text-sm text-gray-500 mt-1">체험비(단발성) · 외부강의(정기성) 수입 기록</p>
        </div>
        <button
          onClick={openAdd}
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
                    onClick={() => {
                      navigator.clipboard.writeText(MIGRATION_SQL).then(() => alert("SQL이 복사되었습니다."));
                    }}
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

      {/* 요약 카드 */}
      {dbReady === true && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4">
            <p className="text-xs text-emerald-700 font-medium mb-1">합계 ({filterType === "전체" ? "전체" : filterType})</p>
            <p className="text-2xl font-bold text-emerald-900">₩{totalAmount.toLocaleString()}</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs text-amber-700 font-medium mb-1">체험비</p>
            <p className="text-2xl font-bold text-amber-900">₩{체험비Total.toLocaleString()}</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-xs text-blue-700 font-medium mb-1">외부강의</p>
            <p className="text-2xl font-bold text-blue-900">₩{외부강의Total.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* 필터 */}
      {dbReady === true && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex gap-1.5">
            {(["전체", "체험비", "외부강의"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                  filterType === t
                    ? "bg-blue-600 text-white"
                    : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <input
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {filterMonth && (
            <button
              onClick={() => setFilterMonth("")}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              초기화
            </button>
          )}
        </div>
      )}

      {/* 목록 */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">로딩 중...</div>
      ) : dbReady === false ? null : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200">
          {records.length === 0 ? "+ 추가 버튼으로 첫 번째 수입을 기록하세요." : "조건에 맞는 항목이 없습니다."}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">날짜</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">구분</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">내용/대상</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">금액</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 hidden md:table-cell">메모</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setDetailItem(item)}
                >
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                    {item.income_date.replace(/-/g, ".").slice(2)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[item.type]}`}>
                      {item.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 font-medium max-w-[200px] truncate">
                    {item.description}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-emerald-700 text-right whitespace-nowrap">
                    ₩{item.amount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400 hidden md:table-cell max-w-[160px] truncate">
                    {item.notes || "—"}
                  </td>
                  <td
                    className="px-4 py-3 text-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex justify-center gap-1.5">
                      <button
                        onClick={() => openEdit(item)}
                        className="px-2 py-1 text-xs text-blue-600 border border-blue-300 rounded hover:bg-blue-50"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(item.id, item.description)}
                        className="px-2 py-1 text-xs text-red-600 border border-red-300 rounded hover:bg-red-50"
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
      )}

      {/* 상세 모달 */}
      {detailItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setDetailItem(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <span className={`px-2 py-0.5 rounded text-sm font-semibold ${TYPE_COLORS[detailItem.type]}`}>
                {detailItem.type}
              </span>
              <button onClick={() => setDetailItem(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">{detailItem.description}</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex gap-2">
                <dt className="w-20 text-gray-500 shrink-0">날짜</dt>
                <dd className="text-gray-900 font-medium">{detailItem.income_date}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-20 text-gray-500 shrink-0">금액</dt>
                <dd className="text-emerald-700 font-bold text-base">₩{detailItem.amount.toLocaleString()}</dd>
              </div>
              {detailItem.notes && (
                <div className="flex gap-2">
                  <dt className="w-20 text-gray-500 shrink-0">메모</dt>
                  <dd className="text-gray-700 whitespace-pre-wrap">{detailItem.notes}</dd>
                </div>
              )}
              <div className="flex gap-2">
                <dt className="w-20 text-gray-500 shrink-0">등록일</dt>
                <dd className="text-gray-400 text-xs">{new Date(detailItem.created_at).toLocaleString("ko-KR")}</dd>
              </div>
            </dl>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => openEdit(detailItem)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                수정
              </button>
              <button
                onClick={() => handleDelete(detailItem.id, detailItem.description)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">구분 *</label>
                <div className="flex gap-3">
                  {(["체험비", "외부강의"] as IncomeType[]).map((t) => (
                    <label key={t} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="incomeType"
                        value={t}
                        checked={form.type === t}
                        onChange={() => setForm((f) => ({ ...f, type: t }))}
                        className="text-blue-600"
                      />
                      <span className={`text-sm font-medium px-2 py-0.5 rounded ${TYPE_COLORS[t]}`}>{t}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {form.type === "체험비" ? "단발성 · 체험 행사 수익" : "정기성 · 월별 외부 강의 수입"}
                </p>
              </div>
              {/* 내용 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  내용/대상 * <span className="text-xs text-gray-400">(예: OO초등학교 체험, 어린이집 강의)</span>
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="내용을 입력하세요"
                />
              </div>
              {/* 금액 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">금액 (원) *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                />
              </div>
              {/* 날짜 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">날짜 *</label>
                <input
                  type="date"
                  value={form.income_date}
                  onChange={(e) => setForm((f) => ({ ...f, income_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              {/* 메모 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">메모 (선택)</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
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
