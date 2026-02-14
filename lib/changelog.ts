/**
 * 업데이트 내역 (Changelog)
 * ⚠️ 규칙: 모든 changes 항목은 반드시 한국어로 작성합니다.
 */
export type ChangelogEntry = {
  version: string;
  date: string;
  changes: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.08",
    date: "2026-02-17",
    changes: [
      "수강료 안내 발송 방식을 카카오톡에서 일반 문자(SMS)로 변경",
    ],
  },
  {
    version: "1.0.2",
    date: "2026-02-16",
    changes: [
      "수강료 입금 대기 명단 클릭 시 메시지 복사 및 카카오톡 열기 기능 추가",
      "회원 목록의 개별 카톡/수강료 버튼 버그 수정 (메시지 복사 후 카카오톡 열기)",
      "공통 메시지 생성 모듈 추가 (lib/messages.ts)",
      "카카오톡 1:1 채팅 URL로 수정 (qr.kakao.com/talk/p/)",
    ],
  },
  {
    version: "1.0.1",
    date: "2026-02-15",
    changes: [
      "내 정보 페이지 추가",
      "로그인 버그 수정 (전화번호 조회, RLS)",
      "버전 관리 및 업데이트 내역 시스템 추가",
      "수강생 모바일 네비게이션 가로 배치로 변경",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-02-12",
    changes: [
      "관리자 대시보드 초기화",
      "회원승인, 회원관리, 수업관리, 공지사항 메뉴 구성",
      "시스템 정보 섹션 추가",
    ],
  },
];

export const CURRENT_VERSION = CHANGELOG[0]?.version ?? "1.0.1";
