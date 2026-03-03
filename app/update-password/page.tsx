"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [hasUser, setHasUser] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Supabase가 URL hash(비밀번호 재설정 링크)에서 세션을 복원할 시간 확보
    const timer = setTimeout(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setHasUser(!!user);
      setSessionReady(true);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    if (!password || !confirmPassword) {
      setMessage("새 비밀번호와 비밀번호 확인을 모두 입력해주세요.");
      setLoading(false);
      return;
    }

    if (password.length < 4) {
      setMessage("비밀번호는 4자리 이상이어야 합니다.");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setMessage("비밀번호가 일치하지 않습니다.");
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;

      alert("비밀번호가 변경되었습니다.");
      router.push("/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "비밀번호 변경 중 오류가 발생했습니다.";
      setMessage(msg);
    } finally {
      setLoading(false);
    }
  }

  function handlePasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value.replace(/\s/g, "");
    if (value.length <= 15) setPassword(value);
  }

  function handleConfirmChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value.replace(/\s/g, "");
    if (value.length <= 15) setConfirmPassword(value);
  }

  if (!sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
        <div className="text-gray-600">로딩 중...</div>
      </div>
    );
  }

  if (!hasUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <h1 className="text-xl font-bold text-gray-900 mb-4">비밀번호 재설정</h1>
            <p className="text-gray-600 mb-6">
              비밀번호 재설정 링크가 만료되었거나 유효하지 않습니다.
              <br />
              로그인 페이지에서 비밀번호 찾기를 다시 요청해주세요.
            </p>
            <Link
              href="/login"
              className="inline-block w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-center"
            >
              로그인 페이지로 이동
            </Link>
            <Link href="/" className="block mt-4 text-sm text-gray-600 hover:text-gray-900">
              ← 홈으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">비밀번호 변경</h1>
            <p className="text-gray-600">새 비밀번호를 입력해주세요.</p>
          </div>

          {message && (
            <div className="mb-4 p-3 rounded-lg text-sm bg-red-50 text-red-800">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                새 비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={handlePasswordChange}
                required
                minLength={4}
                maxLength={15}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="4자리 이상"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                비밀번호 확인
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={handleConfirmChange}
                required
                minLength={4}
                maxLength={15}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="비밀번호를 다시 입력하세요"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? "변경 중..." : "비밀번호 변경"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/"
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              ← 홈으로 돌아가기
            </Link>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p className="text-xs text-gray-500">김포국악원 | Gimpo Gugak Center</p>
        </div>
      </div>
    </div>
  );
}
