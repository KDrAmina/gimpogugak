import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import ActivitiesGalleryClient from "./GalleryClient";

// On-Demand Revalidation 대기 — 갤러리 관리 기능 구현 시 revalidateActivities() 호출 예정
// 현재는 타이머 없이 무기한 캐시 유지 (빌드 시 정적 생성)
export const revalidate = false;

// Supabase 연결 (서버 컴포넌트에서 직접 사용)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// SEO 메타데이터 (서버 컴포넌트에서만 export 가능)
export const metadata: Metadata = {
  title: "활동 갤러리 | 김포국악원 (Activities)",
  description:
    "김포국악원의 주요 공연 및 행사 활동. 김포예술제, 서도소리 공연, 찾아가는 국악 한마당 등.",
};

export default async function ActivitiesPage() {
  // Supabase에서 전체 사진 가져오기 (최신순)
  // category 컬럼도 함께 조회하여 클라이언트 필터링에 사용
  const { data: photos, error } = await supabase
    .from("gallery")
    .select("id, image_url, caption, category, created_at")
    .order("created_at", { ascending: false });

  if (error) console.error("데이터 로딩 실패:", error);

  return (
    <section className="mx-auto max-w-2xl px-6 py-12 pb-24">
      {/* 헤더 */}
      <div className="mb-10">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-[#111] mb-4">
          활동 갤러리
        </h1>
        <p className="text-[#666] leading-relaxed">
          무대 위에서의 열정과 현장에서의 생생한 모습을 기록합니다.
          <br />
          끊임없이 소통하며 우리 소리를 알리는 김포국악원의 발자취입니다.
        </p>
      </div>

      {/* 클라이언트 컴포넌트: 필터 버튼 + 갤러리 그리드 */}
      {/* 서버에서 받아온 전체 사진 데이터를 props로 전달 */}
      <ActivitiesGalleryClient allPhotos={photos ?? []} />
    </section>
  );
}
