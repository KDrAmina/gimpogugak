"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type NavItemSimple = { href: string; label: string };

const GUEST_NAV: NavItemSimple[] = [
  { href: "/intro", label: "소개" },
  { href: "/blog", label: "블로그" },
  { href: "/classes", label: "수업" },
  { href: "/activities", label: "활동" },
  { href: "/contact", label: "문의" },
];

const STUDENT_NAV: NavItemSimple[] = [
  { href: "/notices", label: "공지사항" },
  { href: "/blog", label: "블로그" },
  { href: "/my-lessons", label: "내 수업" },
  { href: "/my-info", label: "내 정보" },
];

const ADMIN_NAV: NavItemSimple[] = [
  { href: "/admin", label: "회원관리" },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname.startsWith("/admin")) {
    return null;
  }

  const [user, setUser] = useState<any>(null);
  const [userStatus, setUserStatus] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const NAV =
    userRole === "admin"
      ? ADMIN_NAV
      : userStatus === "active"
      ? STUDENT_NAV
      : GUEST_NAV;

  useEffect(() => {
    checkUser();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        fetchUserProfile(session.user.id);
      } else {
        setUser(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function checkUser() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
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
    if (loading) return null;
    if (user) {
      return (
        <button
          onClick={handleLogout}
          className={`text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors font-medium ${
            isMobile ? "text-xs sm:text-sm py-2 px-2 rounded" : "px-2.5 py-1 rounded-full text-sm"
          }`}
        >
          Logout
        </button>
      );
    }
    return (
      <Link
        href="/login"
        className={`text-blue-600 hover:text-blue-700 transition-colors font-medium ${
          isMobile ? "text-xs sm:text-sm py-2 px-2" : "text-sm"
        }`}
      >
        로그인
      </Link>
    );
  };

  return (
    <nav aria-label="메인 메뉴">
      {/* Desktop: fixed top navbar — 로고 + 메뉴 한 줄 가로 중앙 정렬 */}
      <div className="hidden md:flex fixed top-0 left-0 right-0 h-16 items-center justify-center gap-8 border-b border-[#111111]/10 z-40 bg-white/95 backdrop-blur-sm">
        <Link href="/" className="shrink-0 hover:opacity-90 transition-opacity">
          <Image
            src="/logo.png"
            alt="GIMPO GUGAK CENTER 김포국악원"
            width={120}
            height={48}
            className="h-10 w-auto object-contain"
          />
        </Link>
        <ul className="flex items-center gap-6">
          {(NAV as NavItemSimple[]).map((item) => {
            const isActive = pathname === item.href || (item.href === "/intro" && pathname.startsWith("/intro")) || (item.href === "/blog" && pathname.startsWith("/blog"));
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`text-sm transition-colors ${
                    isActive ? "text-[#111111] font-medium" : "text-[#666666] hover:text-[#111111]"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="border-l border-[#111111]/10 pl-6">
          <AuthButton />
        </div>
      </div>
      {/* Desktop spacer: 헤더 높이만큼 본문 밀어내기 */}
      <div className="hidden md:block h-16" />

      {/* Mobile: Logo left, horizontal menu right — 로고 max-width로 메뉴 겹침 방지 */}
      <div className="flex md:hidden items-center gap-2 sm:gap-3 px-3 sm:px-6 py-3 border-b border-[#111111]/10 min-h-[60px] relative z-[100]">
        <Link href="/" className="shrink-0 max-w-[100px] sm:max-w-[110px] hover:opacity-90 transition-opacity">
          <Image
            src="/logo.png"
            alt="GIMPO GUGAK CENTER 김포국악원"
            width={120}
            height={48}
            className="h-10 sm:h-12 w-auto object-contain"
          />
        </Link>

        <div className="flex flex-1 items-center justify-start gap-1 sm:gap-2 min-w-0 overflow-x-auto overflow-y-hidden min-h-[40px]">
          {(NAV as NavItemSimple[]).map((item) => {
            const isActive = pathname === item.href || (item.href === "/intro" && pathname.startsWith("/intro")) || (item.href === "/blog" && pathname.startsWith("/blog"));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`py-2 px-1.5 sm:px-2 text-[13px] sm:text-sm whitespace-nowrap rounded transition-colors shrink-0 ${
                  isActive ? "text-[#111111] font-medium" : "text-[#666666] hover:text-[#111111]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <div className="shrink-0 pl-1 sm:pl-2 border-l border-gray-200 min-h-[36px] flex items-center">
            <AuthButton isMobile={true} />
          </div>
        </div>
      </div>
    </nav>
  );
}
