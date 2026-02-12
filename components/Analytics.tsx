'use client'; // 👈 이게 제일 중요합니다!

import { Analytics as VercelAnalytics } from "@vercel/analytics/react";

export default function Analytics() {
  return (
    <VercelAnalytics 
      beforeSend={(event) => {
        // 브라우저에 'va-disable' 표식이 있으면 통계 전송 안 함
        if (typeof window !== 'undefined' && window.localStorage.getItem('va-disable')) {
          return null;
        }
        return event;
      }}
    />
  );
}