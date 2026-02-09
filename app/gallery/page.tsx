import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "갤러리",
  description: "김포국악원 갤러리, 수업·행사·공연 사진",
};

export default function GalleryPage() {
  return (
    <div className="py-12 sm:py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="font-serif text-3xl text-ink font-semibold">갤러리</h1>
        <p className="mt-4 text-ink-light">
          Masonry/그리드 + 필터(행사/수업/공연), 썸네일 우선 로딩 (DB·Storage 연동 예정)
        </p>
      </div>
    </div>
  );
}
