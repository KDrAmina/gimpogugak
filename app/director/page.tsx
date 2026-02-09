import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "원장 소개 | 김포국악원 (Gimpo Gugak Center)",
  description:
    "황해도무형문화재 제3호 놀량사거리 이수자, 김포국악원 원장의 주요 경력 및 수상 내역입니다.",
};

export default function DirectorPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: "송리결",
    jobTitle: "황해도무형문화재 제3호 놀량사거리 이수자",
    affiliation: {
      "@type": "EducationalOrganization",
      name: "김포국악원",
    },
    alumniOf: {
      "@type": "CollegeOrUniversity",
      name: "백석예술대학교 음악학부 국악과 (서도민요 전공)",
    },
    credential: [
      "황해도무형문화재 제3호 놀량사거리 이수자 (2017)",
      "국가문화유산 서도민요 전수자 (2024)",
      "국가문화유산 경기민요 전수자 (2024)",
      "문화예술교육사 2급 (2024)",
    ],
    award: [
      "전국서도대회 문화재청장상 (2021)",
      "서울 아리랑 예술제 대상 (2018)",
      "한국국악협회 국회의원상 (2024)",
    ],
  };

  return (
    <section className="mx-auto max-w-2xl px-6 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mb-12">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-[#111] mb-2">
          송리결
        </h1>
        <p className="text-lg text-[#666] font-medium">
          황해도무형문화재 제3호 놀량사거리 이수자
        </p>
        <p className="mt-4 text-[#666] leading-relaxed">
          백석예술대학교 국악과를 졸업하고 10년 이상 현장에서 민요를 가르쳐왔습니다.
          <br />
          전통의 깊이를 잃지 않으면서도, 누구나 쉽고 즐겁게 우리 소리를 즐길 수 있도록 지도합니다.
        </p>
      </div>

      <div className="mb-12">
        <h2 className="text-xl font-semibold text-[#111] mb-6 border-b border-[#111]/10 pb-2">
          자격 및 이수
        </h2>
        <table className="w-full text-left border-collapse">
          <tbody className="text-[#666]">
            <Row year="2024" content="국가문화유산 경기민요 전수자 자격증" detail="국가무형유산 경기민요" />
            <Row year="2024" content="국가문화유산 서도민요 전수자 자격증" detail="국가무형유산 서도민요" />
            <Row year="2024" content="문화예술교육사 2급" detail="한국문화예술교육진흥원" />
            <Row year="2018" content="중등학교 정교사(2급) 실기교사" detail="교육부 장관" />
            <Row year="2017" content="황해도무형문화재 제3호 놀량사거리 이수자" detail="황해도지사 인정" highlight />
            <Row year="2017" content="아동국악교육지도사 1급" detail="한국아동국악교육협회" />
            <Row year="2015" content="효 국악 1급 지도사" detail="성산효대학원대학교" />
          </tbody>
        </table>
      </div>

      <div className="mb-12">
        <h2 className="text-xl font-semibold text-[#111] mb-6 border-b border-[#111]/10 pb-2">
          수상 내역
        </h2>
        <table className="w-full text-left border-collapse">
          <tbody className="text-[#666]">
            <Row year="2024" content="한국국악협회 국회의원상 수상" detail="김주영 의원상" />
            <Row year="2024" content="전국서도대회 지도자상" detail="서도소리보존회" />
            <Row year="2021" content="전국서도대회 문화재청장상" detail="최우수상" highlight />
            <Row year="2019" content="한국복음성가협회 경연대회 본선 인기상" />
            <Row year="2018" content="서울 아리랑 예술제 경기민요 대상" detail="국회" highlight />
            <Row year="2018" content="서울 아리랑 예술제 우수지도자상" detail="국회" />
          </tbody>
        </table>
      </div>

      <div className="mb-12">
        <h2 className="text-xl font-semibold text-[#111] mb-6 border-b border-[#111]/10 pb-2">
          주요 경력
        </h2>
        <table className="w-full text-left border-collapse">
          <tbody className="text-[#666]">
            <Row year="2023 -" content="김포국악원 원장" highlight />
            <Row year="2021 -" content="한국국악협회 이사" />
            <Row year="2020" content="사) 서도소리 진흥회 예술단 단원 / 옹진농요단" />
            <Row year="2019" content="서도소리보존회 이사" />
            <Row year="2018" content="사) 서울소리보존회 상임단원 (경서도 민요)" />
            <Row year="2018" content="강동 구립예술단 민속예술단원" />
            <Row year="2017 - 2024" content="복지관 및 문화센터 경기민요 전임강사" detail="수서, 목동, 구로, 중림, 양천 등 다수 출강" />
          </tbody>
        </table>
      </div>

      <div className="mb-12">
        <h2 className="text-xl font-semibold text-[#111] mb-6 border-b border-[#111]/10 pb-2">
          공연 활동
        </h2>
        <table className="w-full text-left border-collapse">
          <tbody className="text-[#666]">
            <Row year="2025" content="강(江)의 소리, 꽃보자기에 물들다" detail="김포 한옥마을" />
            <Row year="2024" content="서도소리와 향연" detail="통진두레문화센터" />
            <Row year="2023" content="김포 옛 잡가를 만나다" detail="김포아트홀" />
            <Row year="2022" content="풍류 '아리랑 명창전'" />
            <Row year="2021" content="김포아트빌리지 '김포예술제'" />
            <Row year="2019" content="3.1운동 100주년 기념공연 '혈죽가'" detail="은평문화예술회관" />
          </tbody>
        </table>
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
    <tr className="border-b border-[#111]/5 text-sm sm:text-base hover:bg-[#111]/[0.02] transition-colors">
      <td
        className={`py-3 pr-4 align-top w-24 sm:w-32 font-medium ${highlight ? "text-[#111]" : "text-[#999]"}`}
      >
        {year}
      </td>
      <td className="py-3 align-top">
        <span className={`block ${highlight ? "text-[#111] font-semibold" : "text-[#444]"}`}>
          {content}
        </span>
        {detail != null && (
          <span className="block text-xs sm:text-sm text-[#999] mt-0.5">{detail}</span>
        )}
      </td>
    </tr>
  );
}
