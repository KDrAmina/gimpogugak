import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

// 👇 외부 이미지 주소
const HERO_IMAGE =
  "/main_image.webp";

export const metadata: Metadata = {
  title: "김포국악원 | 한국의 전통, 대한의 소리",
  description:
    "황해도무형문화재 제3호 놀량사거리 이수자 원장과 성악 전공 부원장이 함께하는 김포 국악 교육원. 민요, 장구, 진로체험, 김포신문 칼럼 연재.",
  openGraph: {
    title: "김포국악원 | 한국의 전통, 대한의 소리",
    description: "경기 김포시 국악 교육. 무형문화재 이수자 직강, 교육부 진로체험 인증기관.",
    type: "website",
  },
};

export default function HomePage() {
  return (
    <article className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#111] tracking-tight">
        한국의 전통, 대한의 소리
      </h1>

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
          sizes="(max-width: 768px) 100vw, 800px"
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

      {/* 하단 인증 배지 섹션 */}
      <section className="mt-16 flex flex-col items-center border-t border-gray-100 pt-10" aria-label="인증 및 파트너 로고">
        <p className="text-xs text-gray-500 mb-6 uppercase tracking-widest">Authorized By</p>
        <div className="flex flex-wrap items-center justify-center gap-8 grayscale opacity-80 hover:grayscale-0 hover:opacity-100 transition-all duration-300">
          <Image
            src="/badge-10th.png"
            alt="김포국악원 10주년 (SINCE 2015)"
            width={140}
            height={52}
            className="h-8 w-auto object-contain sm:h-10"
          />
          <Image
            src="/badge-foundation.png"
            alt="김포문화재단"
            width={100}
            height={20}
            className="h-5 w-auto object-contain sm:h-6"
          />
          <Image
            src="/badge-education.png"
            alt="교육기부 진로체험 인증기관 (교육부)"
            width={150}
            height={100}
            className="h-10 w-auto object-contain sm:h-12"
          />
        </div>
      </section>

      <section aria-label="Connect" className="mt-16 pt-10 border-t border-[#111]/10">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">Connect</p>
        <ul className="flex flex-col gap-3">
          <li>
            <a
              href="https://instagram.com/seodo_music"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-500 hover:text-black transition-colors inline-flex items-center gap-1 group"
            >
              Instagram (@seodo_music)
              <span className="text-[10px] opacity-70 group-hover:translate-x-0.5 transition-transform" aria-hidden>↗</span>
            </a>
          </li>
          <li>
            <a
              href="https://blog.naver.com/gimpogugak"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-500 hover:text-black transition-colors inline-flex items-center gap-1 group"
            >
              Naver Blog
              <span className="text-[10px] opacity-70 group-hover:translate-x-0.5 transition-transform" aria-hidden>↗</span>
            </a>
          </li>
        </ul>
      </section>
    </article>
  );
}