import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { HomeBadges } from "@/components/home/HomeBadges";
import { HomeConnect } from "@/components/home/HomeConnect";
import PhoneCallLink from "@/components/PhoneCallLink";
import { createClient } from "@/lib/supabase/server";
import { getBlogPostPath } from "@/lib/blog-utils";
import { formatDateKST } from "@/lib/date-utils";

const HERO_IMAGE = "/main_image.webp";

const NAVER_MAP_HREF =
  "https://map.naver.com/v5/search/" +
  encodeURIComponent("경기도 김포시 모담공원로 170-14");

export const revalidate = 60;

export const metadata: Metadata = {
  title: "김포국악원 | 민요·성악·발성 전문 교육",
  description:
    "김포 유일 동서양 음악 전문기관. 어린이 국악 체험부터 어르신 민요교실, 전공자 성악 발성 레슨까지. 맞춤형 음악 교육을 시작하세요.",
  openGraph: {
    title: "김포국악원 | 민요·성악·발성 전문 교육",
    description:
      "김포 유일 동서양 음악 전문기관. 어린이 국악 체험부터 어르신 민요교실, 전공자 성악 발성 레슨까지. 맞춤형 음악 교육을 시작하세요.",
    type: "website",
  },
};

export default async function HomePage() {
  const supabase = await createClient();

  const [{ data: photos }, { data: posts }] = await Promise.all([
    supabase
      .from("gallery")
      .select("id, image_url, caption")
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("posts")
      .select("id, slug, title, external_url, published_at")
      .in("category", ["소식", "음악교실", "국악원소식"])
      .lte("published_at", new Date().toISOString())
      .eq("is_notice", false)
      .order("published_at", { ascending: false })
      .limit(5),
  ]);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <link rel="preload" as="image" href={HERO_IMAGE} fetchPriority="high" imageSizes="(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 800px" />

      {/* ============================================================
          외부 래퍼
          모바일: max-w-2xl, 1단 세로 흐름 — 절대 변경 없음
          데스크탑: max-w-6xl, 3구역(상단 텍스트 / 중단 사진+위젯 / 하단 본문)
          ============================================================ */}
      <div className="max-w-2xl lg:max-w-6xl mx-auto px-6 pt-10 sm:pt-14 pb-0">

        {/* ══════════════════════════════════════════════════════════
            [구역 1] 메인 텍스트
            모바일: 좌정렬, 위에서 아래로 자연스럽게 흐름
            데스크탑: 정중앙 배치 (text-center, max-w-3xl, mx-auto)
            ══════════════════════════════════════════════════════════ */}
        <div className="mb-8 lg:mb-10 lg:text-center lg:max-w-3xl lg:mx-auto">

          {/* 뱃지 */}
          <div className="mb-4 lg:flex lg:justify-center">
            <span className="inline-block text-xs font-medium tracking-widest uppercase px-3 py-1 rounded-full border border-[#b59a6a] text-[#8a6f3e] bg-[#fdf8f0]">
              김포 유일 · 동서양 음악 교육 전문기관
            </span>
          </div>

          {/* 메인 타이틀 */}
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#111] tracking-tight leading-snug mt-4 mb-6">
            왕초보도 속 시원하게,<br />
            참 쉬운 우리 민요
          </h1>

          {/* 서브 설명 */}
          <p className="text-base sm:text-lg text-gray-500 leading-relaxed">
            전통 민요와 성악 발성이 만나 왕초보도 쉽습니다.<br />
            아이들의 신나는 체험부터 어른의 즐거운 취미 생활까지!
          </p>

          {/* CTA 버튼 */}
          <div className="mt-7 flex flex-wrap gap-3 lg:justify-center">
            <Link
              href="/contact"
              className="bg-[#8a6f3e] hover:bg-[#7a5f2e] text-white px-6 py-3 rounded-lg font-medium transition-colors text-sm sm:text-base"
            >
              편하게 상담받기
            </Link>
            <Link
              href="/classes"
              className="border border-[#8a6f3e] text-[#8a6f3e] hover:bg-[#fdf8f0] px-6 py-3 rounded-lg font-medium transition-colors text-sm sm:text-base"
            >
              프로그램 안내 보기
            </Link>
          </div>

          {/* 신뢰 지표 */}
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-400 lg:justify-center">
            <span>✓ 무형문화재 원장 직강</span>
            <span>✓ 왕초보 민요 전문</span>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
            [구역 2] 사진 + 위젯 그리드
            모바일: 1단 (히어로 이미지만, 위젯 hidden)
            데스크탑: 좌 col-8(히어로) | 우 col-4(위젯 3개)
            ══════════════════════════════════════════════════════════ */}
        <div className="lg:grid lg:grid-cols-12 lg:gap-8 lg:items-start">

          {/* ── 좌측: 히어로 이미지 + 본문 텍스트 ── */}
          <div className="lg:col-span-8">
            <figure className="rounded-2xl overflow-hidden bg-gray-100 shadow-lg">
              <Image
                src={HERO_IMAGE}
                alt="김포문화원 앞마당에서 열린 국악 공연, 김포국악원"
                priority
                fetchPriority="high"
                unoptimized
                width={1200}
                height={600}
                className="w-full object-cover"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 800px"
                placeholder="blur"
                blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwMCIgaGVpZ2h0PSI2MDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzk0OGI3ZCIvPjwvc3ZnPg=="
              />
            </figure>

            {/* 본문 텍스트 — 이미지 바로 아래, 모바일/데스크탑 동일 흐름 */}
            <div className="mt-8 pb-10 space-y-6 font-sans text-[#111] leading-relaxed">
              <p>
                &quot;국악은 어렵고 낯설다&quot;는 편견, 우리도 잘 압니다.
                하지만 실제로 만나보면 국악만큼 우리 목소리와 마음에 자연스럽게 스며드는 음악도 없습니다.
              </p>
              <p>
                김포국악원은{" "}
                <Link href="/Song-Ri-Gyel" className="text-[#111] underline hover:no-underline font-medium">
                  무형문화재 제3호 놀량사거리 이수자이신 원장님
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
                전통을 제대로, 따뜻하게 배우고 싶으신가요?
                <br className="sm:hidden" /> 김포국악원에서 시작해보세요.
              </p>
            </div>
          </div>

          {/* ── 우측: 위젯 3개 — 데스크탑 전용 ── */}
          <aside className="hidden lg:flex lg:col-span-4 lg:flex-col lg:gap-4">

            {/* Widget A: 생생한 활동 모습 */}
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold text-[#111]">생생한 활동 모습</h2>
                <Link href="/activities" className="text-sm text-[#8a6f3e] hover:underline">
                  전체 보기 →
                </Link>
              </div>
              {photos && photos.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {photos.map((photo) => (
                    <Link
                      key={photo.id}
                      href="/activities"
                      className="block rounded-xl overflow-hidden bg-gray-100 hover:opacity-90 transition-opacity"
                    >
                      <Image
                        src={photo.image_url}
                        alt={photo.caption ?? "김포국악원 활동 사진"}
                        width={200}
                        height={130}
                        className="w-full object-cover"
                        style={{ height: "130px" }}
                        loading="lazy"
                      />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="rounded-xl bg-gray-100" style={{ height: "130px" }} />
                  ))}
                </div>
              )}
            </div>

            {/* Widget C: 최신 국악원 소식 */}
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold text-[#111]">최신 국악원 소식</h2>
                <Link href="/blog" className="text-sm text-[#8a6f3e] hover:underline">
                  더 보기 →
                </Link>
              </div>
              {posts && posts.length > 0 ? (
                <ul className="divide-y divide-gray-100">
                  {posts.map((post) => {
                    const href =
                      post.external_url ||
                      `/blog/${getBlogPostPath(post.slug ?? null, post.id)}`;
                    const isExternal = !!post.external_url;
                    const date = post.published_at
                      ? formatDateKST(post.published_at, "short")
                      : "";
                    const inner = (
                      <div className="flex items-baseline justify-between gap-3 py-2.5">
                        <span className="text-base font-medium text-[#111] leading-relaxed line-clamp-1 group-hover:text-[#8a6f3e] transition-colors min-w-0">
                          {post.title}
                        </span>
                        <span className="text-sm text-gray-400 shrink-0">{date}</span>
                      </div>
                    );
                    return (
                      <li key={post.id}>
                        {isExternal ? (
                          <a href={href} target="_blank" rel="noopener noreferrer" className="group block">
                            {inner}
                          </a>
                        ) : (
                          <Link href={href} className="group block">
                            {inner}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-gray-400 py-1">등록된 소식이 없습니다.</p>
              )}
            </div>

            {/* Widget D: 오시는 길 및 전화문의 */}
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-4">
              <h2 className="text-xl font-bold text-[#111] mb-3">오시는 길 및 문의</h2>

              <a
                href={NAVER_MAP_HREF}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-xl overflow-hidden mb-3 hover:opacity-90 transition-opacity"
              >
                <Image
                  src="/gimpogugak_map.png"
                  alt="김포국악원 약도"
                  width={340}
                  height={110}
                  className="w-full object-cover"
                  style={{ maxHeight: "110px" }}
                  loading="lazy"
                />
              </a>

              <p className="text-base text-gray-500 leading-relaxed mb-3">
                경기도 김포시 모담공원로 170-14<br />
                <span className="text-gray-400">평일·토 10:00~19:00 / 일요일 휴무</span>
              </p>

              <PhoneCallLink
                href="tel:01059481843"
                className="flex items-center justify-center gap-2 w-full bg-[#8a6f3e] hover:bg-[#7a5f2e] text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
              >
                📞 전화 문의하기
              </PhoneCallLink>
            </div>

          </aside>
        </div>


      </div>

      {/* ============================================================
          뱃지 · 연락처 섹션 — 1단, max-w-2xl 원래 너비 그대로
          ============================================================ */}
      <div className="max-w-2xl mx-auto px-6 pb-16">
        <Suspense fallback={null}><HomeBadges /></Suspense>
        <Suspense fallback={null}><HomeConnect /></Suspense>
      </div>
    </>
  );
}
