"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function GalleryPage() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkAccess();
  }, []);

  async function checkAccess() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("status")
        .eq("id", user.id)
        .single();

      if (profile?.status !== "active") {
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
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">확인 중...</p>
      </div>
    );
  }

  return (
    <article className="max-w-6xl mx-auto px-6 py-12">
      <h1 className="font-serif text-3xl font-bold text-[#111] mb-6">
        활동 갤러리
      </h1>

      <div className="bg-blue-50 rounded-lg p-6 mb-8">
        <p className="text-sm text-blue-900">
          📸 수강생 전용 갤러리입니다. 공연 사진과 수업 활동 사진을 확인할 수
          있습니다.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-500">
          갤러리 준비 중입니다. 곧 사진과 영상을 업로드할 예정입니다.
        </p>
      </div>
    </article>
  );
}
