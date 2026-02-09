"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

const SLIDES = [
  {
    src: "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=800&q=80",
    alt: "김포국악원 활동 1",
    href: "/gallery",
  },
  {
    src: "https://images.unsplash.com/photo-1547981609-4b6bfe67ca0b?w=800&q=80",
    alt: "김포국악원 활동 2",
    href: "/gallery",
  },
  {
    src: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&q=80",
    alt: "김포국악원 활동 3",
    href: "/gallery",
  },
];

export function HeroCarousel() {
  const [index, setIndex] = useState(0);

  const prev = () => setIndex((i) => (i === 0 ? SLIDES.length - 1 : i - 1));
  const next = () => setIndex((i) => (i === SLIDES.length - 1 ? 0 : i + 1));

  return (
    <div className="relative h-full min-h-[200px] rounded-md overflow-hidden shadow-content border border-ink/5 bg-hanji-50">
      <Link href={SLIDES[index].href} className="block h-full min-h-[200px] relative">
        <Image
          src={SLIDES[index].src}
          alt={SLIDES[index].alt}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
      </Link>

      {/* 왼쪽/오른쪽 넘기기 버튼 */}
      <button
        type="button"
        onClick={prev}
        className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-black/40 hover:bg-black/60 text-white rounded-full transition-colors z-10"
        aria-label="이전"
      >
        <ChevronLeft className="w-5 h-5 shrink-0" strokeWidth={2.5} />
      </button>
      <button
        type="button"
        onClick={next}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-black/40 hover:bg-black/60 text-white rounded-full transition-colors z-10"
        aria-label="다음"
      >
        <ChevronRight className="w-5 h-5 shrink-0" strokeWidth={2.5} />
      </button>

      {/* 인디케이터 */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIndex(i)}
            className={`w-2 h-2 rounded-full transition-colors ${
              i === index ? "bg-white" : "bg-white/50"
            }`}
            aria-label={`슬라이드 ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
