import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "공연·섭외",
  description: "행사/기관/학교 섭외 가능. 레퍼토리, 구성(인원/러닝타임), 진행 프로세스",
};

export default function BookingPage() {
  return (
    <div className="py-12 sm:py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-serif text-3xl text-ink font-semibold">공연·섭외</h1>
        <p className="mt-4 text-ink-light">
          섭외 가능한 레퍼토리, 구성(인원/러닝타임), 진행 프로세스, FAQ, 문의 CTA (콘텐츠·DB 연동 예정)
        </p>
      </div>
    </div>
  );
}
