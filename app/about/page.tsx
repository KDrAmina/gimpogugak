import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "국악원 소개",
  description: "김포국악원 소개, 원장/부원장 소개, 운영 철학, 시설, 오시는 길",
};

export default function AboutPage() {
  return (
    <div className="py-12 sm:py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-serif text-3xl text-ink font-semibold">국악원 소개</h1>
        <p className="mt-4 text-ink-light leading-relaxed">
          국악원 정체성(Modern Korean 톤의 짧은 문단), 원장/부원장 상세(약력/지도 철학),
          시설 사진, 오시는 길 요약 + CTA (DB·콘텐츠 연동 예정)
        </p>
      </div>
    </div>
  );
}
