"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type PendingProfile = {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  created_at: string;
};

export default function ApprovalsPage() {
  const [profiles, setProfiles] = useState<PendingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchPendingProfiles();
  }, []);

  async function fetchPendingProfiles() {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error("Error fetching pending profiles:", error);
      alert("신청 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(userId: string) {
    if (!confirm("이 수강생을 승인하시겠습니까?")) return;

    setProcessing(userId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ status: "active" })
        .eq("id", userId);

      if (error) throw error;

      alert("승인이 완료되었습니다.");
      fetchPendingProfiles(); // Refresh list
    } catch (error) {
      console.error("Error approving profile:", error);
      alert("승인 처리 중 오류가 발생했습니다.");
    } finally {
      setProcessing(null);
    }
  }

  async function handleReject(userId: string) {
    if (!confirm("이 신청을 거절하시겠습니까?")) return;

    setProcessing(userId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ status: "rejected" })
        .eq("id", userId);

      if (error) throw error;

      alert("거절 처리가 완료되었습니다.");
      fetchPendingProfiles(); // Refresh list
    } catch (error) {
      console.error("Error rejecting profile:", error);
      alert("거절 처리 중 오류가 발생했습니다.");
    } finally {
      setProcessing(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          신규 수강생 신청
        </h1>

        {profiles.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">
              현재 승인 대기 중인 신청이 없습니다.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {profile.name || "이름 미입력"}
                    </h3>
                    <div className="space-y-1 text-sm text-gray-600">
                      <p>
                        <span className="font-medium">이메일:</span>{" "}
                        {profile.email || "미입력"}
                      </p>
                      <p>
                        <span className="font-medium">연락처:</span>{" "}
                        {profile.phone || "미입력"}
                      </p>
                      <p className="text-xs text-gray-400">
                        신청일시:{" "}
                        {new Date(profile.created_at).toLocaleDateString(
                          "ko-KR",
                          {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleApprove(profile.id)}
                      disabled={processing === profile.id}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      {processing === profile.id ? "처리 중..." : "승인"}
                    </button>
                    <button
                      onClick={() => handleReject(profile.id)}
                      disabled={processing === profile.id}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      거절
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
