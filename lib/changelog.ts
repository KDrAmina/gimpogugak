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
    version: "2.21",
    date: "2026-03-05",
    changes: [
      "관리자 대시보드 '수강료 입금 대기' 목록 필터링 오류 수정: 수강생별 최신 수강 기록 1건만 기준으로 삼도록 변경(created_at DESC + user_id 중복 제거). 이전에 4회차를 완료한 기록이 is_active=true로 남아 있어도, 이미 갱신된 수강생(최신 기록이 1~3회차)은 더 이상 목록에 표시되지 않음.",
    ],
  },
  {
    version: "2.20",
    date: "2026-03-05",
    changes: [
      "캘린더 '수업 추가' 모달의 수강생 선택 드롭다운 목록을 가나다순(localeCompare 'ko')으로 정렬.",
    ],
  },
  {
    version: "2.19",
    date: "2026-03-05",
    changes: [
      "관리자 대시보드 총 등록 수강료 계산 버그 수정: 복수 행 등록(다중 카테고리 등)으로 동일 수강생이 중복 합산되던 문제를 user_id 기준 중복 제거(Deduplication) 로직으로 해결. 가장 최신 활성(is_active=true) 행 1건만 합산.",
      "수업 관리 페이지 UI 개선: 수강생 이름 클릭 시 해당 수강생 상세 페이지(/admin/students/[id])로 이동하는 링크 추가. 수강생 목록 기본 정렬을 가나다순(localeCompare 'ko')으로 변경.",
    ],
  },
  {
    version: "2.18",
    date: "2026-03-05",
    changes: [
      "수업 관리 페이지의 수강생 중복 출력 버그 수정 (데이터 그룹화 최적화): 갱신(Renew) 또는 복수 행 등록으로 동일 수강생이 여러 번 표시되던 문제를 TypeScript 단에서 user_id 기준 중복 제거(Deduplication)로 해결. 활성/종료 필터 적용 후 가장 최근 생성된 행 1건만 표시.",
    ],
  },
  {
    version: "2.17",
    date: "2026-02-27",
    changes: [
      "비밀번호 재설정 페이지(/update-password) 세션 복원 로직 개선: URL hash 처리 대기 시간 500ms·최대 5회 재시도로 확대하여 이메일 링크 접속 시 세션 미인식 문제 해결. 테스트용 디버그 UI 제거 후 정식 배포.",
    ],
  },
  {
    version: "2.16",
    date: "2026-02-27",
    changes: [
      "로그인 페이지에 '비밀번호를 잊으셨나요?' 링크 및 이메일 입력 폼 추가. resetPasswordForEmail 호출 시 redirectTo를 https://gimpogugak.com/update-password로 설정하여 재설정 링크가 전용 페이지로 연결되도록 함. 발송 성공 시 '이메일로 재설정 링크를 보냈습니다' 안내.",
    ],
  },
  {
    version: "2.15",
    date: "2026-02-27",
    changes: [
      "[보안/회원] 비밀번호 분실 시 재설정할 수 있는 전용 페이지(/update-password) 신설 및 Supabase Auth updateUser 연동. 이메일 복구 링크 접속 후 새 비밀번호 입력·확인 폼으로 변경 가능.",
      "[UI/UX] 모바일 및 카카오톡 인앱 브라우저에서 로고와 상단 메뉴가 겹치던 가독성 문제 해결. 로고 max-width·높이 조정, 메뉴 justify-start로 반응형 헤더 최적화.",
      "[시스템] IndexNow 전송 로직의 예외 처리 강화(8초 타임아웃, AbortController)로 검색 엔진 최적화 효율 증대.",
    ],
  },
  {
    version: "2.14",
    date: "2026-02-27",
    changes: [
      "IndexNow 전송 로직 수정: 예약/임시저장 글은 제외하고 실제 발행된 글만 검색엔진에 핑을 보내도록 개선. published_at이 현재 시각 이하일 때만 IndexNow API 호출.",
    ],
  },
  {
    version: "2.12",
    date: "2026-02-27",
    changes: [
      "SNS 공유 기능을 드롭다운에서 직관적인 가로 나열형(Inline)으로 UI 개편: X(트위터), 페이스북, 네이버, 링크 복사 4개 아이콘을 한 줄에 배치하여 추가 클릭 없이 즉시 공유 가능. 클릭 깊이 감소로 공유 전환율 향상.",
    ],
  },
  {
    version: "2.11",
    date: "2026-02-27",
    changes: [
      "Bing IndexNow API 연동 (글 발행 시 자동 색인 요청 기능 추가): 블로그 글 등록/수정 성공 시 Bing·Naver 등 IndexNow 지원 검색엔진에 즉시 색인 요청. public/<key>.txt 키 파일, lib/indexnow.ts 유틸, /api/indexnow 라우트 추가. PostEditor·PostModal 발행 플로우에 fire-and-forget 방식으로 연동.",
    ],
  },
  {
    version: "2.10",
    date: "2026-02-27",
    changes: [
      "블로그 목록 무한 스크롤 및 안 읽은 글 하이라이트 기능 추가: 기존 페이지네이션을 IntersectionObserver 기반 무한 스크롤로 교체하여 끊김 없는 브라우징 지원. localStorage에 읽은 글 ID를 저장하여 안 읽은 글에 파란 점·하이라이트 배경 표시, 읽은 글은 회색 텍스트로 구분. 탭/검색 변경 시 스크롤 상태 자동 초기화.",
    ],
  },
  {
    version: "2.09",
    date: "2026-02-27",
    changes: [
      "캡션 적용 시 사진 삭제 버그 수정 및 지능형 에디터 잠금 해제 적용: ReadOnly 상태에서 Quill API/DOM 변경 시 인덱스 손상으로 이미지 노드가 삭제되는 치명적 버그 발견. applyCaption 함수에서 DOM 수정 직전 editor.enable(true)로 일시 활성화 후 작업 수행, 완료 후 툴팁 닫힘과 함께 자동 재잠금. 이미지 노드 존재 검증(contains) 추가로 안전성 강화. TROUBLESHOOTING.md에 v2.08 실패 사례 및 해결 전략 문서화.",
    ],
  },
  {
    version: "2.08",
    date: "2026-02-27",
    changes: [
      "툴팁 첫 글자 누수 방지를 위한 에디터 잠금(ReadOnly) 및 네이티브 이벤트 격리 적용: React Synthetic Events(onKeyDownCapture)가 Quill 네이티브 DOM 리스너보다 늦게 실행되는 근본 원인 발견. 세 겹 격리 전략 도입 — (1) readOnly={imageTooltip.visible}로 에디터 키보드 모듈 자체 비활성화, (2) tooltipRef에 네이티브 addEventListener(capture:true) + stopImmediatePropagation으로 DOM 레벨 차단, (3) auto-focus로 UX 보장. TROUBLESHOOTING.md에 React vs Native 이벤트 실행 순서 다이어그램 문서화.",
    ],
  },
  {
    version: "2.07",
    date: "2026-02-27",
    changes: [
      "에디터 이벤트 강제 격리(Capture Phase) 및 오답 노트 고도화: 버블 단계 stopPropagation이 React-Quill 전역 리스너에 무효한 구조적 한계 발견. 툴팁 컨테이너에 캡처 단계(onKeyDownCapture 등) 이벤트 차단 적용, input onFocus 시 quill.blur() 호출로 에디터 포커스 탈취 원천 차단. TROUBLESHOOTING.md에 실패 접근법(버블 단계)과 올바른 해결법(캡처 단계) 대비 문서화.",
    ],
  },
  {
    version: "2.06",
    date: "2026-02-27",
    changes: [
      "툴팁 키보드 이벤트 버블링 차단 및 오답 노트(Troubleshooting) 시스템 도입: 이미지 툴팁(Alt/Caption) input에 onKeyDown·onKeyPress·onPointerDown stopPropagation 적용하여 키 입력이 Quill 에디터로 새어 나가는 버그 수정. TROUBLESHOOTING.md 신설 — Ghosting Caption·Keystroke Leakage 등 유사 버그 재발 방지용 문서화.",
    ],
  },
  {
    version: "2.05",
    date: "2026-02-27",
    changes: [
      "에디터 유령 캡션(Ghosting Caption) 무한 중복 버그 수정 및 캡션 적용 버튼 추가: 키 입력마다 DOM을 직접 조작하던 로직을 제거하고, 캡션 입력은 React 상태만 업데이트하도록 변경. '적용' 버튼 클릭 또는 Enter 키로 캡션을 일괄 반영하여 React-Quill Delta 엔진과의 충돌 해소.",
    ],
  },
  {
    version: "2.04",
    date: "2026-02-27",
    changes: [
      "블로그 에디터 이미지 캡션 중복 삽입 버그 수정: 캡션 입력 시 기존 캡션을 탐지하여 업데이트하는 멱등(idempotent) 로직으로 리팩터링. 이미지당 캡션 요소를 하나만 유지하며, 빈 값 입력 시 캡션 자동 제거. CSS 클래스를 ql-image-caption으로 통일하여 에디터·뷰어 스타일 일관성 확보.",
    ],
  },
  {
    version: "2.03",
    date: "2026-02-27",
    changes: [
      "블로그 에디터 이미지 삽입 UX 리뉴얼: 이미지 업로드·붙여넣기·드래그 시 차단 모달(window.prompt) 제거, 즉시 삽입 방식으로 전환. 에디터 내 이미지 클릭 시 플로팅 툴팁(팝오버) 표시 — SEO 대체 텍스트(Alt)와 사진 설명(Caption) 입력 지원. 캡션은 이미지 바로 아래 스타일링된 텍스트로 삽입되어 게시글 가독성 향상.",
    ],
  },
  {
    version: "2.02",
    date: "2026-02-27",
    changes: [
      "회원 대시보드 사이드바에 '블로그' 링크 추가: 로그인한 수강생(active)이 보는 좌측 네비게이션에 /blog 링크를 '공지사항' 바로 아래, '내 수업' 위에 배치하여 국악원 블로그 콘텐츠 접근성 향상 및 수강생 참여도 증대.",
    ],
  },
  {
    version: "2.01",
    date: "2026-02-27",
    changes: [
      "관리자 블로그 에디터 WYSIWYG 동기화: 에디터 컨테이너 너비를 블로그 상세 페이지와 동일한 max-w-2xl(672px)로 축소하고, 에디터 좌우 패딩을 24px(px-6)로 맞춰 줄바꿈 위치 일치. CSS 줄간격(line-height)을 1.8, 문단 여백(margin-bottom)을 1.5em으로 뷰어와 완전 통일하여 에디터에서 보이는 레이아웃이 독자 화면과 정확히 일치하도록 개선.",
    ],
  },
  {
    version: "2.00",
    date: "2026-02-27",
    changes: [
      "관리자 블로그 에디터 대규모 UX 리뉴얼: 팝업 모달 방식에서 전용 풀페이지 편집기로 전환. 좌측 본문 영역(에디터 max-w-4xl)과 우측 설정 사이드바(카테고리·발행일시·썸네일·외부링크·SEO) 분리 레이아웃 도입. 실제 블로그 게시 화면과 유사한 넓은 편집 환경 제공. 새 글 작성(/admin/posts/manage/new) 및 수정(/admin/posts/manage/edit/[id]) 전용 라우트 신설.",
    ],
  },
  {
    version: "1.99",
    date: "2026-02-27",
    changes: [
      "파비콘 400 오류 수정: Naver Search Advisor가 보고한 /favicon.ico 400 Bad Request 해결. app/icon.png(192×192 PNG)를 ICO 컨테이너에 임베드하여 public/favicon.ico 생성. 모든 크롤러 및 브라우저의 /favicon.ico 요청이 유효한 이미지로 응답됨.",
    ],
  },
  {
    version: "1.98",
    date: "2026-02-27",
    changes: [
      "블로그 본문 이미지 강제 중앙 정렬: CSS display:block + margin:auto에 !important 추가하여 에디터 인라인 스타일(width 등)에 의한 좌측 쏠림 현상 완전 해결.",
      "블로그 본문 가독성 향상: 뷰어 전용 line-height 1.8, 문단 간격 margin-bottom 1.5em 적용 (폰트 패밀리 변경 없음).",
    ],
  },
  {
    version: "1.97",
    date: "2026-02-27",
    changes: [
      "이미지 EXIF 회전 보정: 업로드 시 createImageBitmap + Canvas로 자동 회전 적용 후 WebP 변환. 스마트폰 세로 사진이 옆으로 눕는 문제 해결.",
      "블로그 본문 이미지 가운데 정렬: 리사이즈된 이미지도 항상 중앙 배치되도록 BlogContent 컴포넌트에 display:block + margin:0 auto 적용.",
    ],
  },
  {
    version: "1.96",
    date: "2026-02-27",
    changes: [
      "Supabase Storage 이미지 일괄 최적화: images·public-media 버킷 전체 383개 파일 중 1MB 이상 323개를 sharp로 최대 1200px 리사이즈 + WebP(q80) 변환. 총 1,595MB → 약 40MB로 감소, 약 1.56GB 스토리지·이그레스 절감.",
    ],
  },
  {
    version: "1.95",
    date: "2026-02-27",
    changes: [
      "관리자 글 작성·수정 폼 입력값 공백 정제: title, slug, external_link, meta_title, meta_description, meta_keywords 필드에 앞뒤 공백 trim() 적용. slug는 추가로 내부 공백을 하이픈(-)으로 치환하여 SEO URL 오염 방지.",
      "글 작성 기본 카테고리를 '음악교실'로 변경: PostModal(소식 관리) 및 write 페이지 모두 신규 글 생성 시 기본값이 '음악교실'로 설정되어 관리 워크플로우 최적화.",
    ],
  },
  {
    version: "1.94",
    date: "2026-02-26",
    changes: [
      "홈페이지 CONNECT 섹션에 '개인정보처리방침' 링크 추가: 실제 사용자에게 노출되는 Instagram·Naver Blog 영역에 /privacy 링크 배치.",
    ],
  },
  {
    version: "1.93",
    date: "2026-02-26",
    changes: [
      "전역 푸터 '개인정보처리방침' 링크 노출 확인 및 버전 업데이트: 모든 페이지 하단 푸터 '바로가기' 섹션에 /privacy 링크가 정상 노출됨을 최종 검증.",
    ],
  },
  {
    version: "1.92",
    date: "2026-02-26",
    changes: [
      "공개 블로그 목록 UX 개선: 상단 검색 바(돋보기 아이콘) 추가 — 제목 키워드 실시간 필터링 지원. 페이지네이션 도입(페이지당 10건, 이전/다음/번호 네비게이션). No. 열 추가 — 가장 오래된 글이 1번, 최신 글이 최고 번호를 갖는 역순 넘버링(totalPosts - ((page-1)×10 + index)). 게시글 앞 카테고리 배지 제거(탭 필터로 대체). 푸터 '개인정보처리방침' 링크 노출 확인.",
    ],
  },
  {
    version: "1.91",
    date: "2026-02-26",
    changes: [
      "블로그 이전글/다음글 네비게이션 카테고리 격리 및 예약글 방어: '음악교실' 글에서는 같은 '음악교실' 글로만, '국악원소식' 글에서는 같은 '국악원소식' 계열 글로만 이동하도록 카테고리 필터 추가. published_at <= now() 조건으로 예약(미래) 발행 글이 네비게이션에 노출되지 않도록 강화.",
    ],
  },
  {
    version: "1.90",
    date: "2026-02-26",
    changes: [
      "블로그 카테고리 시스템 도입: '음악교실'(파란 배지)과 '국악원소식'(초록 배지) 2개 카테고리 추가. 관리자 글 작성·수정 모달에 카테고리 라디오 버튼 선택 UI 추가, DB 저장 시 선택한 카테고리 반영. 공개 블로그 목록 상단에 [전체보기 / 음악교실 / 국악원소식] 탭 필터 추가(클라이언트 사이드 SSG 성능 유지), 각 게시글 카드에 카테고리 배지 표시. 블로그 상세 페이지 제목 위에 카테고리 배지 노출. 기존 '소식' 카테고리 글은 '국악원소식'으로 통합 표시(하위 호환).",
    ],
  },
  {
    version: "1.89",
    date: "2026-02-26",
    changes: [
      "개인정보처리방침 페이지(/privacy) 신설: 수집 항목·이용 목적·보유 기간·파기 절차·제3자 제공·이용자 권리·보호책임자·쿠키 운영 등 9개 섹션으로 구성된 한국 법령 준수 방침 페이지 추가. 푸터 '개인정보처리방침' 링크 연결 완료.",
    ],
  },
  {
    version: "1.88",
    date: "2026-02-26",
    changes: [
      "블로그 상세 페이지 UI 개편: 공유 버튼을 하단에서 날짜 옆 상단으로 이동(링크 아이콘 소형 버튼), 하단 '공유하기' 버튼 제거 후 이전글/목록/다음글 네비게이션으로 교체. 이전글은 ← 이전글 [제목5자], 다음글은 다음글 [제목5자] → 형식으로 표시하며 가장 오래된/최신 글의 경우 해당 방향 링크 생략.",
    ],
  },
  {
    version: "1.87",
    date: "2026-02-26",
    changes: [
      "소식 관리 테이블에 No. 열 추가: 페이지네이션 연동으로 1페이지 1~10번, 2페이지 11~20번 등 페이지 간 번호가 연속되도록 계산 ((현재 페이지 - 1) × 페이지당 항목 수 + 순번)",
    ],
  },
  {
    version: "1.86",
    date: "2026-02-25",
    changes: [
      "블로그 조회수 증가 근본 원인 수정: ViewTracker를 클라이언트 측 anon 키 직접 호출에서 서버 API 라우트(/api/track-view)로 전환. 서버 측에서 SUPABASE_SERVICE_ROLE_KEY를 사용해 RLS 제약 없이 UPDATE 실행. SELECT/UPDATE 실패 시 Vercel 함수 로그에 code/message/details/hint 상세 출력, 브라우저 콘솔에도 응답 오류 로깅 추가.",
    ],
  },
  {
    version: "1.85",
    date: "2026-02-25",
    changes: [
      "블로그 조회수 증가 버그 수정: Supabase DB 컬럼명이 view_count가 아닌 views임을 확인, ViewTracker 컴포넌트의 select/update 쿼리가 views 컬럼을 정확히 참조하도록 검증 완료",
    ],
  },
  {
    version: "1.84",
    date: "2026-02-25",
    changes: [
      "관리자 수업관리 단체반 '납부 이력' 모달 추가: '최근 납부: YYYY년 MM월' 텍스트 클릭 시 lesson_history에서 status '결제 완료' 기록만 조회하여 날짜순 내림차순 목록 표시. 신규 수강생(기록 없음)은 '납부 기록이 없습니다' 안내. 읽기 전용(SELECT만, 수정/삭제 없음).",
    ],
  },
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
