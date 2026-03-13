"use client";

type GtagFn = (...args: unknown[]) => void;

function sendGtag(eventName: string) {
  const w = typeof window !== "undefined" ? (window as unknown as { gtag?: GtagFn }) : null;
  w?.gtag?.("event", eventName, { event_category: "contact" });
}

export default function ContactMapButtons({
  googleMapLink,
  kakaoMapLink,
}: {
  googleMapLink: string;
  kakaoMapLink: string;
}) {
  return (
    <div className="flex flex-wrap gap-3 mt-4">
      <a
        href="tel:01059481843"
        onClick={() => sendGtag("click_call")}
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
        Google 지도로 보기
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
  );
}
