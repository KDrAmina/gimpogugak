import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "문의 및 오시는 길 | 김포국악원 (Contact)",
  description:
    "김포국악원 위치: 경기도 김포시 모담공원로 170-14. 상담 문의: 010-5948-1843.",
};

export default function ContactPage() {
  const addressQuery = "경기도 김포시 모담공원로 170-14";
  const encodedAddress = encodeURIComponent(addressQuery);

  return (
    <section className="mx-auto max-w-2xl px-6 py-12 pb-24">
      {/* 헤더 */}
      <div className="mb-16">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-[#111] mb-4">
          문의 및 오시는 길
        </h1>
        <p className="text-[#666] leading-relaxed">
          국악의 즐거움이 시작되는 곳.
          <br />
          방문 상담은 수업 중일 수 있으니 미리 예약 부탁드립니다.
        </p>
      </div>

      {/* 1. 지도 (Google Maps Embed) */}
      <div className="mb-12">
        <div className="relative w-full h-[300px] sm:h-[400px] bg-[#111]/5 rounded-xl overflow-hidden border border-[#111]/10">
          <iframe
            src={`https://maps.google.com/maps?q=${encodedAddress}&t=&z=17&ie=UTF8&iwloc=&output=embed&hl=ko`}
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="absolute inset-0"
            title="김포국악원 지도"
          />
        </div>

        {/* 네이버/카카오 지도 버튼 */}
        <div className="flex gap-3 mt-4">
          <a
            href={`https://map.naver.com/v5/search/${encodedAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-3 text-center text-sm font-bold text-white bg-[#03C75A] rounded-lg hover:bg-[#02b150] transition-colors shadow-sm"
          >
            네이버 지도로 보기
          </a>
          <a
            href={`https://map.kakao.com/link/search/${encodedAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-3 text-center text-sm font-bold text-[#371D1E] bg-[#FAE100] rounded-lg hover:bg-[#ebd300] transition-colors shadow-sm"
          >
            카카오맵으로 보기
          </a>
        </div>
      </div>

      {/* 2. 정보 그리드 */}
      <div className="grid gap-8 sm:grid-cols-2">
        <div className="space-y-8">
          <InfoItem label="Address">
            경기도 김포시 모담공원로 170-14
            <br />
            김포국악원
          </InfoItem>

          <InfoItem label="Contact">
            <a
              href="tel:01059481843"
              className="text-[#111] hover:underline font-bold text-lg block mb-1"
            >
              010-5948-1843
            </a>
            <a
              href="mailto:gimpogugak@gmail.com"
              className="text-[#666] hover:text-[#111] text-sm"
            >
              gimpogugak@gmail.com
            </a>
          </InfoItem>
        </div>

        <div className="space-y-8">
          <InfoItem label="Operating Hours">
            <div className="space-y-1 text-[#666] text-sm leading-relaxed">
              <p>
                <span className="font-semibold text-[#111]">평일, 토요일:</span> 10:00 ~ 19:00
              </p>
              <p>
                <span className="font-semibold text-[#111]">일요일:</span> 휴무 (공연 시 변동)
              </p>
            </div>
          </InfoItem>

          <InfoItem label="Bank Account">
            <p className="text-[#666] mb-1 text-sm">수강료 입금 계좌</p>
            <p className="font-medium text-[#111] leading-relaxed">
              신한은행 110-603-003236 (김포국악원)
            </p>
          </InfoItem>
        </div>
      </div>
    </section>
  );
}

function InfoItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-xs font-bold text-[#999] uppercase tracking-wider mb-3 border-l-2 border-[#111]/20 pl-3">
        {label}
      </h3>
      <div className="text-sm leading-relaxed text-[#111] pl-3.5 [&_a]:text-[#111]">
        {children}
      </div>
    </div>
  );
}
