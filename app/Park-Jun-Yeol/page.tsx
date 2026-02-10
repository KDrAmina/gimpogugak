import type { Metadata } from "next";
import { ProfilePhoto } from "./ProfilePhoto";

const COLUMN_URL = "https://www.igimpo.com/news/articleView.html?idxno=90054";

export const metadata: Metadata = {
  title: "박준열 (Jun Yeol Park) | 김포국악원 부원장",
  description:
    "김포국악원 박준열 부원장. 한양대 성악과 졸업, 황해도무형문화재 제3호 놀량사거리 전수자. 김포신문 '두 개의 목소리가 만나는 음악 시간' 칼럼 연재.",
  openGraph: {
    title: "박준열 (Jun Yeol Park) | 김포국악원 부원장",
    description: "성악과 민요를 넘나드는 음악 교육자, 박준열입니다.",
  },
  alternates: {
    canonical: "https://gimpo-gugak.kr/Park-Jun-Yeol",
  },
};

export default function ProfilePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: "박준열",
    alternateName: ["Jun Yeol Park", "朴駿烈"],
    jobTitle: "김포국악원 부원장",
    birthDate: "1985-03-03",
    email: "amina7@naver.com",
    telephone: "010-2239-1840",
    affiliation: {
      "@type": "EducationalOrganization",
      name: "김포국악원",
    },
    alumniOf: {
      "@type": "CollegeOrUniversity",
      name: "한양대학교 성악과",
    },
    knowsAbout: ["성악", "서도민요", "놀량사거리", "오페라"],
    url: "https://gimpo-gugak.kr/Park-Jun-Yeol",
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": "https://gimpo-gugak.kr/Park-Jun-Yeol",
    },
    sameAs: [COLUMN_URL],
  };

  return (
    <section className="mx-auto max-w-2xl px-6 py-12 pb-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mb-16 flex flex-col items-center gap-4">
        <ProfilePhoto />
        <div className="min-w-0 text-center w-full">
          <h1 className="font-serif text-4xl font-bold tracking-tight text-[#111] mb-2">
            박준열{" "}
            <span className="text-lg font-normal text-gray-400 ml-2 tracking-normal">
              Jun Yeol Park
            </span>
          </h1>
          <p className="text-lg text-gray-900 font-medium">
            김포국악원 부원장 / 황해도무형문화재 제3호 놀량사거리 전수자
          </p>
          <p className="mt-2 text-sm text-gray-500">
            1985년 03월 03일 · 010-2239-1840 · amina7@naver.com
          </p>
        </div>
      </div>

      <p className="mt-6 mb-8 text-gray-600 leading-loose">
        한양대학교 성악과를 졸업한 뒤 오페라·합창 현장을 거쳐, 황해도무형문화재 제3호 놀량사거리 전수자 및 공연 기획자로 활동하고 있습니다.
        <br />
        김포신문에 &apos;
        <a
          href={COLUMN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-700 underline hover:no-underline"
        >
          두 개의 목소리가 만나는 음악 시간
        </a>
        &apos; 칼럼을 연재하며, 성악과 민요를 자유롭게 넘나드는 교육을 이어가고 있습니다.
      </p>

      <div className="mb-14">
        <h2 className="text-lg font-bold text-gray-900 mb-6 border-b border-gray-100 pb-2">
          학력
        </h2>
        <div className="w-full">
          <Row year="2006. ~ 2014." content="한양대학교 성악과" detail="졸업" />
        </div>
      </div>

      <div className="mb-14">
        <h2 className="text-lg font-bold text-gray-900 mb-6 border-b border-gray-100 pb-2">
          경력
        </h2>
        <div className="w-full">
          <Row year="2025.12 ~" content="김포오페라단 단장" highlight />
          <Row year="2025.12 ~" content="기획집단 하마 대표" />
          <Row year="2025.05 ~" content="삼척시립합창단 단원" />
          <Row year="2023.03 ~" content="김포국악원 부원장" highlight />
          <Row year="2018 ~ 2022" content="단아한 웨딩 대표" />
          <Row year="2014 ~ 2018" content="메트오페라 합창단 단원" />
          <Row year="2010 ~ 2012" content="팝페라 그란데빈체로 그룹 솔리스트" />
          <Row year="2007 ~ 2021" content="오라토리오 칸토라이 합창단 단원" />
        </div>
      </div>

      <div className="mb-14">
        <h2 className="text-lg font-bold text-gray-900 mb-6 border-b border-gray-100 pb-2">
          자격증
        </h2>
        <div className="w-full">
          <Row year="2025.10.02" content="황해도무형문화재 제3호 놀량사거리 전수자 자격증" detail="황해도지사" highlight />
          <Row year="2022.04.18" content="혁신창업스쿨 교육사 자격증" detail="창업진흥원장" />
        </div>
      </div>

      <div className="mb-14">
        <h2 className="text-lg font-bold text-gray-900 mb-6 border-b border-gray-100 pb-2">
          연주 경력
        </h2>
        <div className="w-full">
          <Row year="2025" content="강(江)의 소리, 꽃보자기에 물들다" detail="김포 한옥마을 천현정 광장" />
          <Row year="2024" content="서도소리와 향연" detail="통진두레문화센터" />
          <Row year="2023" content="김포 옛 잡가를 만나다" detail="김포아트홀" />
          <Row year="2015 ~ 2022" content="국립오페라단 갈라콘서트 (카르멘, 라트라비아타 등)" detail="서울 예술의전당" />
          <Row year="2014" content="카르멘" detail="세종문화회관" />
          <Row year="2008" content="루치아 디 람메르무어" detail="대전 예술의전당" />
          <Row year="2006" content="파우스트" detail="서울 예술의전당" />
        </div>
      </div>
    </section>
  );
}

function Row({
  year,
  content,
  detail,
  highlight = false,
}: {
  year: string;
  content: string;
  detail?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-[100px_1fr_auto] gap-y-1 md:gap-y-0 gap-x-0 md:gap-x-4 py-4 items-baseline md:items-center leading-relaxed"
      role="row"
    >
      <span
        className={`font-mono text-sm tabular-nums whitespace-nowrap ${highlight ? "text-gray-900" : "text-gray-400"}`}
      >
        {year}
      </span>
      <div className="min-w-0 flex flex-col gap-0.5 leading-relaxed">
        <span
          className={`${highlight ? "text-gray-900 font-semibold" : "text-gray-900 font-medium"}`}
        >
          {content}
        </span>
        {detail != null && (
          <span className="text-sm text-gray-500 md:hidden leading-relaxed">
            {detail}
          </span>
        )}
      </div>
      {detail != null ? (
        <span className="hidden md:block text-sm text-gray-500 text-right shrink-0">
          {detail}
        </span>
      ) : (
        <span className="hidden md:block" aria-hidden />
      )}
    </div>
  );
}
