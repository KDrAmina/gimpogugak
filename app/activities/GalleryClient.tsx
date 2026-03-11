"use client";

import { useState, useCallback } from "react";
import Image from "next/image";

// ── 타입 정의 ──────────────────────────────────────────────────────────────────
type Photo = {
  id: string;
  image_url: string;
  caption?: string;
  category?: string;
  created_at: string;
};

// ── 필터 버튼 목록 ─────────────────────────────────────────────────────────────
// 관리자 업로드 페이지의 MASTER_CATEGORIES와 동일하게 유지해야 합니다.
const FILTERS = ["전체", "공연", "체험", "수업"] as const;
type FilterKey = (typeof FILTERS)[number];

// ── 클라이언트 갤러리 컴포넌트 ──────────────────────────────────────────────────
export default function ActivitiesGalleryClient({
  allPhotos,
}: {
  allPhotos: Photo[];
}) {
  // 현재 선택된 필터 (기본값: 전체)
  const [activeFilter, setActiveFilter] = useState<FilterKey>("전체");
  // 필터 전환 시 fade 애니메이션을 위한 상태
  const [fading, setFading] = useState(false);
  // 현재 화면에 표시되는 사진 목록
  const [displayedPhotos, setDisplayedPhotos] = useState<Photo[]>(allPhotos);

  /**
   * 필터 버튼 클릭 핸들러
   * 200ms 동안 fade-out → 필터 적용 → fade-in 순서로 애니메이션을 수행합니다.
   */
  const handleFilter = useCallback(
    (key: FilterKey) => {
      if (key === activeFilter) return; // 동일 필터 재클릭 시 무시

      setFading(true); // fade-out 시작

      setTimeout(() => {
        // 필터 적용: '전체'는 전부 표시, 나머지는 category 일치 항목만
        const filtered =
          key === "전체"
            ? allPhotos
            : allPhotos.filter((p) => p.category === key);

        setDisplayedPhotos(filtered);
        setActiveFilter(key);
        setFading(false); // fade-in 시작
      }, 200);
    },
    [activeFilter, allPhotos]
  );

  // Masonry 2열 레이아웃: 짝수 인덱스→왼쪽, 홀수 인덱스→오른쪽
  const leftColumn = displayedPhotos.filter((_, i) => i % 2 === 0);
  const rightColumn = displayedPhotos.filter((_, i) => i % 2 !== 0);

  return (
    <>
      {/* ── 필터 버튼 영역 ──────────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap mb-10">
        {FILTERS.map((key) => (
          <button
            key={key}
            onClick={() => handleFilter(key)}
            aria-pressed={activeFilter === key}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all duration-200 ${
              activeFilter === key
                ? "bg-[#111] text-white border-[#111] shadow-sm"
                : "bg-white text-[#666] border-[#ddd] hover:border-[#999] hover:text-[#333]"
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      {/* ── 갤러리 그리드 (fade 애니메이션 적용) ───────────────────────────── */}
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 gap-6 transition-opacity duration-200 ${
          fading ? "opacity-0" : "opacity-100"
        }`}
      >
        {/* 왼쪽 기둥 */}
        <div className="space-y-6">
          {leftColumn.map((photo) => (
            <PhotoCard
              key={photo.id}
              src={photo.image_url}
              caption={photo.caption ?? "활동 사진"}
            />
          ))}
          {/* 사진이 없을 때 안내 문구 (왼쪽 열에만 표시) */}
          {displayedPhotos.length === 0 && (
            <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-500">
              {activeFilter === "전체"
                ? "아직 등록된 활동 사진이 없습니다."
                : `'${activeFilter}' 카테고리의 사진이 없습니다.`}
            </div>
          )}
        </div>

        {/* 오른쪽 기둥 */}
        <div className="space-y-6">
          {rightColumn.map((photo) => (
            <PhotoCard
              key={photo.id}
              src={photo.image_url}
              caption={photo.caption ?? "활동 사진"}
            />
          ))}
        </div>
      </div>
    </>
  );
}

// ── 사진 카드 컴포넌트 ─────────────────────────────────────────────────────────
function PhotoCard({ src, caption }: { src: string; caption: string }) {
  return (
    <div className="group relative overflow-hidden rounded-xl bg-[#111]/5">
      <Image
        src={src}
        alt={caption} // SEO: 캡션을 alt 텍스트로 사용
        width={500}
        height={400}
        className="h-auto w-full object-cover transition-transform duration-500 group-hover:scale-105"
        sizes="(max-width: 640px) 100vw, 50vw"
        loading="lazy"
      />
    </div>
  );
}
