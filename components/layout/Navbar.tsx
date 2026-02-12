"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const GUEST_NAV = [
  { href: "/", label: "소개" },
  { href: "/classes", label: "수업" },
  { href: "/activities", label: "활동" },
  { href: "/contact", label: "문의" },
];

const STUDENT_NAV = [
  { href: "/notices", label: "공지사항" },
  { href: "/my-lessons", label: "내 수업" },
];

const ADMIN_NAV = [
  { href: "/admin", label: "회원관리" },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  
  // Hide navbar completely on Admin pages
  if (pathname.startsWith("/admin")) {
    return null;
  }

  const [user, setUser] = useState<any>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userStatus, setUserStatus] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  // Dynamic NAV based on user role and status
  const NAV =
    userRole === "admin"
      ? ADMIN_NAV
      : userStatus === "active"
      ? STUDENT_NAV
      : GUEST_NAV;

  useEffect(() => {
    checkUser();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        fetchUserProfile(session.user.id);
      } else {
        setUser(null);
        setUserName(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function checkUser() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setUser(user);
        await fetchUserProfile(user.id);
      }
    } catch (error) {
      console.error("Error checking user:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchUserProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("name, status, role")
        .eq("id", userId)
        .single();

      if (error) throw error;
      setUserName(data?.name || null);
      setUserStatus(data?.status || null);
      setUserRole(data?.role || null);
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  }

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setUserName(null);
      setUserStatus(null);
      setUserRole(null);
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Error logging out:", error);
      alert("로그아웃 중 오류가 발생했습니다.");
    }
  }

  const AuthButton = ({ isMobile = false }: { isMobile?: boolean }) => {
    if (loading) {
      return null;
    }

    if (user) {
      return (
        <button
          onClick={handleLogout}
          className="px-2.5 py-1 text-xs text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors font-medium"
        >
          Logout
        </button>
      );
    }

    return (
      <Link
        href="/login"
        className="text-xs text-blue-600 hover:text-blue-700 transition-colors font-medium"
      >
        로그인
      </Link>
    );
  };

  return (
    <nav aria-label="메인 메뉴">
      {/* Desktop: fixed left sidebar */}
      <div className="hidden md:flex fixed left-0 top-0 bottom-0 w-[120px] px-6 py-12 border-r border-[#111111]/10 flex-col gap-6">
        <div className="block w-full">
          <Link href="/" className="block hover:opacity-90 transition-opacity">
            <Image
              src="/logo.png"
              alt="GIMPO GUGAK CENTER 김포국악원"
              width={100}
              height={48}
              className="w-full h-auto object-contain"
            />
          </Link>
        </div>
        <ul className="flex flex-col gap-4">
          {NAV.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`text-sm transition-colors ${
                    isActive
                      ? "text-[#111111] font-medium"
                      : "text-[#666666] hover:text-[#111111]"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
          {/* Auth button below menu items */}
          <li className="mt-2">
            <AuthButton />
          </li>
        </ul>
      </div>

      {/* Mobile: horizontal nav */}
      <div className="flex md:hidden flex-wrap items-center gap-x-6 gap-y-2 px-6 pt-8 pb-6 border-b border-[#111111]/10">
        <Link href="/" className="hover:opacity-90 transition-opacity shrink-0">
          <Image
            src="/logo.png"
            alt="GIMPO GUGAK CENTER 김포국악원"
            width={120}
            height={40}
            className="h-8 w-auto object-contain"
          />
        </Link>
        {NAV.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm transition-colors ${
                isActive
                  ? "text-[#111111] font-medium"
                  : "text-[#666666] hover:text-[#111111]"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
        {/* Auth button next to menu items */}
        <AuthButton isMobile={true} />
      </div>
    </nav>
  );
}
