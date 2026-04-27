"use client";

import Image from "next/image";
import { trackConversion } from "@/lib/gtag";

type GtagFn = (...args: unknown[]) => void;

function sendGtag(eventName: string) {
  const w = typeof window !== "undefined" ? (window as unknown as { gtag?: GtagFn }) : null;
  w?.gtag?.("event", eventName, { event_category: "contact" });
}

const FREE_TRIAL_URL =
  "https://talk.naver.com/w41epc?frm=pblog&ref=https%3A%2F%2Fblog.naver.com%2Fgimpogugak%2F224252907293#nafullscreen";

export default function BlogContactSection() {
  const addressQuery = "경기도 김포시 모담공원로 170-14";
  const encodedAddress = encodeURIComponent(addressQuery);
  const naverMapLink = `https://map.naver.com/v5/search/${encodedAddress}`;
  const googleMapLink = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
  const kakaoMapLink = `https://map.kakao.com/link/search/${encodedAddress}`;

  return (
    <div className="mt-16 pt-12 border-t border-gray-200">

      {/* 브랜딩 텍스트 섹션 */}
      <div className="mb-6 text-center space-y-1.5">
        <p className="text-sm sm:text-base text-gray-700 leading-relaxed">
          <span className="font-semibold text-gray-900">김포국악원</span>
          {" "}|{" "}경기도 김포시{" "}|{" "}경기민요 · 서도민요 · 국악 레슨
        </p>
        <p className="text-sm sm:text-base text-gray-700 leading-relaxed">
          김포민요 · 민요 취미 · 전공반 · 어르신 프로그램 · 학생 체험
        </p>
        <p className="text-sm sm:text-base text-gray-700 font-semibold tracking-tight">
          무형문화재 제3호 &lsquo;놀량사거리&rsquo; 공식 전승 기관
        </p>
      </div>

      {/* 무료체험 신청 배너 버튼 */}
      <div className="mb-8">
        <a
          href={FREE_TRIAL_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => sendGtag("click_free_trial")}
          className="relative block w-full rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow active:scale-[0.99]"
        >
          <Image
            src="/free-trial-banner.png"
            alt="1회 무료체험 신청하기!"
            width={800}
            height={200}
            className="w-full h-auto"
            sizes="(max-width: 768px) 100vw, 896px"
          />
        </a>
      </div>

      <div className="mb-4">
        <a
          href={naverMapLink}
          target="_blank"
          rel="noopener noreferrer"
          className="relative block w-full aspect-video sm:h-[320px] bg-gray-100 rounded-xl overflow-hidden border border-gray-200 shadow-sm group"
        >
          <Image
            src="/image_b4e966.jpg"
            alt="김포국악원 약도"
            fill
            loading="lazy"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 896px"
          />
          <div className="absolute top-4 left-0 w-full flex justify-center z-10 px-4">
            <span className="bg-black/70 backdrop-blur-sm text-white text-xs sm:text-sm px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
              👆 사진을 누르면 <span className="text-[#03C75A] font-bold">네이버 지도</span>로 연결됩니다
            </span>
          </div>
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
        </a>

        <div className="flex flex-wrap gap-3 mt-4">
          <a
            href="tel:01059481843"
            onClick={() => { sendGtag("click_call"); trackConversion(); }}
            className="w-full sm:flex-1 py-3 text-center text-sm font-bold text-white bg-black rounded-lg hover:bg-gray-800 transition-colors shadow-sm flex items-center justify-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M2 3.5A1.5 1.5 0 0 1 3.5 2h1.148a1.5 1.5 0 0 1 1.465 1.175l.716 3.223a1.5 1.5 0 0 1-1.052 1.767l-.933.267c-.41.117-.643.555-.48.95a11.542 11.542 0 0 0 6.254 6.254c.395.163.833-.07.95-.48l.267-.933a1.5 1.5 0 0 1 1.767-1.052l3.223.716A1.5 1.5 0 0 1 18 15.352V16.5a1.5 1.5 0 0 1-1.5 1.5H15c-1.149 0-2.263-.15-3.326-.43A13.022 13.022 0 0 1 2.43 8.326 13.019 13.019 0 0 1 2 5V3.5Z" clipRule="evenodd" />
            </svg>
            전화문의
          </a>
          <a
            href={googleMapLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => sendGtag("click_google_map")}
            className="flex-1 py-3 text-center text-sm font-bold text-[#4285F4] bg-white border border-[#4285F4] rounded-lg hover:bg-[#4285F4] hover:text-white transition-colors shadow-sm"
          >
            Google 지도 보기
          </a>
          <a
            href={kakaoMapLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => sendGtag("click_kakao_map")}
            className="flex-1 py-3 text-center text-sm font-bold text-[#371D1E] bg-[#FAE100] rounded-lg hover:bg-[#ebd300] transition-colors shadow-sm"
          >
            카카오맵으로 보기
          </a>
        </div>
      </div>
    </div>
  );
}
