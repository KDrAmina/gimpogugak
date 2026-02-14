/**
 * Shared message generation for KakaoTalk / clipboard
 */

/** Personal greeting (카톡 버튼) */
export function getPersonalGreeting(name: string): string {
  return `안녕하세요 ${name || "회원"}님, 김포국악원입니다. `;
}

/** Tuition payment message - 4회차 완료 (수강료 입금 대기) */
export function getTuitionPaymentMessage(name: string, category: string): string {
  return `안녕하세요 ${name || "회원"}님, 김포국악원입니다.\n\n${category} 수업 4회차가 모두 완료되었습니다.\n\n다음 기수 수강을 원하시면 수강료 입금 후 연락 주세요.\n\n감사합니다.`;
}

/** Tuition reminder - 월별 수강료 안내 (수강료 버튼) */
export function getTuitionReminderMessage(name: string): string {
  const currentMonth = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
  });
  return `안녕하세요 ${name || "회원"}님, 김포국악원입니다.\n\n${currentMonth} 수강료 납부를 안내드립니다.\n\n문의사항이 있으시면 언제든 연락 주세요.\n감사합니다.`;
}

/** KakaoTalk 1:1 chat URL by phone number */
export function getKakaoTalkUrl(phone: string | null): string | null {
  if (!phone) return null;
  const clean = phone.replace(/[^0-9]/g, "");
  if (clean.length < 10) return null;
  return `https://qr.kakao.com/talk/p/${clean}`;
}

/** SMS URI - opens default SMS app with pre-filled body */
export function getSmsUrl(phone: string | null, body: string): string | null {
  if (!phone) return null;
  const clean = phone.replace(/[^0-9]/g, "");
  if (clean.length < 10) return null;
  return `sms:${clean}?body=${encodeURIComponent(body)}`;
}
