"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "소개" },
  { href: "/classes", label: "수업" },
  { href: "/activities", label: "활동" },
  { href: "/contact", label: "문의" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav aria-label="메인 메뉴">
      {/* Desktop: fixed left sidebar */}
      <div className="hidden md:flex fixed left-0 top-0 bottom-0 w-[120px] px-6 py-12 border-r border-[#111111]/10 flex-col gap-6">
        <Link href="/" className="block w-full hover:opacity-90 transition-opacity">
          <Image
            src="/logo.png"
            alt="GIMPO GUGAK CENTER 김포국악원"
            width={100}
            height={48}
            className="w-full h-auto object-contain"
          />
        </Link>
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
      </div>
    </nav>
  );
}
