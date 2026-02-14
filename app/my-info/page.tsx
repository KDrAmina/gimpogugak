"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type ProfileData = {
  id: string;
  name: string;
  phone: string;
  email: string;
  status: string;
  created_at: string;
};

type LessonData = {
  id: string;
  category: string;
  payment_date: string | null;
  created_at: string;
};

export default function MyInfoPage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Email update
  const [newEmail, setNewEmail] = useState("");
  const [updatingEmail, setUpdatingEmail] = useState(false);
  
  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkAccessAndLoadData();
  }, []);

  async function checkAccessAndLoadData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // Load profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      if (profileData.status !== "active") {
        router.push("/waiting");
        return;
      }

      setProfile(profileData);
      setNewEmail(profileData.email || "");

      // Load lesson info
      const { data: lessonData } = await supabase
        .from("lessons")
        .select("id, category, payment_date, created_at")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      setLesson(lessonData);

      console.log("✅ Profile loaded:", profileData);
      console.log("✅ Lesson loaded:", lessonData);
    } catch (error) {
      console.error("Load error:", error);
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateEmail() {
    if (!newEmail || !newEmail.includes("@")) {
      alert("올바른 이메일 주소를 입력해주세요.");
      return;
    }

    if (!confirm("이메일을 변경하시겠습니까?")) {
      return;
    }

    setUpdatingEmail(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("로그인 상태를 확인할 수 없습니다.");

      console.log("🔄 Updating email...");

      // Update in profiles table
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ email: newEmail.trim() })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Update in Supabase Auth
      const { error: authError } = await supabase.auth.updateUser({
        email: newEmail.trim(),
      });

      if (authError) {
        console.warn("Auth email update failed:", authError);
        alert("⚠️ 프로필 이메일은 변경되었지만, 인증 이메일 변경에 실패했습니다.\n\n다음 로그인 시 새 이메일로 로그인하세요.");
      } else {
        alert("✅ 이메일이 변경되었습니다.");
      }

      await checkAccessAndLoadData();
    } catch (error: any) {
      console.error("Email update error:", error);
      alert(`이메일 변경 중 오류가 발생했습니다.\n\n${error.message || "알 수 없는 오류"}`);
    } finally {
      setUpdatingEmail(false);
    }
  }

  async function handleChangePassword() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      alert("모든 필드를 입력해주세요.");
      return;
    }

    if (currentPassword.length < 4 || newPassword.length < 4 || confirmPassword.length < 4) {
      alert("비밀번호는 4자리 이상이어야 합니다.");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("새 비밀번호가 일치하지 않습니다.");
      return;
    }

    if (currentPassword === newPassword) {
      alert("현재 비밀번호와 새 비밀번호가 동일합니다.");
      return;
    }

    if (!confirm("비밀번호를 변경하시겠습니까?")) {
      return;
    }

    setChangingPassword(true);

    try {
      console.log("🔄 Changing password...");

      // Verify current password
      if (!profile?.email) {
        throw new Error("이메일 정보를 찾을 수 없습니다.");
      }

      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: currentPassword,
      });

      if (verifyError) {
        alert("현재 비밀번호가 올바르지 않습니다.");
        setChangingPassword(false);
        return;
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      console.log("✅ Password changed successfully");
      alert("✅ 비밀번호가 변경되었습니다.");
      
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error("Password change error:", error);
      alert(`비밀번호 변경 중 오류가 발생했습니다.\n\n${error.message || "알 수 없는 오류"}`);
    } finally {
      setChangingPassword(false);
    }
  }

  function handlePinInput(value: string, setter: (val: string) => void) {
    const cleaned = value.replace(/\s/g, "");
    if (cleaned.length <= 15) {
      setter(cleaned);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">프로필을 불러올 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">내 정보</h1>
          <p className="text-sm text-gray-600">
            프로필 정보를 확인하고 수정할 수 있습니다
          </p>
        </div>

        {/* Profile Info Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-4">
          <h2 className="text-lg font-bold text-gray-900 mb-4">📋 기본 정보</h2>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-600">이름</span>
              <span className="text-sm font-bold text-gray-900">{profile.name}</span>
            </div>
            
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-600">전화번호</span>
              <span className="text-sm font-bold text-gray-900">{profile.phone}</span>
            </div>
            
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-600">현재 이메일</span>
              <span className="text-sm text-gray-900">{profile.email || "미등록"}</span>
            </div>

            {lesson && (
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-600">수업 시작일</span>
                <span className="text-sm text-gray-900">
                  {new Date(lesson.created_at).toLocaleDateString("ko-KR")}
                </span>
              </div>
            )}
            
            {lesson && (
              <div className="flex justify-between items-center py-2">
                <span className="text-sm font-medium text-gray-600">수업 카테고리</span>
                <div className="flex gap-1 flex-wrap">
                  {lesson.category.split(", ").map((cat, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Update Email Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-4">
          <h2 className="text-lg font-bold text-gray-900 mb-4">📧 이메일 변경</h2>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                새 이메일 주소
              </label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="new@example.com"
              />
            </div>
            
            <button
              onClick={handleUpdateEmail}
              disabled={updatingEmail || newEmail === profile.email}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {updatingEmail ? "변경 중..." : "이메일 변경"}
            </button>

            <p className="text-xs text-gray-500">
              💡 이메일은 비밀번호 찾기 등에 사용됩니다
            </p>
          </div>
        </div>

        {/* Change Password Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">🔒 비밀번호 변경</h2>
          
          <div className="space-y-3">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                현재 비밀번호 (4자리 이상)
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => handlePinInput(e.target.value, setCurrentPassword)}
                minLength={4}
                maxLength={15}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-base tracking-wide"
                placeholder="••••"
              />
            </div>
            
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                새 비밀번호 (4자리 이상)
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => handlePinInput(e.target.value, setNewPassword)}
                minLength={4}
                maxLength={15}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-base tracking-wide"
                placeholder="••••"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                새 비밀번호 확인
              </label>
                <input
                type="password"
                value={confirmPassword}
                onChange={(e) => handlePinInput(e.target.value, setConfirmPassword)}
                minLength={4}
                maxLength={15}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-base tracking-wide"
                placeholder="••••"
              />
            </div>
            
            <button
              onClick={handleChangePassword}
              disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {changingPassword ? "변경 중..." : "비밀번호 변경"}
            </button>

            <p className="text-xs text-gray-500">
              💡 비밀번호는 4자리 이상입니다 (영문/숫자/특수문자 가능, 공백 제외)
            </p>
          </div>
        </div>

        {/* Info Notice */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-xs text-blue-800">
            💡 이름과 전화번호 변경이 필요하시면 원장님께 문의해 주세요.
          </p>
        </div>
      </div>
    </div>
  );
}
