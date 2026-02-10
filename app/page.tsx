import Image from "next/image";
import Link from "next/link";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1535189043414-47a3c49a0bed?q=80&w=1000&auto=format&fit=crop";

export default function HomePage() {
  return (
    <article className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#111] tracking-tight">
        김포국악원
      </h1>

      {/* 🚀 [최적화 수정] 
         1. shadow-md (그림자) -> 제거 (렌더링 부하)
         2. grayscale (흑백) -> 제거 (필터 연산 부하)
         3. transition (애니메이션) -> 제거 (지연 원인)
         오직 'rounded-lg'와 'overflow-hidden'만 남겨서 가볍게 만듭니다.
      */}
      <figure className="mt-8 rounded-lg overflow-hidden"> 
        <Image
          src={HERO_IMAGE}
          alt="한옥 처마와 자연, 김포국악원"
          priority={true} 
          width={1000}
          height={563}
          className="w-full aspect-video object-cover"
          /* 여백(48px) 제외하고 정확한 사이즈 요청 */
          sizes="(max-width: 672px) calc(100vw - 48px), 672px"
        />
      </figure>

      <div className="mt-10 space-y-6 font-sans text-[#111] leading-relaxed">
        <p>
          전통의 울림, 그 깊이를 배우다.
        </p>
        <p>
          김포국악원은{" "}
          <Link href="/Song-Ri-Gyel" className="text-[#111] underline hover:no-underline">
            황해도무형문화재 제3호 놀량사거리 이수자 원장님
          </Link>
          {"과 "}성악 전공 부원장님이 이끄는 김포 대표 국악 교육 공간입니다.
          민요, 장구, 단체반, 취미반 수업과 공연·섭외 문의를 받고 있습니다.
        </p>
        <p>
          전통을 제대로 배우고 싶은 분들께 맞춤 수업과 따뜻한 지도를 제공합니다.
        </p>
      </div>

      <section aria-label="Connect" className="mt-16 pt-10 border-t border-[#111]/10">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">Connect</p>
        <ul className="flex flex-col gap-3">
          <li>
            <a
              href="https://instagram.com/seodo_music"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-500 hover:text-black transition-colors inline-flex items-center gap-1"
            >
              Instagram (@seodo_music)
              <span className="text-[10px] opacity-70" aria-hidden>↗</span>
            </a>
          </li>
          <li>
            <a
              href="https://blog.naver.com/gimpogugak"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-500 hover:text-black transition-colors inline-flex items-center gap-1"
            >
              Naver Blog
              <span className="text-[10px] opacity-70" aria-hidden>↗</span>
            </a>
          </li>
        </ul>
      </section>
    </article>
  );
}