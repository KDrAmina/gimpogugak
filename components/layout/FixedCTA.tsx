"use client";

import { Phone, MessageCircle, MapPin } from "lucide-react";
import Link from "next/link";

export function FixedCTA() {
  const phone = process.env.NEXT_PUBLIC_PHONE ?? "031-XXX-XXXX";
  const kakaoUrl = process.env.NEXT_PUBLIC_KAKAO_URL ?? "#";

  return (
    <>
      {/* Desktop: 우측 플로팅 CTA */}
      <div className="hidden lg:flex fixed right-6 bottom-8 z-40 flex-col gap-3">
        <a
          href={`tel:${phone.replace(/-/g, "")}`}
          className="flex items-center gap-2 px-4 py-3 bg-primary text-paper rounded-sm shadow-lg hover:bg-primary/90 transition-colors"
          aria-label="전화 문의"
        >
          <Phone className="w-5 h-5" />
          <span className="text-sm font-medium">전화 문의</span>
        </a>
        <a
          href={kakaoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-3 bg-accent text-paper rounded-sm shadow-lg hover:bg-accent/90 transition-colors"
          aria-label="카카오톡 문의"
        >
          <MessageCircle className="w-5 h-5" />
          <span className="text-sm font-medium">카톡 문의</span>
        </a>
      </div>

      {/* Mobile: 하단 고정 바 */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex border-t border-ink/10 bg-paper/98 backdrop-blur-sm safe-area-pb">
        <a
          href={`tel:${phone.replace(/-/g, "")}`}
          className="flex-1 flex flex-col items-center justify-center py-3 text-ink hover:bg-ink/5 transition-colors"
        >
          <Phone className="w-5 h-5 mb-0.5" />
          <span className="text-xs font-medium">전화하기</span>
        </a>
        <a
          href={kakaoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex flex-col items-center justify-center py-3 text-ink hover:bg-ink/5 transition-colors"
        >
          <MessageCircle className="w-5 h-5 mb-0.5" />
          <span className="text-xs font-medium">카톡문의</span>
        </a>
        <Link
          href="/contact"
          className="flex-1 flex flex-col items-center justify-center py-3 text-ink hover:bg-ink/5 transition-colors"
        >
          <MapPin className="w-5 h-5 mb-0.5" />
          <span className="text-xs font-medium">오시는 길</span>
        </Link>
      </div>

      {/* 하단 CTA 높이만큼 여백 (모바일에서 본문이 가려지지 않도록) */}
      <div className="lg:hidden h-20" aria-hidden />
    </>
  );
}
