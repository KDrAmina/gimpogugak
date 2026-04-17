'use client';

import Link from 'next/link';
import { trackConversion } from '@/lib/gtag';

export function HeroCTA() {
  function handleBookingClick() {
    // Google Ads 전환 추적 (AW-17945851352)
    trackConversion();
    // 커스텀 이벤트 — GA4 연동 시 전환 목표로 활용 가능
    window.gtag?.('event', 'click_free_trial_booking', {
      event_category: 'CTA',
      event_label: 'hero_booking_button',
    });
  }

  return (
    <div className="mt-7 flex flex-wrap gap-3 lg:justify-center">
      <a
        href="https://booking.naver.com/booking/6/bizes/937607"
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleBookingClick}
        className="bg-[#8a6f3e] hover:bg-[#7a5f2e] text-white px-6 py-3 rounded-lg font-medium transition-colors text-sm sm:text-base"
      >
        무료 체험 예약하기
      </a>
      <Link
        href="/classes"
        className="border border-[#8a6f3e] text-[#8a6f3e] hover:bg-[#fdf8f0] px-6 py-3 rounded-lg font-medium transition-colors text-sm sm:text-base"
      >
        프로그램 안내 보기
      </Link>
    </div>
  );
}
