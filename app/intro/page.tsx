import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "소개 | 김포국악원 (Gimpo Gugak Center)",
  description:
    "김포국악원 원장, 부원장 소개 및 언론 보도. 황해도무형문화재 이수자와 성악 전공자가 함께하는 국악 교육원.",
};

const CARDS = [
  {
    href: "/intro/director",
    main: "송리결 원장 소개",
    sub: "황해도무형문화재 제3호 놀량사거리 이수자",
    image: "/Song-Ri-Gyeol-profile.jpg",
    imageAlt: "송리결 원장",
  },
  {
    href: "/intro/vice-director",
    main: "박준열 부원장 소개",
    sub: "한양대 성악 전공 / 김포신문 칼럼 연재",
    image: "/Park-Jun-Yeol-profile.png",
    imageAlt: "박준열 부원장",
  },
  {
    href: "https://www.igimpo.com",
    main: "언론 보도",
    sub: "김포신문 기사 및 활동 내역",
    image: null,
    imageAlt: "",
    external: true,
  },
];

function NewsIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-8 h-8 text-[#666]"
    >
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
      <path d="M18 14h-8" />
      <path d="M15 18h-5" />
      <path d="M10 6h8v4h-8V6Z" />
    </svg>
  );
}

const cardBase =
  "flex flex-row items-center gap-4 sm:gap-6 p-5 sm:p-6 rounded-xl border border-[#111111]/10 bg-white hover:border-[#111111]/20 hover:shadow-md hover:scale-[1.02] transition-all";

export default function IntroPage() {
  return (
    <section className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#111] mb-2">
        소개
      </h1>
      <p className="text-[#666] mb-10">
        김포국악원을 이끄는 원장과 부원장, 그리고 언론 보도를 확인해 보세요.
      </p>

      <div className="grid gap-4 sm:gap-6">
        {CARDS.map((card) => {
          const content = (
            <>
              <div className="shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                {card.image ? (
                  <Image
                    src={card.image}
                    alt={card.imageAlt}
                    width={80}
                    height={80}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <NewsIcon />
                )}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <h2 className="font-serif text-lg sm:text-xl font-bold text-[#111] tracking-tight">
                  {card.main}
                </h2>
                <p className="text-sm text-[#666] mt-0.5 leading-relaxed">
                  {card.sub}
                </p>
              </div>
            </>
          );

          return card.external ? (
            <a key={card.href} href={card.href} target="_blank" rel="noopener noreferrer" className={cardBase}>
              {content}
            </a>
          ) : (
            <Link key={card.href} href={card.href} className={cardBase}>
              {content}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
