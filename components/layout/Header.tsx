"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu, X, Phone, MessageCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const NAV = [
  { href: "/", label: "홈" },
  { href: "/about", label: "국악원 소개" },
  { href: "/teachers", label: "강사진" },
  { href: "/classes", label: "수업 안내" },
  { href: "/notices", label: "공지사항" },
  { href: "/gallery", label: "갤러리" },
  { href: "/booking", label: "공연·섭외" },
  { href: "/contact", label: "문의하기" },
];

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolledPastHero, setScrolledPastHero] = useState(false);
  const phone = process.env.NEXT_PUBLIC_PHONE ?? "031-XXX-XXXX";
  const kakaoUrl = process.env.NEXT_PUBLIC_KAKAO_URL ?? "#";
  const isHome = pathname === "/";

  useEffect(() => {
    if (!isHome) return;
    const onScroll = () => {
      const heroHeight = typeof window !== "undefined" ? window.innerHeight - 80 : 800;
      setScrolledPastHero(window.scrollY > heroHeight);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);

  const headerHidden = isHome && scrolledPastHero;

  const headerBase =
    "sticky top-0 z-50 backdrop-blur-sm transition-all duration-300";
  const headerBg = isHome && !scrolledPastHero
    ? "bg-transparent border-b border-white/20"
    : "bg-hanji-50/95 border-b border-ink/10";

  const textColor = isHome ? "text-white hover:text-primary transition-colors" : "text-ink";
  const linkColor = isHome ? "text-white/90 hover:text-primary transition-colors" : "text-ink-light hover:text-primary transition-colors";
  const btnBg = isHome
    ? "bg-transparent border border-accent/80 text-white hover:bg-accent/20 transition-colors"
    : "bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-colors";
  const kakaoBtn = isHome
    ? "bg-transparent border border-accent/80 text-white hover:bg-accent/20 transition-colors"
    : "bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-colors";

  return (
    <header
      className={`${headerBase} ${headerBg} ${
        headerHidden ? "-translate-y-full opacity-0 pointer-events-none" : ""
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16 sm:h-18">
        <Link href="/" className="flex items-center shrink-0">
          <Image
            src="/logo-white.png"
            alt="김포국악원 GIMPO GUGAK CENTER"
            width={160}
            height={48}
            className={`h-10 sm:h-12 w-auto object-contain ${isHome ? "drop-shadow-[0_0_12px_rgba(255,255,255,0.4)]" : ""}`}
            priority
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-1">
          {NAV.filter((n) => n.href !== "/").map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-2 text-sm transition-colors ${linkColor}`}
            >
              {item.label}
            </Link>
          ))}
          <div className="ml-4 flex items-center gap-2">
            <a
              href={`tel:${phone.replace(/-/g, "")}`}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-sm ${btnBg}`}
            >
              <Phone className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">전화</span>
            </a>
            <a
              href={kakaoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-sm ${kakaoBtn}`}
            >
              <MessageCircle className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">카톡</span>
            </a>
          </div>
        </nav>

        {/* Mobile menu button */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`lg:hidden p-2 ${textColor}`}
          aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
        >
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile nav */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden border-t border-ink/10 bg-hanji-50"
          >
            <nav className="max-w-6xl mx-auto px-4 py-4 flex flex-col gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="px-3 py-2.5 text-ink-light hover:text-accent hover:bg-ink/10 rounded-sm"
                >
                  {item.label}
                </Link>
              ))}
              <div className="mt-3 pt-3 border-t border-ink/10 flex gap-2">
                <a
                  href={`tel:${phone.replace(/-/g, "")}`}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-primary border border-primary/50 rounded-sm hover:bg-primary/10"
                >
                  <Phone className="w-4 h-4" /> 전화
                </a>
                <a
                  href={kakaoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-primary border border-primary/50 rounded-sm hover:bg-primary/10"
                >
                  <MessageCircle className="w-4 h-4" /> 카톡
                </a>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
