import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "강사진",
  description: "김포국악원 강사진 소개, 전문 분야, 지도 가능 수업",
};

export default function TeachersPage() {
  return (
    <div className="py-12 sm:py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="font-serif text-3xl text-ink font-semibold">강사진</h1>
        <p className="mt-4 text-ink-light">
          강사 카드(정렬: 대표 우선), 상세: 전문 분야/지도 가능 수업/영상 링크,
          &quot;이 강사에게 문의&quot; CTA (DB 연동 예정)
        </p>
      </div>
    </div>
  );
}
