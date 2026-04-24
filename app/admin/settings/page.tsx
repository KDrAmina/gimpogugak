"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";

type SettingRow = { key: string; value: string; updated_at?: string };

export default function AdminSettingsPage() {
  const [bankAccount, setBankAccount] = useState("");
  const [saved, setSaved]             = useState("");
  const [updatedAt, setUpdatedAt]     = useState("");
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [toast, setToast]             = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/settings");
        const json = await res.json();
        if (!res.ok) { showToast(json.error ?? "조회 실패", false); return; }
        const ba = (json.settings as SettingRow[]).find(s => s.key === "bank_account");
        setBankAccount(ba?.value ?? "");
        setSaved(ba?.value ?? "");
        setUpdatedAt(ba?.updated_at ?? "");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "bank_account", value: bankAccount }),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error ?? "저장 실패", false); return; }
      setSaved(bankAccount);
      setUpdatedAt(new Date().toISOString());
      showToast("계좌번호가 저장되었습니다.", true);
    } catch (e) {
      showToast(String(e), false);
    } finally {
      setSaving(false);
    }
  };

  const isDirty = bankAccount !== saved;

  const fmtDate = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <div className="max-w-2xl mx-auto">
      {toast && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-lg shadow-lg text-white text-sm font-medium transition-all ${toast.ok ? "bg-green-600" : "bg-red-600"}`}>
          {toast.msg}
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">관리자 설정</h1>
        <p className="mt-1 text-sm text-gray-500">알림톡 발송 시 사용되는 학원 정보를 설정합니다.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        {/* 계좌번호 */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            학원 계좌번호
          </label>
          <p className="text-xs text-gray-400 mb-3">
            알림톡의 <code className="bg-gray-100 px-1 py-0.5 rounded">{"#{계좌번호}"}</code> 변수에 자동 매칭됩니다.
          </p>
          {loading ? (
            <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
          ) : (
            <input
              type="text"
              value={bankAccount}
              onChange={e => setBankAccount(e.target.value)}
              placeholder="예) 카카오뱅크 3333-01-1234567 (홍길동)"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          )}
          {updatedAt && (
            <p className="mt-1.5 text-xs text-gray-400">최종 수정: {fmtDate(updatedAt)}</p>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={saving || !isDirty || loading}
            className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>

      {/* 안내 */}
      <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100 text-sm text-blue-800 space-y-1">
        <p className="font-medium">💡 사용 방법</p>
        <ul className="list-disc list-inside space-y-1 text-blue-700 text-xs">
          <li>계좌번호를 입력하고 저장하면 이후 발송되는 모든 알림톡에 자동 반영됩니다.</li>
          <li>알림톡 템플릿에 <code className="bg-blue-100 px-1 py-0.5 rounded">{"#{계좌번호}"}</code> 변수가 포함되어야 합니다.</li>
          <li>미납자 독촉 알림톡 발송 시 이 계좌번호가 메시지에 포함됩니다.</li>
        </ul>
      </div>
    </div>
  );
}
