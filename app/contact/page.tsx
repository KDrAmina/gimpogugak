import type { Metadata } from "next";
import Image from "next/image";
import ContactMapButtons from "@/components/ContactMapButtons";

export const metadata: Metadata = {
  title: "오시는 길·전화문의 | 김포국악원",
  description:
    "경기도 김포시 모담공원로 170-14 (장기동·사우동·고촌읍 인근). 국악·민요·성악 수업 상담 및 체험 예약: 010-5948-1843.",
};

export default function ContactPage() {
  const addressQuery = "경기도 김포시 모담공원로 170-14";
  const encodedAddress = encodeURIComponent(addressQuery);
  
  // 링크 모음 (수정됨)
  const naverMapLink = `https://map.naver.com/v5/search/${encodedAddress}`;
  // 👇 여기가 수정되었습니다 (구글 공식 검색 링크)
  const googleMapLink = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
  const kakaoMapLink = `https://map.kakao.com/link/search/${encodedAddress}`;

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

      {/* 1. 약도 이미지 (메인: 네이버 지도 연결) */}
      <div className="mb-12">
        <a 
          href={naverMapLink}
          target="_blank"
          rel="noopener noreferrer"
          className="relative block w-full aspect-video sm:h-[400px] bg-gray-100 rounded-xl overflow-hidden border border-gray-200 shadow-sm group"
        >
          <Image
            src="/gimpogugak_map.png"
            alt="김포국악원 약도"
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 800px"
            priority
          />
          
          {/* 상단 안내 배지 */}
          <div className="absolute top-4 left-0 w-full flex justify-center z-10 px-4">
            <span className="bg-black/70 backdrop-blur-sm text-white text-xs sm:text-sm px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
              👆 사진을 누르면 <span className="text-[#03C75A] font-bold">네이버 지도</span>로 연결됩니다
            </span>
          </div>

          {/* 호버 효과 */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
        </a>

        {/* 2. 추가 지도 버튼 (전화 / 구글 / 카카오) — GA4 이벤트 포함 */}
        <ContactMapButtons googleMapLink={googleMapLink} kakaoMapLink={kakaoMapLink} />
      </div>

      {/* 3. 정보 그리드 */}
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