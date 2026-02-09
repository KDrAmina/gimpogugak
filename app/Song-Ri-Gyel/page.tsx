import type { Metadata } from "next";
import { ProfilePhoto } from "./ProfilePhoto";

export const metadata: Metadata = {
  title: "송리결 (Song Ri-Gyel) | 황해도무형문화재 제3호 이수자",
  description:
    "김포국악원 송리결 원장 프로필. 황해도무형문화재 제3호 놀량사거리 이수자, 국가무형유산 서도/경기민요 전수자.",
  openGraph: {
    title: "송리결 (Song Ri-Gyel) | 김포국악원 원장",
    description: "전통의 깊이를 전하는 소리꾼, 송리결입니다.",
  },
};

export default function ProfilePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: "송리결",
    alternateName: "Song Ri-Gyel",
    jobTitle: "국악인 (Korean Traditional Musician)",
    affiliation: {
      "@type": "EducationalOrganization",
      name: "김포국악원",
    },
    alumniOf: {
      "@type": "CollegeOrUniversity",
      name: "백석예술대학교",
    },
    knowsAbout: ["서도민요", "경기민요", "장구", "놀량사거리"],
    sameAs: [
      "https://instagram.com/seodo_music",
      "https://blog.naver.com/seodomusic",
    ],
  };

  return (
    <section className="mx-auto max-w-2xl px-6 py-12 pb-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* 프로필 사진 + 헤더 (사진 이름 바로 위, 중앙 정렬) */}
      <div className="mb-16 flex flex-col items-center gap-4">
        <ProfilePhoto />
        <div className="min-w-0 text-center w-full">
          <h1 className="font-serif text-4xl font-bold tracking-tight text-[#111] mb-2">
            송리결{" "}
            <span className="text-lg font-normal text-gray-400 ml-2 tracking-normal">
              Song Ri-Gyel
            </span>
          </h1>
          <p className="text-lg text-gray-900 font-medium">
            김포국악원 원장 / 황해도무형문화재 제3호 놀량사거리 이수자
          </p>
          <p className="mt-2 flex flex-wrap items-center justify-center gap-x-2 text-sm text-gray-500">
            <a
              href="https://instagram.com/seodo_music"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-900 transition-colors inline-flex items-center gap-0.5"
            >
              Instagram <span aria-hidden>↗</span>
            </a>
            <span className="text-gray-300" aria-hidden>·</span>
            <a
              href="https://blog.naver.com/gimpogugak"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-900 transition-colors inline-flex items-center gap-0.5"
            >
              Blog <span aria-hidden>↗</span>
            </a>
          </p>
        </div>
      </div>
      <p className="mt-6 mb-8 text-gray-600 leading-loose">
        10년 이상 현장에서 우리 소리를 가르쳐온 교육자이자, 끊임없이 무대에 오르는 소리꾼입니다.
        <br />
        전통을 올바르게 계승하며, 누구나 쉽게 국악을 즐길 수 있도록 지도합니다.
      </p>

      <div className="mb-14">
        <h2 className="text-lg font-bold text-gray-900 mb-6 border-b border-gray-100 pb-2">
          자격 및 이수
        </h2>
        <div className="w-full">
          <Row year="2024" content="국가문화유산 경기민요 전수자" detail="국가무형유산" />
          <Row year="2024" content="국가문화유산 서도민요 전수자" detail="국가무형유산" />
          <Row year="2024" content="문화예술교육사 2급" detail="한국문화예술교육진흥원" />
          <Row year="2018" content="음악 실기교사 교원자격증" detail="교육부 장관" />
          <Row year="2017" content="황해도무형문화재 제3호 놀량사거리 이수자" detail="황해도지사 인정" highlight />
          <Row year="2017" content="아동국악교육지도사 1급" detail="한국아동국악교육협회" />
          <Row year="2015" content="효 국악 1급 지도사" detail="성산효대학원대학교" />
        </div>
      </div>

      <div className="mb-14">
        <h2 className="text-lg font-bold text-gray-900 mb-6 border-b border-gray-100 pb-2">
          수상 내역
        </h2>
        <div className="w-full">
          <Row year="2024" content="한국국악협회 김주영 국회의원상" />
          <Row year="2024" content="전국서도대회 지도자상" detail="서도소리보존회" />
          <Row year="2021" content="전국서도대회 문화재청장상" highlight />
          <Row year="2019" content="한국복음성가협회 경연대회 본선 인기상" />
          <Row year="2018" content="서울 아리랑 예술제 경기민요 대상" detail="국회" highlight />
          <Row year="2018" content="서울 아리랑 예술제 우수지도자상" detail="국회" />
        </div>
      </div>

      <div className="mb-14">
        <h2 className="text-lg font-bold text-gray-900 mb-6 border-b border-gray-100 pb-2">
          주요 경력
        </h2>
        <div className="w-full">
          <Row year="2023 -" content="김포국악원 원장" highlight />
          <Row year="2021 -" content="한국국악협회 이사" />
          <Row year="2020" content="사) 서도소리 진흥회 예술단 단원" />
          <Row year="2019" content="서도소리보존회 이사" />
          <Row year="2018" content="사) 서울소리보존회 상임단원" />
          <Row year="2018" content="강동 구립예술단 민속예술단원" />
          <Row year="2017 - 2023" content="복지관 및 문화센터 경기민요 전임강사" detail="수서, 목동, 구로, 중림, 양천 등 다수 출강" />
        </div>
      </div>

      <div className="mb-14">
        <h2 className="text-lg font-bold text-gray-900 mb-6 border-b border-gray-100 pb-2">
          학력
        </h2>
        <div className="w-full">
          <Row year="2018" content="백석예술대학교 음악학부 국악과 졸업" detail="서도민요 전공" />
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
