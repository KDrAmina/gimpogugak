import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "활동 갤러리 | 김포국악원 (Activities)",
  description:
    "김포국악원의 주요 공연 및 행사 활동. 김포예술제, 서도소리 공연, 찾아가는 국악 한마당 등.",
};

export default function ActivitiesPage() {
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
        <div className="space-y-6">
          <PhotoCard
            src="https://images.unsplash.com/photo-1516962080544-e1163a89e88d?q=80&w=1000&auto=format&fit=crop"
            title="김포 한옥마을 기획 공연"
            year="2024"
          />
          <PhotoCard
            src="https://images.unsplash.com/photo-1532274402911-5a369e4c4bb5?q=80&w=1000&auto=format&fit=crop"
            title="전국서도대회 수상 기념"
            year="2021"
          />
          <PhotoCard
            src="https://images.unsplash.com/photo-1523580494863-6f3031224c94?q=80&w=1000&auto=format&fit=crop"
            title="찾아가는 국악 교실"
            year="2023"
          />
        </div>
        <div className="space-y-6">
          <PhotoCard
            src="https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=1000&auto=format&fit=crop"
            title="서도소리와 향연"
            year="2024"
          />
          <PhotoCard
            src="https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?q=80&w=1000&auto=format&fit=crop"
            title="제37회 정기공연 '한소리 한마당'"
            year="2014"
          />
          <PhotoCard
            src="https://images.unsplash.com/photo-1605218427306-633ba87c9759?q=80&w=1000&auto=format&fit=crop"
            title="학생들과 함께한 국악 체험"
            year="2023"
          />
        </div>
      </div>
    </section>
  );
}

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
        alt={title}
        width={500}
        height={400}
        className="h-auto w-full object-cover transition-transform duration-500 group-hover:scale-105"
        sizes="(max-width: 640px) 100vw, 50vw"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 flex flex-col justify-end p-6">
        <span className="text-xs text-white/80 font-medium tabular-nums mb-1">
          {year}
        </span>
        <h3 className="text-white font-bold text-lg leading-tight">{title}</h3>
      </div>
    </div>
  );
}
