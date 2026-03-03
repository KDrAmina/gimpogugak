"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
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

  function handlePinChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value.replace(/\s/g, "");
    if (value.length <= 15) {
      setPin(value);
    }
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

    if (!phone || !pin) {
      setMessage("전화번호와 비밀번호를 입력해주세요.");
      setLoading(false);
      return;
    }

    if (pin.length < 4) {
      setMessage("비밀번호는 4자리 이상이어야 합니다.");
      setLoading(false);
      return;
    }

    try {
      // Step 0: Format phone to 010-XXXX-XXXX before query
      const formattedPhone = formatPhoneNumber(phone.trim());
      console.log("🔄 Login attempt with phone:", formattedPhone);

      // Step 1: Get email by phone (RPC bypasses RLS for anonymous users)
      const { data: userEmail, error: emailError } = await supabase.rpc(
        "get_email_by_phone",
        { phone_input: formattedPhone }
      );

      const email =
        typeof userEmail === "string"
          ? userEmail
          : Array.isArray(userEmail) && userEmail[0]
            ? userEmail[0].email ?? userEmail[0]
            : userEmail?.email ?? null;

      if (emailError || !email) {
        console.error("Profile lookup error:", emailError);
        setMessage("등록되지 않은 전화번호입니다.");
        setLoading(false);
        return;
      }

      console.log("✅ Found email for phone");

      // Step 2: Login with email and password
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: pin,
      });

      if (error) {
        console.error("Auth error:", error);
        setMessage("비밀번호가 올바르지 않습니다.");
        setLoading(false);
        return;
      }

      if (data.user) {
        console.log("✅ Login successful");

        // Step 3: Fetch profile for redirect (user is now authenticated)
        const { data: profile } = await supabase
          .from("profiles")
          .select("status, role")
          .eq("id", data.user.id)
          .single();

        if (profile?.role === "admin") {
          localStorage.setItem("is_admin_device", "true");
          router.push("/admin");
        } else if (profile?.status === "pending") {
          router.push("/waiting");
        } else {
          router.push("/");
        }
      }
    } catch (error: any) {
      console.error("Login error:", error);
      setMessage("로그인 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e?: React.FormEvent | React.MouseEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    setResetLoading(true);
    setMessage("");

    const email = resetEmail.trim();
    if (!email) {
      setMessage("이메일 주소를 입력해주세요.");
      setResetLoading(false);
      return;
    }

    console.log("🔄 Password reset requested for:", email);
    console.log("🔑 Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log("🔑 Anon key present:", !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: "https://gimpogugak.com/update-password",
      });

      console.log("📧 resetPasswordForEmail response:", { data, error });

      if (error) {
        console.error("❌ Reset password error object:", JSON.stringify(error, null, 2));
        console.error("❌ Error details:", {
          message: error.message,
          status: error.status,
          name: error.name,
        });

        // ⚠️ Known Supabase issues:
        // - "Email rate limit exceeded": Supabase free tier limits to ~3 emails/hour. Check Dashboard > Auth > Rate Limits.
        // - "Identity provider not configured": SMTP is not set up in Supabase Dashboard > Auth > Email Templates > SMTP Settings.
        if (error.message?.includes("rate limit")) {
          setMessage("이메일 발송 한도를 초과했습니다. 잠시 후 다시 시도해주세요.");
        } else if (error.message?.includes("not configured") || error.message?.includes("provider")) {
          setMessage("이메일 서비스가 설정되지 않았습니다. 관리자에게 문의해주세요.");
        } else {
          setMessage(error.message || "재설정 메일 발송에 실패했습니다.");
        }
        return;
      }

      // Supabase returns success even if email doesn't exist (security by design)
      console.log("✅ Reset email request accepted by Supabase");
      setMessage("해당 이메일이 등록되어 있다면, 재설정 링크가 발송됩니다. 메일함(스팸 포함)을 확인해주세요.");
      setShowForgotPassword(false);
      setResetEmail("");
    } catch (err: unknown) {
      console.error("❌ Unexpected reset error:", err);
      const msg = err instanceof Error ? err.message : "재설정 메일 발송에 실패했습니다.";
      setMessage(msg);
    } finally {
      setResetLoading(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    if (!name || !phone || !pin) {
      setMessage("모든 필수 항목을 입력해주세요.");
      setLoading(false);
      return;
    }

    if (pin.length < 4) {
      setMessage("비밀번호는 4자리 이상이어야 합니다.");
      setLoading(false);
      return;
    }

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || !trimmedPhone) {
      setMessage("이름과 연락처를 정확히 입력해주세요.");
      setLoading(false);
      return;
    }

    // Check if phone already exists
    try {
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("phone")
        .eq("phone", trimmedPhone)
        .single();

      if (existingProfile) {
        setMessage("이미 등록된 전화번호입니다.");
        setLoading(false);
        return;
      }
    } catch (error: any) {
      // PGRST116 means no matching row, which is good (phone not registered)
      if (error.code !== "PGRST116") {
        console.error("Phone check error:", error);
      }
    }

    try {
      console.log("🔄 Starting signup process:", {
        name: trimmedName,
        phone: trimmedPhone,
        email: trimmedEmail
      });

      // Generate a unique email if not provided
      const signupEmail = trimmedEmail || `${trimmedPhone.replace(/[^0-9]/g, "")}@gimpogugak.com`;

      // Step 1: Sign up user with Auth using 4-digit PIN
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: signupEmail,
        password: pin,
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
            email: signupEmail,
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
                message.includes("완료") || message.includes("성공") || message.includes("보냈습니다") || message.includes("발송됩니다")
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
                  전화번호
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
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  비밀번호 (4자리 이상)
                </label>
                <input
                  type="password"
                  value={pin}
                  onChange={handlePinChange}
                  required
                  minLength={4}
                  maxLength={15}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg tracking-wide"
                  placeholder="••••"
                />
                <p className="text-xs text-gray-500 mt-1 text-center">
                  회원가입 시 설정한 비밀번호를 입력하세요 (4자리 이상, 공백 제외)
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword((prev) => !prev);
                    setMessage("");
                  }}
                  className="mt-2 text-xs text-blue-600 hover:text-blue-700 hover:underline"
                >
                  비밀번호를 잊으셨나요?
                </button>
              </div>

              {showForgotPassword && (
                <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-700">가입 시 등록한 이메일 주소를 입력하시면 재설정 링크를 보내드립니다.</p>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="example@email.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={resetLoading}
                      onClick={handleResetPassword}
                      className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {resetLoading ? "전송 중..." : "전송"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotPassword(false);
                        setResetEmail("");
                        setMessage("");
                      }}
                      className="px-3 py-2 text-gray-600 hover:text-gray-900 text-sm"
                    >
                      취소
                    </button>
                  </div>
                </div>
              )}

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
                  로그인 시 전화번호를 사용합니다
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이메일 (선택사항)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="example@email.com"
                />
                <p className="text-xs text-gray-500 mt-1">
                  입력하지 않으면 자동으로 생성됩니다
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  비밀번호 (4자리 이상) <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={pin}
                  onChange={handlePinChange}
                  required
                  minLength={4}
                  maxLength={15}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg tracking-wide"
                  placeholder="••••"
                />
                <p className="text-xs text-gray-500 mt-1 text-center">
                  로그인 시 사용할 비밀번호 (4자리 이상, 공백 제외)
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? "처리 중..." : "수강 신청하기"}
              </button>

              <p className="text-xs text-gray-500 text-center">
                신청 후 원장님의 승인을 기다려주세요
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
