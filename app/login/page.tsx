"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  const supabase = createClient();

  // Auto-format phone number with hyphens
  function formatPhoneNumber(value: string): string {
    const numbers = value.replace(/[^\d]/g, "");
    
    if (numbers.length <= 3) {
      return numbers;
    } else if (numbers.length <= 7) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    } else if (numbers.length <= 10) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`;
    } else {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
    }
  }

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatPhoneNumber(e.target.value);
    setPhone(formatted);
  }

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      // Check user status and role
      const { data: profile } = await supabase
        .from("profiles")
        .select("status, role")
        .eq("id", user.id)
        .single();

      // Redirect based on role
      if (profile?.role === "admin") {
        router.push("/admin");
      } else if (profile?.status === "pending") {
        router.push("/waiting");
      } else if (profile?.status === "active") {
        router.push("/");
      }
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        // Check user status and role
        const { data: profile } = await supabase
          .from("profiles")
          .select("status, role")
          .eq("id", data.user.id)
          .single();

        // Redirect based on role
        if (profile?.role === "admin") {
          router.push("/admin");
        } else if (profile?.status === "pending") {
          router.push("/waiting");
        } else if (profile?.status === "active") {
          router.push("/");
        } else {
          router.push("/");
        }
      }
    } catch (error: any) {
      console.error("Login error:", error);
      setMessage(
        error.message === "Invalid login credentials"
          ? "이메일 또는 비밀번호가 올바르지 않습니다."
          : "로그인 중 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    if (!name || !phone) {
      setMessage("이름과 연락처를 입력해주세요.");
      setLoading(false);
      return;
    }

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName || !trimmedPhone) {
      setMessage("이름과 연락처를 정확히 입력해주세요.");
      setLoading(false);
      return;
    }

    try {
      console.log("🔄 Starting signup process:", {
        email: email,
        name: trimmedName,
        phone: trimmedPhone
      });

      // Step 1: Sign up user with Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        console.error("❌ Auth signup error:", authError);
        throw authError;
      }

      if (!authData.user) {
        console.error("❌ No user returned from signup");
        throw new Error("회원가입 중 오류가 발생했습니다.");
      }

      const userId = authData.user.id;
      console.log("✅ Auth user created:", userId);

      // Step 2: Wait a moment for the database trigger to create the profile
      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 3: FORCE UPDATE profile with phone and name
      console.log("🔄 Force updating profile with phone:", {
        userId: userId,
        name: trimmedName,
        phone: trimmedPhone
      });

      const { data: updateData, error: updateError } = await supabase
        .from("profiles")
        .update({
          name: trimmedName,
          phone: trimmedPhone,
          role: "user",
          status: "pending",
        })
        .eq("id", userId)
        .select();

      if (updateError) {
        console.error("❌ Profile update error:", updateError);
        
        // If update failed, try insert (profile might not exist yet)
        console.log("⚠️ Update failed, trying insert...");
        
        const { data: insertData, error: insertError } = await supabase
          .from("profiles")
          .insert({
            id: userId,
            email: authData.user.email || email,
            name: trimmedName,
            phone: trimmedPhone,
            role: "user",
            status: "pending",
          })
          .select();

        if (insertError) {
          console.error("❌ Profile insert error:", insertError);
          console.error("Error details:", {
            code: insertError.code,
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint
          });
          
          setMessage("회원 정보 저장 중 오류가 발생했습니다. 관리자에게 문의해주세요.");
          setLoading(false);
          return;
        }

        console.log("✅ Profile inserted:", insertData);
      } else {
        console.log("✅ Profile updated:", updateData);
      }

      // Step 4: Verify the phone number was saved
      const { data: verifyData } = await supabase
        .from("profiles")
        .select("id, email, name, phone, role, status")
        .eq("id", userId)
        .single();

      console.log("🔍 Verification - Profile data:", verifyData);

      if (verifyData && verifyData.phone === trimmedPhone) {
        console.log("✅ Phone number successfully saved!");
      } else {
        console.warn("⚠️ Phone number might not be saved correctly:", {
          expected: trimmedPhone,
          actual: verifyData?.phone
        });
      }

      setMessage(
        "회원가입이 완료되었습니다. 원장님의 승인을 기다려주세요."
      );

      // Redirect to waiting page after 2 seconds
      setTimeout(() => {
        router.push("/waiting");
      }, 2000);

    } catch (error: any) {
      console.error("❌ Signup error:", error);
      setMessage(
        error.message.includes("already registered") || error.message.includes("already been registered")
          ? "이미 등록된 이메일입니다."
          : "회원가입 중 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {isLogin ? "수강생 로그인" : "수강 신청"}
            </h1>
            <p className="text-gray-600">
              {isLogin
                ? "김포국악원 수강생 포털"
                : "김포국악원에 오신 것을 환영합니다"}
            </p>
          </div>

          {/* Toggle Buttons */}
          <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-lg">
            <button
              onClick={() => {
                setIsLogin(true);
                setMessage("");
              }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                isLogin
                  ? "bg-white text-gray-900 shadow"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              로그인
            </button>
            <button
              onClick={() => {
                setIsLogin(false);
                setMessage("");
              }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                !isLogin
                  ? "bg-white text-gray-900 shadow"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              수강 신청
            </button>
          </div>

          {/* Message Display */}
          {message && (
            <div
              className={`mb-4 p-3 rounded-lg text-sm ${
                message.includes("완료") || message.includes("성공")
                  ? "bg-green-50 text-green-800"
                  : "bg-red-50 text-red-800"
              }`}
            >
              {message}
            </div>
          )}

          {/* Login Form */}
          {isLogin ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이메일
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="example@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  비밀번호
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? "로그인 중..." : "로그인"}
              </button>
            </form>
          ) : (
            // Signup Form
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="홍길동"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  연락처 <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  required
                  maxLength={13}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="010-1234-5678"
                />
                <p className="text-xs text-gray-500 mt-1">
                  숫자만 입력하시면 자동으로 하이픈이 추가됩니다
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이메일 <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="example@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  비밀번호 <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="6자 이상"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? "처리 중..." : "수강 신청하기"}
              </button>

              <p className="text-xs text-gray-500 text-center">
                신청 후 원장님의 승인이 필요합니다.
              </p>
            </form>
          )}

          {/* Back to Home */}
          <div className="mt-6 text-center">
            <Link
              href="/"
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              ← 홈으로 돌아가기
            </Link>
          </div>
        </div>

        {/* Contact Info */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p className="mb-1">문의: 010-5948-1843</p>
          <p className="text-xs text-gray-500">김포국악원 | Gimpo Gugak Center</p>
        </div>
      </div>
    </div>
  );
}
