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
    version: "1.83",
    date: "2026-02-25",
    changes: [
      "단체수업 Two-Track 강화: 관리자 캘린더 날짜별 수업 추가 모달에서 단체반 수강생 선택 시 '납부 등록' 라벨 표시 및 제출 시 lesson_history에 status '결제 완료'로 기록. lessons.payment_date 업데이트. 개인반 출석 로직과 완전 분기.",
      "관리자 캘린더 삭제 시 current_session 동기화를 session_number>0 레코드만 카운트하도록 수정하여 단체 납부 기록이 개인반 진도에 영향 없음.",
      "수강생 마이페이지 단체반 '최근 납부 내역' 카드 노출: 기존 숨김 해제, 제목/리스트 문구 분기(회차 제거, 결제 완료 표시), 10개 페이지네이션 재사용.",
    ],
  },
  {
    version: "1.82",
    date: "2026-02-25",
    changes: [
      "개인/단체 수업 '투-트랙' UI 시스템 도입: category에 '단체' 포함 여부로 분기. 관리자 수업관리 페이지에서 단체반 수강생은 출석 체크 대신 '이번 달 입금 확인' 버튼(보라색) 표시 — 클릭 시 payment_date를 오늘 날짜로 업데이트하며 기존 데이터는 삭제 없이 보존. 이미 이번 달 납부 완료 상태면 '✓ 납부완료'로 표시하고 중복 확인 방지. 수강생 내 수업 페이지에서 단체반은 진도(0/4) 및 최근 수강 내역 카드를 숨기고 '결제 안내' 카드(정기 납부일·이번 달 납부 상태·계좌 안내)를 대신 표시. 개인반 기존 화면은 완전히 보존.",
    ],
  },
  {
    version: "1.81",
    date: "2026-02-25",
    changes: [
      "수업 갱신(handleRenewLesson) 파괴적 삭제 방식 수정: 갱신 시 lesson_history 레코드를 삭제하지 않고 기존 수업 행을 is_active=false로 아카이브한 뒤 새로운 수업 행(current_session=0)을 INSERT하는 LMS 표준 방식으로 전환. 이전 출석·진도 기록이 DB에 영구 보존됨. my-lessons 페이지에서 is_active=true 필터 추가로 수강생이 항상 현재 기수만 조회하도록 수정.",
    ],
  },
  {
    version: "1.80",
    date: "2026-02-25",
    changes: [
      "수업 관리 캘린더-목록 데이터 동기화 버그 수정: (1) 수업 갱신 시 lesson_history 이전 기록 삭제로 캘린더 잔존 데이터 제거, (2) 캘린더 삭제 버튼이 임의 회차 삭제 시 current_session을 blind decrement 대신 lesson_history 실제 잔여 건수로 재동기화, (3) 수업 취소(↩️) 버튼이 session_number 일치 탐색 대신 최신 레코드 ID로 삭제하여 번호 공백 문제 해결, (4) 날짜별 수업 추가 모달이 stale 상태값 대신 DB에서 최신 current_session을 재조회하여 중복 삽입 방지, (5) 목록 진도 날짜 표시를 slice 기반 추정에서 lesson_history 직접 렌더링으로 교체하여 캘린더와 항상 동일한 데이터 표시",
    ],
  },
  {
    version: "1.79",
    date: "2026-02-25",
    changes: [
      "내 수업 최근 수강 내역 페이지네이션 추가: 페이지당 10개 항목 표시, 이전/다음 버튼 및 페이지 번호 네비게이션으로 기록이 많아도 UI가 무한 늘어나지 않도록 개선",
    ],
  },
  {
    version: "1.78",
    date: "2026-02-25",
    changes: [
      "내 수업 최근 수강 내역 빈 목록 버그 수정: lesson_history 조회 쿼리에서 존재하지 않는 note 컬럼을 제거하고 실제 DB 스키마(id, lesson_id, session_number, completed_date, status)에 맞게 수정. 쿼리 실패 시 에러를 무시하던 로직을 수정하여 console.error로 명시 출력하고, JSX에서 note 참조 제거 및 record.id를 map key로 사용.",
    ],
  },
  {
    version: "1.77",
    date: "2026-02-25",
    changes: [
      "수업 기록 오류 디버깅 강화: handleConfirmLessonByDate의 lesson_history insert 실패 시 Supabase 에러 객체를 console.error로 상세 출력하도록 개선 (RLS 또는 스키마 문제 즉시 식별 가능)",
    ],
  },
  {
    version: "1.76",
    date: "2026-02-25",
    changes: [
      "Vercel ISR Writes 한도 초과 대응: 관리자 대시보드(admin/page.tsx), 수업 관리(admin/lessons/page.tsx), 내 수업(my-lessons/page.tsx) 페이지에 force-dynamic 적용하여 ISR 캐시 생성을 차단",
    ],
  },
  {
    version: "1.75",
    date: "2026-02-25",
    changes: [
      "관리자 출석 체크 동기화: 출석(handleCheckIn) 및 날짜별 수업 확인(handleConfirmLessonByDate) 시 lesson_history에 user_id와 status('출석') 필드를 명시적으로 함께 저장하여 수강생 페이지의 최근 수강 내역과 완전 연동",
    ],
  },
  {
    version: "1.74",
    date: "2026-02-25",
    changes: [
      "내 수업 페이지에 '최근 수강 내역' 카드 추가: 수업 진행 현황과 결제 상태 카드 사이에 타임라인 형식으로 회차별 날짜·출결 상태(출석/결석/보강/대기) 표시. lesson_history 테이블에 status 컬럼 추가(기본값 '출석')로 상세 출결 관리 지원.",
    ],
  },
  {
    version: "1.73",
    date: "2026-02-24",
    changes: [
      "블로그 조회수 관리자 기기 제외: localStorage 'is_admin_device' 플래그가 설정된 기기에서는 ViewTracker가 조회수를 증가시키지 않아 관리자 방문이 통계에 포함되지 않음",
    ],
  },
  {
    version: "1.72",
    date: "2026-02-24",
    changes: [
      "관리자 기기 Google Analytics 추적 제외: 로그인 성공 시 localStorage에 'is_admin_device' 플래그 저장, GoogleAnalyticsWrapper 컴포넌트가 해당 기기에서는 GA 스크립트를 렌더링하지 않아 관리자 방문이 통계에서 영구 제외됨",
    ],
  },
  {
    version: "1.71",
    date: "2026-02-24",
    changes: [
      "관리자 대시보드 상단에 구글 애널리틱스 바로가기 버튼 추가 (analytics.google.com 새 탭 열기)",
    ],
  },
  {
    version: "1.70",
    date: "2026-02-24",
    changes: [
      "Google Analytics 4(GA4) 전역 연동: @next/third-parties/google의 GoogleAnalytics 컴포넌트를 루트 레이아웃에 추가하여 모든 페이지의 방문자 및 사용자 행동 데이터 수집 시작 (측정 ID: G-DJ97Y83J9Y)",
    ],
  },
  {
    version: "1.69",
    date: "2026-02-24",
    changes: [
      "블로그 게시글 조회수(views) 기능 추가: 공개 상세 페이지 방문 시 localStorage 기반 24시간 중복 방지 후 Supabase views 컬럼 자동 증가, 관리자 소식 관리 테이블에 '조회수' 열 표시 (공개 페이지에는 노출 없음)",
    ],
  },
  {
    version: "1.68",
    date: "2026-02-23",
    changes: [
      "블로그 URL 슬러그 우선: slug가 있으면 /blog/[slug], 없으면 /blog/[id]로 접근. 목록·관리자·사이트맵·메타데이터 canonical 모두 slug 기반 URL 사용",
    ],
  },
  {
    version: "1.66",
    date: "2026-02-23",
    changes: [
      "소식 관리 페이지 검색 및 페이지네이션 기능 추가: 제목/내용 키워드 검색, 페이지당 표시 개수 선택(10/15/30/50/100), 이전/다음/페이지 번호 네비게이션",
    ],
  },
  {
    version: "1.66",
    date: "2026-02-22",
    changes: [
      "관리자 소식 관리: 예약 배지에 발행 예정 일시 표시(예: 예약됨 26.02.25 14:00), SEO 설정에 Slug 입력 필드 추가",
    ],
  },
  {
    version: "1.65",
    date: "2026-02-22",
    changes: [
      "블로그 에디터 이미지 이중 삽입 버그 수정: modules useMemo, 파일 input 초기화, paste/drop capture 단계 처리, clipboard IMG matcher로 Base64 차단",
    ],
  },
  {
    version: "1.64",
    date: "2026-02-22",
    changes: [
      "블로그 에디터 이미지 Alt Text(대체 텍스트) 지원: 커스텀 Image blot으로 alt 속성 저장, 업로드 시 SEO용 alt 입력 프롬프트, HTML 출력에 <img alt=\"...\"> 포함",
    ],
  },
  {
    version: "1.63",
    date: "2026-02-22",
    changes: [
      "블로그 예약 발행(Scheduled Publishing): published_at 컬럼 추가, 관리자 UI에 발행 일시 입력, 예약된 글은 관리 목록에서 흐리게 표시 및 '예약됨' 배지, 공개 페이지는 published_at <= NOW()만 노출",
    ],
  },
  {
    version: "1.62",
    date: "2026-02-22",
    changes: [
      "블로그 에디터 이미지 Base64 제거: Supabase Storage 업로드 유틸(lib/upload-image.ts) 추가, 툴바 이미지 버튼·드래그앤드롭·붙여넣기 시 URL 삽입으로 DB 용량 절감 및 Next.js Image 최적화 활용",
    ],
  },
  {
    version: "1.61",
    date: "2026-02-20",
    changes: [
      "블로그 상세 페이지 정적 생성(SSG/ISR) 적용으로 로딩 속도 극대화",
    ],
  },
  {
    version: "1.60",
    date: "2026-02-20",
    changes: [
      "PageSpeed 최적화: LCP(히어로 이미지 sizes 1200px), CLS 방지(배지/Navbar min-height), 폰트 다이어트(Noto Serif 600, Nanum 800 제거), browserslist 정리, 홈 하단 섹션·Analytics/SpeedInsights dynamic import",
    ],
  },
  {
    version: "1.59",
    date: "2026-02-10",
    changes: [
      "단순 코드 블록 서식을 진짜 HTML 소스 편집 모드로 교체",
    ],
  },
  {
    version: "1.57",
    date: "2026-02-10",
    changes: [
      "에디터 'HTML 소스 직접 수정(View Source)' 기능 추가",
    ],
  },
  {
    version: "1.56",
    date: "2026-02-10",
    changes: [
      "에디터 코드 블록(</>) 버튼 활성화 및 하단 서명 지도 이미지 경로 오류 수정",
    ],
  },
  {
    version: "1.55",
    date: "2026-02-10",
    changes: [
      "블로그 하단에 문의(Contact) 페이지와 동일한 자동 서명 및 지도 섹션 추가",
    ],
  },
  {
    version: "1.53",
    date: "2026-02-10",
    changes: [
      "블로그 에디터 '코드 블록(code-block)' 기능 추가 및 스타일링 적용",
    ],
  },
  {
    version: "1.52",
    date: "2026-02-10",
    changes: [
      "sitemap.ts에 누락되었던 핵심 라우트(/blog 목록 페이지) 추가",
    ],
  },
  {
    version: "1.51",
    date: "2026-02-10",
    changes: [
      "sitemap.ts에 Supabase 동적 블로그 게시글 데이터 연동 (SEO 최적화)",
    ],
  },
  {
    version: "1.50",
    date: "2026-02-10",
    changes: [
      "에디터 툴바 하이퍼링크(link) 버튼 활성화 및 클릭 유도(CTA) 링크 CSS 스타일 적용",
    ],
  },
  {
    version: "1.49",
    date: "2026-02-10",
    changes: [
      "뷰어 화면의 과도한 문단 여백(margin) 축소 및 한글 단어 잘림(word-break) 현상 방지",
    ],
  },
  {
    version: "1.48",
    date: "2026-02-10",
    changes: [
      "에디터 툴바 메뉴(Normal -> 본문 등) 한글화 및 뷰어(상세 페이지) 줄바꿈/여백(Tailwind 충돌) 강제 동기화",
    ],
  },
  {
    version: "1.47",
    date: "2026-02-10",
    changes: [
      "수업관리 진도 날짜 표시 추가, 수업 취소 달력 동기화 버그 수정, 캘린더 내장 삭제 버튼 추가",
    ],
  },
  {
    version: "1.46",
    date: "2026-02-10",
    changes: [
      "성능 저하 없는 안전한 에디터 폰트(고운돋움, 나눔명조) 국소적 추가 적용",
    ],
  },
  {
    version: "1.45",
    date: "2026-02-10",
    changes: [
      "전역 폰트 로딩 최적화(next/font 적용 및 미사용 폰트 분리), 접근성 100점 달성(viewport 수정), CSS 인라인화 복구",
    ],
  },
  {
    version: "1.43",
    date: "2026-02-10",
    changes: [
      "줄바꿈 강제 적용(!important), Quill CSS 로딩 분리(LCP 렌더링 차단 해소), 블로그 목록 정적 생성(SSG) 강제 적용",
    ],
  },
  {
    version: "1.42",
    date: "2026-02-10",
    changes: [
      "성능 다이어트: 무거운 웹 폰트 제거, 블로그 목록을 텍스트(언론보도) 형식으로 경량화, 에디터 숫자 크기 강제 적용",
    ],
  },
  {
    version: "1.41",
    date: "2026-02-10",
    changes: [
      "성능 튜닝: 블로그/활동 페이지 캐싱(ISR) 적용 및 글꼴 로딩 최적화(font-display: swap)로 LCP 점수 개선",
    ],
  },
  {
    version: "1.40",
    date: "2026-02-10",
    changes: [
      "상세 페이지 줄바꿈 강제 적용, 에디터 숫자 글자 크기 반영 및 페이지 이동 속도 개선(로딩 UI 추가)",
    ],
  },
  {
    version: "1.39",
    date: "2026-02-10",
    changes: [
      "에디터 줄바꿈(엔터) 누락 버그 수정 및 글자 크기 옵션을 숫자(px) 단위로 개편",
    ],
  },
  {
    version: "1.38",
    date: "2026-02-10",
    changes: [
      "블로그 에디터와 상세 페이지 간의 WYSIWYG 디자인(줄바꿈, 여백) 불일치 문제 해결",
    ],
  },
  {
    version: "1.37",
    date: "2026-02-19",
    changes: [
      "커스텀 웹 폰트 6종(프리텐다드, 노토산스, 나눔명조, 마포애민, 교보손글씨, 잘난체) 에디터 적용",
    ],
  },
  {
    version: "1.36",
    date: "2026-02-19",
    changes: [
      "스마트 에디터 고도화: 글씨 크기 조절 옵션 추가 및 툴바 상단 고정(Sticky) 적용",
    ],
  },
  {
    version: "1.35",
    date: "2026-02-19",
    changes: [
      "소식 관리 UX 개선: 게시글 작성/수정 팝업(모달) 통합 및 불필요한 메뉴 제거",
    ],
  },
  {
    version: "1.34",
    date: "2026-02-19",
    changes: [
      "블로그(소식) 메뉴 최상단 GNB 승격 및 라우팅 구조 개편 (/blog)",
    ],
  },
  {
    version: "1.33",
    date: "2026-02-19",
    changes: [
      "블로그 상세 페이지 SEO 최적화(SSR) 및 카카오톡 공유하기(링크 복사) 버튼 추가",
    ],
  },
  {
    version: "1.32",
    date: "2026-02-19",
    changes: [
      "소식/공지사항 카테고리 완벽 분리 및 게시글 삭제 시 Storage 이미지 동시 삭제(용량 최적화) 구현",
    ],
  },
  {
    version: "1.31",
    date: "2026-02-18",
    changes: [
      "블로그 목록 미리보기 태그 제거(요약글), 폰트 추가, 게시글 삭제 기능 및 카테고리 자동 분리",
    ],
  },
  {
    version: "1.30",
    date: "2026-02-18",
    changes: [
      "React 호환성 오류 수정(react-quill-new 교체) 및 DB 쓰기 권한(RLS) 해결",
    ],
  },
  {
    version: "1.29",
    date: "2026-02-18",
    changes: [
      "DB 쓰기 권한(RLS) 에러 수정 및 스마트 웹 에디터(사진 드래그 업로드) 적용",
    ],
  },
  {
    version: "1.28",
    date: "2026-02-18",
    changes: [
      "관리자 게시글 작성(이미지 업로드 포함) 기능 구현 및 소식 페이지 DB 연동",
    ],
  },
  {
    version: "1.27",
    date: "2026-02-18",
    changes: [
      "소개(Intro) 메뉴에 블로그(소식) 카드 추가 및 게시판(목록/상세) 기능 구현",
    ],
  },
  {
    version: "1.25",
    date: "2026-02-18",
    changes: [
      "캘린더 날짜별 다중 수업 등록 기능 추가 (하루에 여러 명의 학생 추가 가능하도록 수정)",
    ],
  },
  {
    version: "1.24",
    date: "2026-02-18",
    changes: [
      "캘린더 월 이동 기능(이전달/다음달) 추가 및 월 변경 시 출석 데이터 연동",
    ],
  },
  {
    version: "1.23",
    date: "2026-02-18",
    changes: [
      "수강생 등록 시 카테고리(수업) 중복 선택 기능 추가 (예: 성인단체 + 성인개인 동시 수강)",
      "관리자 대시보드 총 수강료 합계 표시",
      "수업 취소 시 캘린더 연동(기록 삭제) 수정",
      "결제/갱신 시 날짜가 전날로 찍히는 타임존(KST) 버그 수정",
    ],
  },
  {
    version: "1.18",
    date: "2026-02-18",
    changes: [
      "언론 보도 목록에 김포문화재단 게시물 링크 추가",
    ],
  },
  {
    version: "1.17",
    date: "2026-02-18",
    changes: [
      "언론 보도 목록 페이지 생성 (도트 리더 디자인) 및 칼럼 섹션 분리",
    ],
  },
  {
    version: "1.16",
    date: "2026-02-18",
    changes: [
      "소개 페이지 디자인 개편 (텍스트 카드 → 프로필 이미지 포함 카드 형식으로 변경)",
    ],
  },
  {
    version: "1.15",
    date: "2026-02-18",
    changes: [
      "소개 페이지 디자인 수정 (이모티콘 제거, 텍스트 중심의 심플한 디자인 적용)",
    ],
  },
  {
    version: "1.14",
    date: "2026-02-18",
    changes: [
      "상단 로고 크기 확대",
      "소개 메뉴 드롭다운 제거 및 선택 페이지 (원장/부원장/언론) 구현",
    ],
  },
  {
    version: "1.13",
    date: "2026-02-18",
    changes: [
      "소개 메뉴 클릭 시 드롭다운이 열리지 않는 버그 수정",
      "Z-Index 및 클릭 이벤트 연결",
    ],
  },
  {
    version: "1.12",
    date: "2026-02-18",
    changes: [
      "모바일 햄버거 메뉴 제거",
      "상단 메뉴바 가로 나열 방식 (Horizontal Menu)으로 변경",
    ],
  },
  {
    version: "1.11",
    date: "2026-02-18",
    changes: [
      "원장 소개 페이지 디자인 복구 (사진/SNS 링크)",
      "모바일/데스크탑 메뉴 겹침 및 드롭다운 버그 수정",
    ],
  },
  {
    version: "1.10",
    date: "2026-02-18",
    changes: [
      "모바일 메뉴 겹침 버그 수정 (아코디언 방식 적용)",
      "소개 하위메뉴 변경 (원장/부원장)",
      "수업 하위메뉴 삭제",
    ],
  },
  {
    version: "1.09",
    date: "2026-02-18",
    changes: [
      "모바일 헤더 레이아웃 개선 (한 줄 배치)",
      "메뉴 드롭다운(서브메뉴) 기능 추가",
    ],
  },
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
