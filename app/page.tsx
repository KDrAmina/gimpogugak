import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { HomeBadges } from "@/components/home/HomeBadges";
import { HomeConnect } from "@/components/home/HomeConnect";

// 👇 외부 이미지 주소
const HERO_IMAGE =
  "/main_image.webp";

export const metadata: Metadata = {
  title: "김포국악원 | 장기동·사우동·고촌 민요·성악·국악학원",
  description:
    "경기 김포시 장기동·사우동·고촌읍 인근 국악 전문 교육원. 황해도무형문화재 이수자 원장 직강, 민요교실·성악발성·장구 정규반, 교육부 진로체험 인증기관.",
  openGraph: {
    title: "김포국악원 | 장기동·사우동·고촌 민요·성악·국악학원",
    description: "경기 김포시 장기동·사우동·고촌읍 인근 국악 전문 교육원. 무형문화재 이수자 원장 직강, 민요·성악·장구 정규반, 교육부 진로체험 인증기관.",
    type: "website",
  },
};

export default function HomePage() {
  return (
    <>
      {/*
        Force-inject a <link rel="preload"> for the LCP image into <head>.
        Next.js App Router hoists bare <link> elements from Server Components
        to the document head automatically, so this fires as early as any
        other resource hint — before React even begins hydrating.
        Belt-and-suspenders on top of the `priority` / fetchPriority props
        on the <Image> below.
      */}
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <link
        rel="preload"
        as="image"
        href={HERO_IMAGE}
        fetchPriority="high"
      />
      <article className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#111] tracking-tight">
        김포를 대표하는 프리미엄 국악 &amp; 성악 교육, 김포국악원
      </h1>
      <p className="mt-3 text-base text-[#555] leading-relaxed">
        유치원·학생 국악 체험부터 어르신 민요 교실, 그리고 전공자가 직접 지도하는 1:1 성악·발성 레슨까지. 우리 소리와 서양 음악의 깊이를 한곳에서 만납니다.
      </p>

      <figure className="mt-8 rounded-lg overflow-hidden bg-gray-100"> 
        {/* 👆 bg-gray-100 추가: 이미지 로딩될 때 아주 잠깐 회색 배경 보여줘서 시각적 안정감 줌 */}
        <Image
          src={HERO_IMAGE}
          alt="한옥 처마와 자연, 김포국악원"
          priority
          fetchPriority="high" // 👈 아주 잘하셨습니다! (가장 중요)
          width={1000}
          height={563}
          className="w-full aspect-video object-cover"
          // 👇 sizes 속성을 조금 더 현실적으로 조정 (모바일/PC 구분)
          sizes="(max-width: 768px) 100vw, 1200px"
        />
      </figure>

      <div className="mt-10 space-y-6 font-sans text-[#111] leading-relaxed">
        <p>
          &quot;국악은 어렵고 낯설다&quot;는 편견, 우리도 잘 압니다.
          하지만 실제로 만나보면 국악만큼 우리 목소리와 마음에 자연스럽게 스며드는 음악도 없습니다.
        </p>
        <p>
          김포국악원은{" "}
          <Link href="/Song-Ri-Gyel" className="text-[#111] underline hover:no-underline font-medium">
            황해도무형문화재 제3호 놀량사거리 이수자이신 원장님
          </Link>
          과{" "}
          <Link href="/Park-Jun-Yeol" className="text-[#111] underline hover:no-underline font-medium">
            성악을 전공한 부원장님
          </Link>
          이 함께 운영하는 공간입니다.
          두 분의 전문성이 만나 전통의 깊이와 현대 음악교육의 체계가 조화를 이루고 있습니다.
        </p>
        <p>
          저희 국악원은 교육부 인증 진로체험기관으로 선정되어 청소년들에게 살아있는 진로교육을 제공하고 있으며,
          다양한 문화예술 지원사업을 통해 지역사회와 함께 성장하고 있습니다.{" "}
          크라운해태 전국대회, 서도소리경연대회 등에서 원생들이 꾸준히 수상하며 실력을 인정받고 있고,
          매년 정기공연을 통해 배움의 기쁨을 무대 위에서 나누고 있습니다.
        </p>
        <p>
          특히 부원장님은 김포신문에 &apos;
          <a
            href="https://www.igimpo.com/news/articleView.html?idxno=90054"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#111] underline hover:no-underline"
          >
            두 개의 목소리가 만나는 음악 시간
          </a>
          &apos;이라는 칼럼을 연재하며, 노래를 어려워하는 청소년들이 성악과 민요를 자유롭게 넘나들며 자신만의 목소리를 찾아가는 과정을 함께하고 있습니다.
        </p>
        <p>
          민요, 장구, 단체반, 대취타 체험까지.
          나이와 실력에 관계없이 누구나 편안하게 시작할 수 있습니다.
          공연과 섭외 문의도 언제든 환영합니다.
        </p>
        <p className="font-medium text-lg pt-4">
          전통을 제대로, 그리고 따뜻하게 배우고 싶으신가요?
          <br className="sm:hidden" /> 김포국악원에서 시작해보세요.
        </p>
      </div>

      <Suspense fallback={null}><HomeBadges /></Suspense>
      <Suspense fallback={null}><HomeConnect /></Suspense>
    </article>
    </>
  );
}