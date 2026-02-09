import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "공지사항",
  description: "김포국악원 공지사항, 수강 모집, 행사 후기, 공연 소식",
};

export default function NoticesPage() {
  return (
    <div className="py-12 sm:py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-serif text-3xl text-ink font-semibold">공지사항</h1>
        <p className="mt-4 text-ink-light">
          목록(검색/태그 선택은 옵션), 상세: 제목/날짜/본문 + 하단 CTA + 관련 공지 (DB 연동 예정)
        </p>
      </div>
    </div>
  );
}
