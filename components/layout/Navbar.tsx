"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type NavItemSimple = { href: string; label: string };
type NavItemWithChildren = {
  href?: string;
  label: string;
  children: { href: string; label: string }[];
};
type NavItem = NavItemSimple | NavItemWithChildren;

function hasChildren(item: NavItem): item is NavItemWithChildren {
  return "children" in item && Array.isArray((item as NavItemWithChildren).children);
}

const GUEST_NAV: NavItem[] = [
  {
    label: "소개",
    href: "/about",
    children: [
      { href: "/director", label: "원장" },
      { href: "/Park-Jun-Yeol", label: "부원장" },
    ],
  },
  { href: "/classes", label: "수업" },
  { href: "/activities", label: "활동" },
  { href: "/contact", label: "문의" },
];

const STUDENT_NAV: NavItemSimple[] = [
  { href: "/notices", label: "공지사항" },
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
  const [mobileDropdown, setMobileDropdown] = useState<string | null>(null);
  const [desktopHover, setDesktopHover] = useState<string | null>(null);
  const [desktopClickOpen, setDesktopClickOpen] = useState<string | null>(null);
  const mobileDropdownRef = useRef<HTMLDivElement>(null);
  const desktopDropdownRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const NAV =
    userRole === "admin"
      ? ADMIN_NAV
      : userStatus === "active"
      ? STUDENT_NAV
      : GUEST_NAV;

  const hasGuestDropdown = userRole !== "admin" && userStatus !== "active";

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

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (mobileDropdown && mobileDropdownRef.current && !mobileDropdownRef.current.contains(target)) {
        setMobileDropdown(null);
      }
      if (desktopClickOpen && desktopDropdownRef.current && !desktopDropdownRef.current.contains(target)) {
        setDesktopClickOpen(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mobileDropdown, desktopClickOpen]);

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
      {/* Desktop: fixed left sidebar */}
      <div ref={desktopDropdownRef} className="hidden md:flex fixed left-0 top-0 bottom-0 w-[120px] px-6 py-12 border-r border-[#111111]/10 flex-col gap-6 z-40">
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
          {hasGuestDropdown ? (
            (GUEST_NAV as NavItem[]).map((item) => {
              if (hasChildren(item)) {
                const isActive = item.children.some((c) => pathname === c.href);
                const isOpen = desktopHover === item.label || desktopClickOpen === item.label;
                return (
                  <li
                    key={item.label}
                    className="relative"
                    onMouseEnter={() => setDesktopHover(item.label)}
                    onMouseLeave={() => setDesktopHover(null)}
                  >
                    <button
                      type="button"
                      onClick={() => setDesktopClickOpen(desktopClickOpen === item.label ? null : item.label)}
                      className={`block w-full text-left text-sm transition-colors cursor-pointer ${
                        isActive ? "text-[#111111] font-medium" : "text-[#666666] hover:text-[#111111]"
                      }`}
                    >
                      {item.label}
                    </button>
                    {isOpen && (
                      <ul className="absolute left-0 top-full mt-1 pt-2 pl-4 border-l-2 border-gray-200 space-y-2 min-w-[100px] bg-white z-[100] shadow-md rounded-b">
                        {item.children.map((child) => (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              className={`block text-sm transition-colors ${
                                pathname === child.href ? "text-[#111111] font-medium" : "text-[#666666] hover:text-[#111111]"
                              }`}
                            >
                              {child.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              }
              const isActive = pathname === (item as NavItemSimple).href;
              return (
                <li key={(item as NavItemSimple).href}>
                  <Link
                    href={(item as NavItemSimple).href}
                    className={`block text-left text-sm transition-colors ${
                      isActive ? "text-[#111111] font-medium" : "text-[#666666] hover:text-[#111111]"
                    }`}
                  >
                    {(item as NavItemSimple).label}
                  </Link>
                </li>
              );
            })
          ) : (
            (NAV as NavItemSimple[]).map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`block text-left text-sm transition-colors ${
                      isActive ? "text-[#111111] font-medium" : "text-[#666666] hover:text-[#111111]"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })
          )}
          <li className="mt-8 pt-4 border-t border-[#111111]/10">
            <AuthButton />
          </li>
        </ul>
      </div>

      {/* Mobile: Logo left, horizontal menu right (no hamburger) */}
      <div className="flex md:hidden items-center gap-2 sm:gap-3 px-3 sm:px-6 py-3 border-b border-[#111111]/10 min-h-[52px] relative z-[100]">
        <Link href="/" className="shrink-0 hover:opacity-90 transition-opacity">
          <Image
            src="/logo.png"
            alt="GIMPO GUGAK CENTER 김포국악원"
            width={80}
            height={28}
            className="h-6 sm:h-7 w-auto object-contain"
          />
        </Link>

        <div
          ref={mobileDropdownRef}
          className="flex flex-1 items-center justify-end gap-1 sm:gap-2 min-w-0 overflow-x-auto overflow-y-hidden"
        >
          {hasGuestDropdown ? (
            (GUEST_NAV as NavItem[]).map((item) => {
              if (hasChildren(item)) {
                const isOpen = mobileDropdown === item.label;
                const isActive = item.children.some((c) => pathname === c.href);
                return (
                  <div key={item.label} className="relative shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMobileDropdown(isOpen ? null : item.label);
                      }}
                      className={`py-2 px-1.5 sm:px-2 text-[13px] sm:text-sm whitespace-nowrap rounded transition-colors ${
                        isActive ? "text-[#111111] font-medium" : "text-[#666666] hover:text-[#111111]"
                      }`}
                    >
                      {item.label} ▾
                    </button>
                    {isOpen && (
                      <div className="absolute left-0 top-full mt-1 py-2 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[100px] z-[100]">
                        {item.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={() => setMobileDropdown(null)}
                            className={`block px-3 py-1.5 text-[13px] sm:text-sm ${
                              pathname === child.href ? "text-[#111111] font-medium" : "text-[#666666]"
                            }`}
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              const isActive = pathname === (item as NavItemSimple).href;
              return (
                <Link
                  key={(item as NavItemSimple).href}
                  href={(item as NavItemSimple).href}
                  className={`py-2 px-1.5 sm:px-2 text-[13px] sm:text-sm whitespace-nowrap rounded transition-colors shrink-0 ${
                    isActive ? "text-[#111111] font-medium" : "text-[#666666] hover:text-[#111111]"
                  }`}
                >
                  {(item as NavItemSimple).label}
                </Link>
              );
            })
          ) : (
            (NAV as NavItemSimple[]).map((item) => {
              const isActive = pathname === item.href;
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
            })
          )}
          <div className="shrink-0 pl-1 sm:pl-2 border-l border-gray-200">
            <AuthButton isMobile={true} />
          </div>
        </div>
      </div>
    </nav>
  );
}
