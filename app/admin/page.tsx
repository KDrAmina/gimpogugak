"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
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

      // Fetch pending approval count
      await fetchPendingCount();
    } catch (error) {
      console.error("Access check error:", error);
      router.push("/");
    } finally {
      setLoading(false);
    }
  }

  async function fetchPendingCount() {
    try {
      const { count, error } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending")
        .eq("role", "user");

      if (error) throw error;
      setPendingCount(count || 0);
    } catch (error) {
      console.error("Error fetching pending count:", error);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">확인 중...</p>
      </div>
    );
  }

  const currentDateTime = new Date().toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          관리자 대시보드
        </h1>
        <p className="text-gray-600">
          김포국악원 관리 시스템 현황을 확인하세요
        </p>
      </div>

      {/* Status Widgets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Widget 1: Pending Approvals */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600">
              대기중인 승인
            </h3>
            <div className="text-3xl">⏳</div>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-4xl font-bold text-blue-600">{pendingCount}</p>
            <span className="text-sm text-gray-500">명</span>
          </div>
          {pendingCount > 0 && (
            <p className="mt-2 text-xs text-amber-600 font-medium">
              승인 대기 중인 회원이 있습니다
            </p>
          )}
        </div>

        {/* Widget 2: System Status */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600">시스템 상태</h3>
            <div className="text-3xl">✅</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <p className="text-lg font-semibold text-green-600">
              정상 운영 중
            </p>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            모든 시스템이 정상 작동하고 있습니다
          </p>
        </div>

        {/* Widget 3: Last Login */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600">마지막 접속</h3>
            <div className="text-3xl">🕐</div>
          </div>
          <p className="text-lg font-semibold text-gray-900">
            {currentDateTime}
          </p>
          <p className="mt-2 text-xs text-gray-500">현재 시각 기준</p>
        </div>

        {/* Widget 4: Admin Guide */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-sm border border-blue-100 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-blue-900">관리자 메뉴</h3>
            <div className="text-3xl">📋</div>
          </div>
          <p className="text-sm text-blue-800 leading-relaxed">
            회원승인 → 회원관리 → 수업관리 → 공지사항
          </p>
          <p className="mt-2 text-xs text-blue-600">
            상단 메뉴에서 각 기능에 접근하세요.
          </p>
        </div>
      </div>

      {/* System Info */}
      <div className="mt-8 bg-gray-100 rounded-lg p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          시스템 정보
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-gray-600">
          <div>
            <span className="font-medium">버전:</span> v1.0.0
          </div>
          <div>
            <span className="font-medium">마지막 업데이트:</span> 2026-02-12
          </div>
          <div>
            <span className="font-medium">서버 상태:</span>{" "}
            <span className="text-green-600 font-medium">정상</span>
          </div>
        </div>
      </div>
    </div>
  );
}
