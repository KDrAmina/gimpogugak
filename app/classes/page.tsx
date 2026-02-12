import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "수업 및 체험 | 김포국악원 (Classes)",
  description:
    "서도/경기민요 정규 수업 및 대취타, 국악기 만들기 체험 학습. 네이버 예약 가능.",
};

export default function ClassesPage() {
  return (
    <section className="mx-auto max-w-2xl px-6 py-12 pb-24">
      {/* 헤더 */}
      <div className="mb-16">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-[#111] mb-4">
          수업 안내
        </h1>
        <p className="text-[#666] leading-relaxed">
          전문가를 위한 심화 과정부터 아이들의 역사 의식을 높이는 체험 학습까지.
          <br />
          무형문화재 이수자 원장님이 직접 설계한 체계적인 국악 교육을 만나보세요.
        </p>
      </div>

      {/* 1. 정규 수업 (민요) */}
      <div className="mb-20">
        <h2 className="text-xl font-bold text-[#111] mb-6 border-b border-[#111]/10 pb-2">
          1. 민요 정규반
        </h2>
        <p className="text-[#666] text-sm leading-relaxed mb-6">
          경기소리와 서도소리의 깊이를 배우는 정규 과정입니다.
        </p>

        <div className="border-t border-[#111]/10">
          <ClassRow
            category="전문인 과정"
            target="전공 / 입시 / 지도자"
            time="개인지도 (시간 조율)"
            price="200,000원"
            unit="/ 1시간"
          />
          <ClassRow
            category="성인 단체반"
            target="일반인 / 취미"
            time="수요일 15:00, 18:00"
            price="100,000원"
            unit="/ 월 (주 1회)"
          />
          <ClassRow
            category="어린이 단체반"
            target="초등 / 청소년"
            time="화요일 17:00, 18:00"
            price="100,000원"
            unit="/ 월 (주 1회)"
          />
        </div>
      </div>

      {/* 2. 국악 문화 체험 (2종 분리) */}
      <div className="mb-20">
        <div className="flex flex-wrap items-end justify-between gap-2 mb-6 border-b border-[#111]/10 pb-2">
          <h2 className="text-xl font-bold text-[#111]">
            2. 국악 문화 체험
          </h2>
          <span className="text-sm text-[#666] font-medium tabular-nums">
            1시간 / 20,000원 (1인)
          </span>
        </div>

        <div className="grid gap-6 md:grid-cols-2 mb-8">
          {/* 체험 A: 역사와 소리 & 만들기 */}
          <div className="rounded-xl p-6 border border-[#111]/10 bg-[#111]/[0.02] hover:border-[#111]/20 transition-colors">
            <span className="inline-block px-2 py-1 mb-4 text-xs font-bold text-[#111] bg-[#111]/10 rounded-md">
              인기 프로그램
            </span>
            <h3 className="text-lg font-bold text-[#111] mb-2">
              역사와 소리 & 장구 만들기
            </h3>
            <p className="text-xs text-[#999] mb-3 font-medium">대상: 전연령 (유치원 ~ 성인)</p>
            <p className="text-sm text-[#666] mb-4 leading-relaxed">
              송리결 원장의 역사 특강과 밀양아리랑 배우기, 장구(태평소) 만들기로 우리 소리를 체험합니다.
            </p>
            <ul className="space-y-2">
              <CheckItem text="송리결 원장 역사 특강" />
              <CheckItem text="밀양아리랑 배우기" />
              <CheckItem text="장구 만들기 (전연령)" />
              <CheckItem text="태평소 만들기 (초등/미취학 대체)" />
            </ul>
          </div>

          {/* 체험 B: 대취타 체험 */}
          <div className="rounded-xl p-6 border border-[#111]/10 bg-[#111]/[0.02] hover:border-[#111]/20 transition-colors">
            <span className="inline-block px-2 py-1 mb-4 text-xs font-bold text-[#111] bg-[#111]/10 rounded-md">
              이색 체험
            </span>
            <h3 className="text-lg font-bold text-[#111] mb-2">
              대취타 체험
            </h3>
            <p className="text-xs text-[#999] mb-3 font-medium">대상: 3세 ~ 성인</p>
            <p className="text-sm text-[#666] mb-4 leading-relaxed">
              왕의 행차에 쓰이던 대취타 악기(나발, 나각 등)를 직접 만져보고 연주해보는 특별 체험입니다.
            </p>
            <ul className="space-y-2">
              <CheckItem text="실제 대취타 악기 터치 & 연주" />
              <CheckItem text="나발, 나각 등 희귀 악기 체험" />
              <CheckItem text="3세부터 성인까지 참여 가능" />
            </ul>
          </div>
        </div>

        {/* 예약 CTA */}
        <div className="flex flex-col sm:flex-row gap-4">
          <a
            href="https://booking.naver.com/booking/6/bizes/937607"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-[#03C75A] text-white font-bold rounded-lg hover:bg-[#02b150] transition-colors shadow-sm"
          >
            <span aria-hidden>📅</span> 네이버 예약하기
          </a>
          <a
            href="http://pf.kakao.com/_xfKTHxj/chat"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-[#FAE100] text-[#371D1E] font-bold rounded-lg hover:bg-[#ebd300] transition-colors shadow-sm"
          >
            <span aria-hidden>💬</span> 카카오톡 상담하기
          </a>
        </div>
        <p className="mt-3 text-center text-xs text-[#999]">
          * 단체 예약은 카카오톡 채널로 문의주시면 빠르게 답변 드립니다.
        </p>
      </div>
    </section>
  );
}

function ClassRow({
  category,
  target,
  time,
  price,
  unit,
}: {
  category: string;
  target: string;
  time: string;
  price: string;
  unit: string;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[140px_1fr_auto] gap-2 md:gap-4 py-4 border-b border-[#111]/5 hover:bg-[#111]/[0.02] transition-colors leading-relaxed">
      <div>
        <h3 className="font-semibold text-[#111]">{category}</h3>
        <span className="text-xs text-[#666]">{target}</span>
      </div>
      <div className="flex items-center text-sm text-[#666]">
        <span className="md:hidden font-medium mr-2 text-[#999]">시간:</span>
        {time}
      </div>
      <div className="text-right">
        <span className="block font-bold text-[#111] tabular-nums">{price}</span>
        <span className="text-xs text-[#999]">{unit}</span>
      </div>
    </div>
  );
}

function CheckItem({ text }: { text: string }) {
  return (
    <li className="flex items-start text-sm text-[#666]">
      <svg
        className="w-4 h-4 text-[#999] mr-2 mt-0.5 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 13l4 4L19 7"
        />
      </svg>
      {text}
    </li>
  );
}
