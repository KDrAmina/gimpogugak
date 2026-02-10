import { createClient } from '@supabase/supabase-js';
import type { Metadata } from "next";
import Image from "next/image";

// 0. 새로고침하면 바로 반영되게 설정
export const dynamic = 'force-dynamic';

// 1. Supabase 연결
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export const metadata: Metadata = {
  title: "활동 갤러리 | 김포국악원 (Activities)",
  description:
    "김포국악원의 주요 공연 및 행사 활동. 김포예술제, 서도소리 공연, 찾아가는 국악 한마당 등.",
};

export default async function ActivitiesPage() {
  // 2. Supabase에서 사진 가져오기 (최신순)
  const { data: photos, error } = await supabase
    .from('gallery')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) console.error("데이터 로딩 실패:", error);

  // 3. Masonry 레이아웃을 위해 데이터 반으로 나누기 (왼쪽 줄 / 오른쪽 줄)
  // (데이터가 없으면 빈 배열 [])
  const allPhotos = photos || [];
  const leftColumn = allPhotos.filter((_, i) => i % 2 === 0); // 짝수 번째 (0, 2, 4...)
  const rightColumn = allPhotos.filter((_, i) => i % 2 !== 0); // 홀수 번째 (1, 3, 5...)

  return (
    <section className="mx-auto max-w-2xl px-6 py-12 pb-24">
      {/* 헤더 */}
      <div className="mb-12">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-[#111] mb-4">
          활동 갤러리
        </h1>
        <p className="text-[#666] leading-relaxed">
          무대 위에서의 열정과 현장에서의 생생한 모습을 기록합니다.
          <br />
          끊임없이 소통하며 우리 소리를 알리는 김포국악원의 발자취입니다.
        </p>
      </div>

      {/* Masonry 느낌 그리드 (2열) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        
        {/* 왼쪽 기둥 */}
        <div className="space-y-6">
          {leftColumn.map((photo) => (
            <PhotoCard
              key={photo.id}
              src={photo.image_url}
              title={photo.caption || "활동 사진"} // 설명 없으면 기본값
              year={photo.created_at.substring(0, 4)} // "2024-02-10..."에서 앞 4글자만 자름
            />
          ))}
          {/* 사진이 하나도 없을 때 안내 문구 (왼쪽에만 표시) */}
          {allPhotos.length === 0 && (
            <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-500">
              아직 등록된 활동 사진이 없습니다.
            </div>
          )}
        </div>

        {/* 오른쪽 기둥 */}
        <div className="space-y-6">
          {rightColumn.map((photo) => (
            <PhotoCard
              key={photo.id}
              src={photo.image_url}
              title={photo.caption || "활동 사진"}
              year={photo.created_at.substring(0, 4)}
            />
          ))}
        </div>

      </div>
    </section>
  );
}

// --- 카드 컴포넌트 (디자인 그대로 유지) ---
function PhotoCard({
  src,
  title,
  year,
}: {
  src: string;
  title: string;
  year: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl bg-[#111]/5">
      <Image
        src={src}
        alt="활동 사진"
        width={500}
        height={400}
        className="h-auto w-full object-cover transition-transform duration-500 group-hover:scale-105"
        sizes="(max-width: 640px) 100vw, 50vw"
      />
      {/* 텍스트 나오는 부분을 싹 지웠습니다! 이제 사진만 깔끔하게 나옵니다. */}
    </div>
  );
}