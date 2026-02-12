"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function MaterialsPage() {
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
    <article className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="font-serif text-3xl font-bold text-[#111] mb-6">
        수업 자료실
      </h1>

      <div className="bg-blue-50 rounded-lg p-6 mb-8">
        <p className="text-sm text-blue-900">
          📚 수강생 전용 자료실입니다. 악보, 음원 등의 학습 자료를 다운로드할 수
          있습니다.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-500">
          현재 준비 중입니다. 곧 자료를 업로드할 예정입니다.
        </p>
      </div>
    </article>
  );
}
