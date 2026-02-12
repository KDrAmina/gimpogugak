"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function AdminGalleryPage() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkAdminAccess();
  }, []);

  async function checkAdminAccess() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

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
    } catch (error) {
      console.error("Access check error:", error);
      router.push("/");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">확인 중...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">갤러리 관리</h1>
          <p className="text-gray-600 mt-2">
            공연 사진 및 활동 사진을 업로드하고 관리합니다.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">사진 목록</h2>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
              + 사진 업로드
            </button>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <div className="text-center py-12 text-gray-500">
              <p className="mb-2">📸 업로드된 사진이 없습니다.</p>
              <p className="text-sm">
                "사진 업로드" 버튼을 눌러 첫 사진을 추가해보세요.
              </p>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-blue-50 rounded-lg p-6">
            <h3 className="font-semibold text-blue-900 mb-2">💡 업로드 가능 형식</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• 이미지: JPG, PNG, WEBP</li>
              <li>• 동영상: MP4, MOV (최대 100MB)</li>
              <li>• 권장 해상도: 1920x1080 이상</li>
            </ul>
          </div>

          <div className="bg-green-50 rounded-lg p-6">
            <h3 className="font-semibold text-green-900 mb-2">📂 앨범 관리</h3>
            <ul className="text-sm text-green-800 space-y-1">
              <li>• 행사별 앨범 생성</li>
              <li>• 사진 설명 및 태그 추가</li>
              <li>• 공개/비공개 설정</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
