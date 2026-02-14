"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function WaitingPage() {
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkUserStatus();

    // Real-time subscription to status changes
    const channel = supabase
      .channel("profile-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
        },
        (payload) => {
          // If status changed to active, redirect
          if (payload.new.status === "active") {
            router.push("/");
            router.refresh();
          } else if (payload.new.status === "rejected") {
            alert(
              "신청이 거절되었습니다. 자세한 사항은 김포국악원으로 문의해 주세요."
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function checkUserStatus() {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push("/admin/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      if (!profile) {
        router.push("/admin/login");
        return;
      }

      // If user is active, redirect to home
      if (profile.status === "active") {
        router.push("/");
        return;
      }

      // If rejected, show message
      if (profile.status === "rejected") {
        alert(
          "신청이 거절되었습니다. 자세한 사항은 김포국악원으로 문의해 주세요."
        );
        await supabase.auth.signOut();
        router.push("/admin/login");
        return;
      }

      setUserName(profile.name);
    } catch (error) {
      console.error("Error checking user status:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/admin/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">확인 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="mb-6">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              승인 대기 중입니다
            </h1>
            {userName && (
              <p className="text-gray-600 mb-4">
                <span className="font-semibold">{userName}</span>님, 환영합니다!
              </p>
            )}
          </div>

          <div className="bg-blue-50 rounded-lg p-6 mb-6">
            <p className="text-gray-700 leading-relaxed">
              원장님께서 회원님의 수강 신청을 검토 중입니다.
              <br />
              승인이 완료되면 자동으로 대시보드로 이동됩니다.
            </p>
          </div>

          <div className="space-y-4">
            <div className="text-sm text-gray-500">
              <p className="mb-2">문의 사항이 있으신가요?</p>
              <p className="font-medium text-gray-700">
                📞 010-5948-1843
                <br />
                📧 gimpogugak@gmail.com
              </p>
            </div>

            <button
              onClick={handleSignOut}
              className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          김포국악원 | Gimpo Gugak Center
        </p>
      </div>
    </div>
  );
}
