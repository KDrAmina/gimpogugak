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
    version: "4.7.17",
    date: "2026-04-02",
    changes: [
      "새 과목 추가 시 카테고리 다중 선택(체크박스) UI 복구 및 콤마 연결 저장 로직 적용",
    ],
  },
  {
    version: "4.7.16",
    date: "2026-04-02",
    changes: [
      "수강 과목 드롭다운 선택 적용 및 수업 상태(진행/종료) 토글 버튼 구현",
      "진행 중인 동일 과목 중복 등록 방지",
    ],
  },
  {
    version: "4.7.15",
    date: "2026-04-02",
    changes: [
      "과거 결제 이력 일괄 등록(타임머신) 기능 구현",
      "특정 수강생 새 과목 추가 기능 구현",
      "알림톡 합산 철통 방어 (is_active 필터 이중 검증)",
    ],
  },
  {
    version: "4.7.14",
    date: "2026-04-02",
    changes: [
      "결제 이력 삭제 시 납부월(payment_date) 자동 롤백 동기화",
      "결제 이력 UI에 과목 스냅샷(category_snapshot) 최우선 렌더링 적용",
    ],
  },
  {
    version: "4.7.13",
    date: "2026-04-02",
    changes: [
      "알림톡 수강료 뻥튀기 버그 완벽 픽스",
      "수업 개별 삭제 기능 추가",
      "과거 결제 이력 과목 스냅샷(category_snapshot) 적용",
      "수강생 추가 시 동일 과목 중복 등록 원천 차단",
    ],
  },
  {
    version: "4.7.11",
    date: "2026-04-02",
    changes: [
      "알림톡 수강료 뻥튀기 버그 완벽 수정 (DB Fetch 및 고유 Lesson 중복 제거 로직 적용)",
    ],
  },
  {
    version: "4.7.10",
    date: "2026-04-01",
    changes: [
      "알림톡 수강료 중복 합산 버그 픽스: 동일 lesson ID 중복 카운트 방지",
      "알림톡 메시지 및 UI 수강료에 천 단위 콤마(,) 적용",
    ],
  },
  {
    version: "4.7.9",
    date: "2026-04-01",
    changes: [
      "환경변수 전역 스코프 선언을 런타임(함수 내부) 호출로 변경, as string 타입 단언 적용",
    ],
  },
  {
    version: "4.7.8",
    date: "2026-04-01",
    changes: [
      "TypeScript 환경변수 타입 에러(string | undefined) 단언 처리",
    ],
  },
  {
    version: "4.7.7",
    date: "2026-04-01",
    changes: [
      "Next.js 환경변수 동적 접근(Dynamic Access) 에러 픽스: 모든 솔라피 환경변수를 정적(Static) 접근 방식으로 수정",
    ],
  },
  {
    version: "4.7.6",
    date: "2026-04-01",
    changes: [
      "알림톡 발송 로직 서버/클라이언트 분리 및 환경변수 디버깅 강화",
      "API 라우트에 force-dynamic 추가로 Vercel 캐싱 방지",
      "환경변수 누락 시 어떤 변수가 빠졌는지 구체적으로 에러 메시지 반환",
    ],
  },
  {
    version: "4.7.4",
    date: "2026-03-31",
    changes: [
      "알림톡 수동 ON/OFF 토글 기능 추가: 알림톡 관리 페이지에서 수강생별 알림톡 발송 여부를 즉시 켜고 끌 수 있는 토글 스위치 추가",
      "수동 제외 상태 뱃지 추가: is_alimtalk_enabled=false인 수강생은 회색 '발송 제외(수동)' 뱃지로 표시 (우선순위: 수동 제외 > 0원 제외 > 발송 완료 > 오늘 발송 > 대기)",
      "크론잡 발송 필터링 강화: 매일 자동 발송 시 is_alimtalk_enabled=false 수강생을 원천 제외하도록 필터링 조건 추가",
    ],
  },
  {
    version: "4.7.3",
    date: "2026-03-31",
    changes: [
      "과거 장부 금액 변조 방지 UI 적용: 수강생 상세 결제 이력에서 tuition_snapshot(결제 당시 금액)을 최우선 렌더링, 수강료 변경 시에도 과거 장부 금액 보호",
      "선납 금액 당월 수입 통계 누락 버그 완벽 해결: 대시보드 월 수입 쿼리를 일반결제(prepaid_month=null)와 선납(prepaid_month=해당월)으로 분리, 미래 달 장부도 선납 실행 월 수입으로 정확히 합산",
    ],
  },
  {
    version: "4.7.2",
    date: "2026-03-31",
    changes: [
      "납부 이력 개별 삭제 기능 추가: 납부 이력 모달에서 각 결제 내역을 개별적으로 삭제 가능 (중복/오류 장부 수동 정리)",
      "스마트 선납(중복 방지) 로직 적용: 가장 최근 결제 완료 월을 조회하여 그다음 안 낸 달부터 순차 선납 (기존 납부 월 중복 생성 방지)",
      "결제 상태 표시 버그 수정: payment_date 비교 방식에서 lesson_history 실제 기록 존재 여부 기반으로 변경 (선납 후에도 정확한 납부완료/미납부 표시)",
    ],
  },
  {
    version: "4.7.1",
    date: "2026-03-31",
    changes: [
      "수강료 수정 시 과거 장부 보호: lesson_history에 tuition_snapshot(결제 시점 수강료) 컬럼 추가, 대시보드 수입 통계가 스냅샷 기준으로 계산되도록 수정",
      "선납 횟수 버그 수정: 이번 달 포함 정확한 개월 수만큼만 생성되도록 반복문 조건 수정 (i=0부터 i<months)",
      "선납 통계 누락 수정: 미래 달 기록에 prepaid_month 플래그 ���가, 대시보드에서 선납 실행 월의 수입으로 합산",
      "수강 정보 수정 모달에 결제일(1~31일) 변경 기능 추가",
    ],
  },
  {
    version: "4.7",
    date: "2026-03-31",
    changes: [
      "특정 월 캘린더 리셋: 현재 보고 있는 연도/월의 납부 내역만 타겟 삭제 (이전/이후 달 데이터 유지)",
      "다개월 선납 기능: 수업 관리 리스트에서 미래 달 납부완료 데이터를 일괄 자동 생성",
      "수강료/과목 정보 수정 기능: 회원관리 목록에서 수강 과목(카테고리)과 수강료를 모달로 변경 가능",
    ],
  },
  {
    version: "4.6",
    date: "2026-03-31",
    changes: [
      "Vercel Cron을 이용한 알림톡 매일 자동 발송 시스템 구축 및 결제일 개별 수정 UI 적용",
      "알림톡 자동 발송 내역 UI(발송 완료) 추가 및 수강료 0원 수강생 자동 발송 제외 로직 적용",
    ],
  },
  {
    version: "4.5",
    date: "2026-03-31",
    changes: [
      "[수업관리] 종료됨 탭 중복 삭제 버튼 통합: '🗑️ 삭제' + '🚫 수강생 완전 삭제' → 빨간색 '삭제' 버튼 1개로 정리 (수강생 영구 삭제 실행).",
      "[수업관리/회원관리] 삭제 확인 경고창 메시지 통일: '모든 결제 내역과 수업 기록이 완전히 지워지며 절대 복구할 수 없습니다' 문구 공통 적용.",
      "[수업관리] 미사용 handleDeleteLesson 함수 제거.",
      "[대시보드] 총수입 계산 타임존 버그 해결: Date.toISOString() UTC 변환으로 월초/월말 데이터가 누락되던 문제를 순수 문자열 날짜 연산으로 완벽 수정.",
    ],
  },
  {
    version: "4.4",
    date: "2026-03-31",
    changes: [
      "[공지사항] 아코디언 UI 적용 및 URL 자동 링크 변환 기능 추가.",
      "[관리자] 상단 메뉴바 모바일 가로 스크롤 적용: overflow-x-auto + scrollbar 숨김으로 메뉴 잘림 없이 스와이프 가능.",
      "[관리자] 메인 컨텐츠 영역 overflow-x-hidden 적용으로 화면 전체 좌우 흔들림 차단.",
      "[광고 전환 추적] Google Ads 전체 사이트 태그(AW-17945851352) 삽입: layout.tsx head 내부에 next/script afterInteractive 전략으로 추가.",
      "[광고 전환 추적] lib/gtag.ts 추가: 전환 이벤트(AW-17945851352/CEsWCLqI4IwcENjrn-1C) 발송 trackConversion 공통 함수 생성.",
      "[광고 전환 추적] 전화문의 버튼 전환 추적 연결: ContactMapButtons, BlogContactSection, FixedCTA(데스크탑·모바일), Header(데스크탑·모바일), Footer, 수업안내 페이지, 문의 페이지의 모든 tel: 링크에 trackConversion onClick 적용.",
      "[내부] PhoneCallLink 클라이언트 컴포넌트 추가: 서버 컴포넌트(수업안내·문의 페이지)에서 onClick 전환 추적이 가능하도록 범용 전화 링크 컴포넌트 분리.",
    ],
  },
  {
    version: "4.3",
    date: "2026-03-19",
    changes: [
      "[버그 수정] 캘린더 수강생 선택 드롭다운 중복 이름 노출 버그 수정.",
    ],
  },
  {
    version: "4.2",
    date: "2026-03-16",
    changes: [
      "[성능] On-Demand Revalidation 도입: 블로그 글 생성·수정·삭제·공지 토글 시 즉시 ISR 캐시 갱신.",
      "[성능] 블로그 목록·상세·활동 갤러리 타이머 기반 revalidate 완전 제거(false) — ISR Writes 0에 수렴.",
      "[내부] app/actions/revalidate.ts Server Action 추가: revalidateBlogList, revalidateBlogPost, revalidateActivities.",
    ],
  },
  {
    version: "4.1",
    date: "2026-03-16",
    changes: [
      "[성능] ISR 재생성 주기 대폭 연장: Vercel ISR Writes 사용량 초과(1.2M/200K 한도) 해소.",
      "[활동 갤러리] revalidate 60초 → 86400초(24시간)으로 변경.",
      "[블로그 목록] revalidate 60초 → 3600초(1시간)으로 변경.",
      "[블로그 상세] revalidate 60초 → 86400초(24시간)으로 변경.",
    ],
  },
  {
    version: "4.0",
    date: "2026-03-13",
    changes: [
      "[홈페이지] Hero Section 랜딩페이지형 UI/UX 전면 개편: 뱃지 카피·H1·서브헤드 교체.",
      "[홈페이지] CTA 버튼 2개 추가: '상담 및 체험 신청하기'(/contact), '프로그램 안내 보기'(/classes).",
      "[홈페이지] 신뢰 지표 바 추가: 원장/부원장 직강, 1:1 맞춤 커리큘럼, 10년 이상 교육 노하우.",
      "[홈페이지] 이미지 스타일 개선: rounded-2xl + shadow-lg + maxHeight 420px 액자형으로 변경.",
      "[홈페이지] SEO 메타태그 title/description 랜딩페이지형으로 교체.",
    ],
  },
  {
    version: "3.9",
    date: "2026-03-13",
    changes: [
      "[홈페이지] Hero Section 전면 감성 리디자인: 뱃지(김포 프리미엄 음악 교육) → 메인 타이틀(H1) → 서브 설명 순의 시각적 위계 구조로 개편.",
      "[홈페이지] H1 카피 변경: '우리 소리의 흥겨움부터 / 클래식 성악의 깊은 울림까지' — 명조 세리프 대형 폰트(3xl~5xl), <br /> 삽입으로 두 줄 자연스러운 줄바꿈 적용.",
      "[홈페이지] 서브 설명 카피 변경 및 색상 조정: text-gray-500 회색조로 메인 타이틀 대비 위계 확보. 모바일/PC 최적 줄바꿈 처리.",
      "[홈페이지] 메인 Hero 이미지 교체: 김포문화원 야외 국악 공연 사진(KakaoTalk_20260208_124656854.jpg)을 WebP(1200×675, quality 85)로 변환하여 main_image.webp 대체.",
      "[홈페이지] figure 요소 rounded-xl + shadow-sm 적용으로 이미지 카드 느낌 강화. 전체 Hero 상하 여백(py-10 sm:py-14) 및 내부 간격 시원시원하게 조정.",
    ],
  },
  {
    version: "3.8",
    date: "2026-03-13",
    changes: [
      "[수업관리] 개인반(1:1) 1~4회차 출석 체크 로직 제거 및 단체반과 프로세스 통합: 모든 수업(개인/단체)이 월별 '결제 상태(미납부/납부완료)'와 '결제일'만 관리하는 단일 결제 플로우로 단순화. 출석 체크(✅), 취소(↩️), 갱신(🔄) 버튼 제거.",
      "[수업관리] 수업 목록 '진도' 컬럼을 '결제 상태'로 변경: 이번 달 납부완료(녹색)/미납부(빨간색) 뱃지 표시. 통계 섹션도 갱신필요/진행중 → 이번달납부완료/미납부로 개편.",
      "[수업관리] 캘린더 날짜별 수업 추가 시 개인반도 단체반과 동일하게 '결제 완료' 납부 기록 삽입. 정렬 옵션에서 '남은 횟수순' 제거.",
      "[수강생관리] 수강생 목록 상단에 '이름으로 찾기' 검색 바 추가: 실시간 필터링으로 검색어 미입력 시 전체 표시, 입력 시 즉각 목록 축소.",
      "[수강생관리] 수강생 이름 클릭 시 상세 페이지(/admin/students/[id])로 이동하도록 링크 추가.",
      "[수강생상세] 상세 페이지 대시보드 형태로 전면 개편: 요약 카드(수업상태·이번달납부·총납부횟수·등록일), 기본정보, 현재수업, 상담메모(localStorage 저장), 결제이력, 전체수업내역 섹션으로 구성.",
      "[수강생상세] 상담 메모 기능 추가: 관리자가 수강생별 상담 내용·특이사항을 메모할 수 있으며 브라우저 로컬 스토리지에 저장.",
    ],
  },
  {
    version: "3.7",
    date: "2026-03-13",
    changes: [
      "[블로그 SEO] 블로그 상세 페이지 메타 description 자동화 강화: buildExcerpt() 헬퍼 도입으로 본문 HTML 태그 제거 후 공백 정규화, 단어 경계 기준 100~140자 추출, 말줄임표(…) 자동 부착. meta_description이 직접 작성된 경우 우선 사용, 없을 때만 본문 첫 문장 자동 삽입.",
      "[GA4 전환 추적] BlogContactSection을 클라이언트 컴포넌트(components/BlogContactSection.tsx)로 분리: 전화문의(click_call)·Google 지도(click_google_map)·카카오맵(click_kakao_map) 버튼 클릭 시 GA4 이벤트 전송. window.gtag 존재 여부 방어 처리 포함. event_category: 'contact' 파라미터 공통 적용.",
      "[GA4 전환 추적] 문의 페이지(app/contact) 지도 버튼 그룹을 ContactMapButtons 클라이언트 컴포넌트로 분리, 동일한 GA4 이벤트(click_call·click_google_map·click_kakao_map) 추적. 서버 컴포넌트인 contact 페이지의 SSG 성능은 그대로 유지.",
      "[홈페이지] 메인 H1 텍스트 변경: '한국의 전통, 대한의 소리' → '김포를 대표하는 프리미엄 국악 & 성악 교육, 김포국악원' — 지역·서비스 키워드 명시로 검색 의도 일치도 향상.",
      "[홈페이지] H1 바로 아래 서브타이틀 단락 추가: '유치원·학생 국악 체험부터 어르신 민요 교실, 그리고 전공자가 직접 지도하는 1:1 성악·발성 레슨까지. 우리 소리와 서양 음악의 깊이를 한곳에서 만납니다.' — 주요 수강 대상·서비스 키워드 자연어 노출.",
    ],
  },
  {
    version: "3.6",
    date: "2026-03-12",
    changes: [
      "[SEO] 사이트 기본 제목(default title) 변경: '무형문화재 이수자 직강' → '장기동·사우동·고촌 민요·성악·국악학원'으로 지역명 및 서비스명 키워드 강화.",
      "[SEO] 루트 메타 description에 '장기동·사우동·고촌읍 인근', '민요교실·성악발성·장구' 키워드 추가.",
      "[SEO] 루트 keywords 배열 확장: 김포국악학원·김포민요교실·김포성악·장기동국악원·사우동국악원·고촌읍국악원·김포장구교실·김포체험학습 등 지역 롱테일 키워드 추가.",
      "[SEO] JSON-LD EducationalOrganization에 areaServed(장기동·사우동·고촌읍·김포시) 추가, addressLocality를 '김포시 장기동'으로 세분화.",
      "[SEO] 홈페이지(page.tsx) title·description에 '장기동·사우동·고촌읍' 지역명 삽입.",
      "[SEO] 수업 안내 페이지 title·description·keywords에 지역명 및 '김포민요교실·김포성악·성악발성·대취타체험' 키워드 강화.",
      "[SEO] 블로그·소개·문의 페이지 title 간결화 및 description에 지역명 키워드 삽입.",
    ],
  },
  {
    version: "3.5",
    date: "2026-03-12",
    changes: [
      "[문의] '문의 및 오시는 길' 페이지 지도 버튼 그룹에 '전화문의' 버튼 추가: bg-black 검은 배경·흰 글씨·전화기 아이콘 디자인. tel:01059481843 링크로 모바일에서 바로 전화 연결.",
      "[블로그] 블로그 상세 페이지 하단 BlogContactSection 지도 버튼 그룹에 동일한 '전화문의' 버튼 추가.",
      "[레이아웃] 버튼 3개 반응형 배치: 모바일에서 전화문의 버튼 전체 너비(w-full), Google·카카오 버튼은 나란히 2열 배치. 태블릿(sm) 이상에서는 3개 버튼 동일 너비 1행 배치(flex-wrap 활용).",
    ],
  },
  {
    version: "3.4",
    date: "2026-03-12",
    changes: [
      "[블로그] 표 인라인 고정 크기 완전 무력화: TinyMCE가 삽입한 table·th·td의 고정 width/height 인라인 스타일을 !important로 덮어써 모바일 세로·가로 스크롤 완전 제거. table-layout:fixed로 열 너비를 컨테이너 기준으로 균등 분배.",
      "[블로그] TinyMCE figure.table 래퍼 스크롤 제거: 에디터가 표를 감싸는 <figure class=\"table\">에 overflow:visible을 강제 적용하여 래퍼 레벨 가로 스크롤바 원천 차단.",
      "[블로그] 셀 텍스트 강제 줄바꿈: th·td에 white-space:normal·overflow-wrap:break-word 추가로 긴 텍스트나 URL이 셀 밖으로 삐져나오지 않도록 처리.",
    ],
  },
  {
    version: "3.3",
    date: "2026-03-12",
    changes: [
      "[블로그] 본문 컨테이너 폭 확장: 블로그 상세 페이지 최대 너비를 max-w-2xl(672px)에서 max-w-4xl(896px)로 확대하여 PC 화면에서 좌우 빈 공간을 줄이고 가독성 향상.",
      "[블로그] 동영상(iframe) 반응형 최적화: .blog-content 내 모든 iframe에 width:100%·height:auto·aspect-ratio:16/9를 !important로 강제 적용. TinyMCE가 삽입한 고정 width/height 속성도 무시되어 PC·모바일 어디서나 16:9 비율을 유지하며 가로 스크롤 없음.",
      "[블로그] 표(Table) 모바일 텍스트 줄바꿈 개선: th·td에 word-break:keep-all 추가. 모바일 좁은 화면에서 한국어 단어가 음절 단위로 잘리지 않고 어절 단위로 자연스럽게 줄바꿈됨.",
    ],
  },
  {
    version: "3.2",
    date: "2026-03-12",
    changes: [
      "[에디터] TinyMCE 폰트 크기 선택기 추가: 툴바에 fontsize 버튼 신설. 8px~48px 총 13단계(8·10·11·12·14·16·18·20·24·28·32·36·48)를 숫자로 직관적으로 선택 가능. PostEditor · PostModal 동일 적용.",
      "[에디터] 폰트 패밀리 목록 간소화: 프리텐다드·나눔명조·나눔고딕 3종 한글 이름으로 정리. 블로그 본문에서 실제 렌더링되는 폰트와 동일한 이름으로 통일.",
    ],
  },
  {
    version: "3.1",
    date: "2026-03-12",
    changes: [
      "[폰트] Pretendard Dynamic Subset 도입(CDN·font-display:swap): 사용된 글자만 분할 로딩하는 다이나믹 서브셋 방식을 적용하여 블로그 본문·에디터 기본 폰트로 설정. 전체 폰트 파일 대비 최소 용량으로 로딩되며 공개 LCP에 영향 없음.",
      "[폰트] Nanum Gothic next/font/google 최적화 추가: preload:false 설정으로 LCP 크리티컬 패스에서 제외하고 에디터·블로그 전용으로만 로딩. layout.tsx CSS 변수(--font-nanum-gothic) 등록.",
      "[에디터] TinyMCE 폰트 패밀리 선택기 추가: 툴바에 fontfamily 버튼 신설, 프리텐다드·나눔명조·나눔고딕·Noto Sans KR 4종 한글 이름으로 목록 표시. content_css로 에디터 iframe 내 폰트 CSS 직접 주입.",
      "[에디터] 에디터 내부 기본 폰트 → Pretendard, 제목(h1/h2/h3) → Nanum Myeongjo로 통일하여 블로그 공개 페이지와 동일한 타이포그래피 미리보기 가능.",
      "[블로그] .blog-content 본문 폰트 Pretendard로 업데이트, h1/h2/h3 제목 Nanum Myeongjo 적용 — 에디터와 독자 화면 간 폰트 일관성 확보.",
    ],
  },
  {
    version: "3.0",
    date: "2026-03-12",
    changes: [
      "[에디터 대공사] React-Quill → TinyMCE 7 전면 교체: react-quill-new · quill-html-edit-button · quill-resize-module 제거, @tinymce/tinymce-react · tinymce 도입. CDN(jsDelivr) 방식으로 admin 전용 로딩 — 공개 번들 영향 0.",
      "[표 편집 혁신] TinyMCE 내장 Table 플러그인 활성화: 마우스 드래그로 열 너비 조절(table_resize_bars), 행/열 추가·삭제 컨텍스트 메뉴, 표 속성 편집 다이얼로그. 기존 커스텀 TableEmbedBlot·드래그핸들·FloatingBar 모두 제거.",
      "[이미지 업로드] images_upload_handler로 Supabase Storage 연동 유지: 툴바 이미지 버튼 클릭 시 파일 선택 → WebP 변환 → public-media 버킷 업로드 → URL 삽입. GIF 애니메이션 원본 보존 동일 유지.",
      "[동영상 임베드] TinyMCE media 플러그인 + media_live_embeds: YouTube · 네이버TV 등 URL 붙여넣기 시 실시간 미리보기. 기존 VideoEmbedBlot 제거.",
      "[블로그 뷰어] BlogContent.tsx: ql-snow/ql-editor 래퍼 제거 → .blog-content 클래스로 교체. globals.css에서 Quill 전용 CSS 전량 제거, TinyMCE 표준 HTML 출력에 최적화된 .blog-content 스타일 신설(표·이미지·코드·iframe 반응형 포함).",
      "[성능] quill.snow.css 렌더 블로킹 임포트(blog/[id]/page.tsx) 완전 제거. 에디터 코드는 admin 진입 시만 CDN 로딩 → 공개 LCP·PageSpeed 무영향.",
      "[코드 정리] PostEditor.tsx 1,687줄 → 280줄, PostModal.tsx 670줄 → 280줄로 대폭 축소. TableEditor·VideoPopup·ImageTooltip·savedCursorIndex 등 Quill 전용 로직 전량 삭제.",
    ],
  },
  {
    version: "2.32",
    date: "2026-03-12",
    changes: [
      "[블로그 에디터] 표 아래 빈 단락 보장 강화: 표(TableEmbedBlot) 삽입 후 문서 끝에 위치할 경우 자동으로 빈 단락을 추가하여 표 아래에서 항상 이어쓸 수 있도록 수정. setSelection 호출을 setTimeout(50ms)으로 지연하여 Quill 렌더링 완료 후 커서 배치 — 표 삽입 직후 커서가 표 위로 올라가던 현상 완전 해결.",
      "[블로그 에디터] 드래그 핸들 레이아웃 수정: 기존 position:absolute top:-24px 방식이 주변 텍스트와 겹치는 문제를 해결. 핸들을 인라인(display:block, height:22px) 방식으로 변경하여 레이아웃을 깨뜨리지 않고 표 hover 시만 파란 핸들 바가 표시되도록 수정.",
      "[관리자] 외부 수입 관리 월별 캘린더 뷰 도입(/admin/income): 기존 리스트 방식을 완전 교체. ← → 버튼으로 월 이동, 월별 합계(전체·체험비·외부강의) 요약 카드 자동 표시. 날짜 셀을 클릭하면 해당 날짜 수입 상세 패널이 하단에 열리며 '이 날 추가' 버튼으로 해당 날짜를 기본값으로 등록 가능. 저장 오류 시 [object Object] 대신 Supabase 상세 메시지(error.message) 출력하도록 수정.",
      "[관리자] 대시보드 월별 실수령 총수입 카드: lesson_history 정규 수강료에 external_income(체험비·외부강의) 해당 월 합계를 더해 진짜 총수입을 표시. 카드 하단에 '정규: X원 / 외부: Y원' 출처별 분리 표기 추가. external_income 테이블 미존재 시 조용히 0 처리(빌드·런타임 오류 없음).",
    ],
  },
  {
    version: "2.31",
    date: "2026-03-12",
    changes: [
      "[블로그 에디터] 표 드래그 이동 기능 추가: TableEmbedBlot 상단에 드래그 핸들(⠿)이 표시되며, 핸들을 잡고 에디터 내 원하는 위치로 드래그하면 표가 이동함. 드래그 중에는 파란색 드롭 인디케이터 선으로 삽입 위치를 시각적으로 표시. 핸들은 표 위에 마우스를 올렸을 때만 나타나고, 저장 시 DB에는 포함되지 않음.",
      "[블로그 에디터] 커서 위치 삽입 로직 최종 강화: savedCursorIndex 초기값을 null에서 0으로 변경하여 에디터 마운트 직후에도 올바른 위치에 삽입 가능. 표 삽입 버튼 클릭 시 getSelection(true)로 강제 캡처를 먼저 시도 후 selection-change로 추적된 savedCursorIndex를 fallback으로 사용하는 이중 보장 구조 적용. stripEditorArtifacts() 함수 추가로 저장 시 드래그 핸들 등 에디터 전용 DOM 요소가 DB에 저장되지 않도록 정제.",
    ],
  },
  {
    version: "2.30",
    date: "2026-03-11",
    changes: [
      "[블로그 에디터] 수정 모드 표 데이터 보존: 게시글 수정 시 DB에서 가져온 raw <table> 태그가 Quill에 의해 삭제되던 문제 해결. preprocessContentForEditor() 함수로 초기 로딩·editorReady 시점에 모든 <table>을 .ql-table-embed 래퍼로 자동 변환하여 TableEmbedBlot으로 인식시킴.",
      "[블로그 에디터] Quill 화이트리스트 확장: Clipboard addMatcher('TABLE', ...) 추가로 붙여넣기 또는 HTML 파싱 시 <table>/<tr>/<td>/<tbody>/<thead> 태그가 Quill sanitize에 의해 제거되지 않고 table-embed 블롯으로 보존됨.",
      "[블로그 에디터] 모드 전환 안정화: 소스 모드 → 에디터 모드 전환 시 표 경고 다이얼로그 제거. preprocessContentForEditor()가 소스 HTML의 raw 표를 자동으로 ql-table-embed로 변환해 데이터 손실 없이 양방향 전환 가능.",
      "[블로그 에디터] 커서 위치에 표 삽입 완결: Quill selection-change 이벤트로 커서 위치를 지속 추적(savedCursorIndex ref). 표 삽입 버튼 클릭 시 editor blur가 먼저 일어나 getSelection()이 null을 반환하는 문제를 근본적으로 해결. TableEditor '에디터에 삽입' 클릭 시 글 맨 아래가 아닌 원래 커서 위치에 정확히 삽입됨.",
      "[블로그 에디터] 등록/수정 후 리다이렉트 안정화: 게시글 저장 후 router.push() 대신 router.replace()를 사용하여 브라우저 히스토리 스택 중복 방지 및 뒤로 가기 시 폼 재노출 문제 해결.",
      "[이미지 관리] GIF 업로드 지원: 갤러리 이미지 관리 페이지에서 GIF 파일을 업로드할 때 WebP 변환 없이 원본 그대로 보존. 애니메이션 GIF가 손상 없이 Storage에 저장되고 갤러리에 정상 노출됨. (lib/upload-image.ts의 normalizeImage도 동일하게 GIF 원본 보존 처리)",
    ],
  },
  {
    version: "2.29",
    date: "2026-03-11",
    changes: [
      "[블로그 에디터] 표 렌더링 버그 수정: 표 삽입 시 HTML 텍스트로 노출되던 문제를 해결. Quill 커스텀 BlockEmbed 블롯(TableEmbedBlot/ql-table-embed)을 등록하여 insertEmbed() 호출 시 에디터 내에서 실제 격자 형태의 표가 즉시 렌더링되도록 수정. 기존 표 편집·행/열 추가·삭제 플로팅 툴바도 새 블롯 구조에 맞게 업데이트.",
      "[블로그 에디터] 동영상 임베드 기능 추가: Quill 툴바에 '동영상(▶)' 버튼 추가. 클릭 시 URL 입력 팝업이 표시되며, YouTube(watch/shorts/youtu.be) 및 네이버TV URL을 입력하면 자동으로 embed URL로 변환. Quill 커스텀 BlockEmbed 블롯(VideoEmbedBlot/ql-video-embed)으로 에디터 내 16:9 비율 iframe 즉시 미리보기 가능.",
      "[블로그 뷰어] 동영상 CSS 개선: .ql-video-embed에 padding-bottom:56.25% 반응형 16:9 비율 적용, border-radius 8px, 검정 배경. 블로그 상세 페이지에서 유튜브·네이버TV 영상이 전체 폭으로 재생됨.",
      "[보안] sanitizeHtml 업데이트: 기존에 모든 iframe을 제거하던 로직을 개선. youtube.com/embed/ 및 tv.naver.com/embed/ 도메인의 iframe은 이벤트 핸들러만 제거 후 허용, 그 외 iframe은 기존과 동일하게 차단.",
    ],
  },
  {
    version: "2.28",
    date: "2026-03-11",
    changes: [
      "[블로그 에디터] 비주얼 표 편집기 도입: '표 삽입' 클릭 시 HTML 소스 전환 대신 실제 격자 형태의 TableEditor 컴포넌트가 에디터 영역에 인라인으로 나타남. 셀 입력, Tab 키 이동, 행×열 수 실시간 표시.",
      "[블로그 에디터] 표 도구 모음 추가: TableEditor 상단에 '+ 행 추가', '+ 열 추가', '행 삭제', '열 삭제', '초기화' 버튼 구성. 표를 클릭하면 에디터 위에 플로팅 툴바(편집, + 행, + 열, 행 삭제, 열 삭제, 표 삭제)가 표시되어 즉시 조작 가능.",
      "[블로그 에디터] 스타일 자동 적용: 첫 번째 행을 헤더로 인식해 파란 배경(#e8f0fe)·볼드 텍스트 미리보기를 TableEditor 안에서 실시간으로 확인 가능. '에디터에 삽입' 클릭 시 김포국악원 스타일 table HTML 자동 생성.",
      "[블로그 에디터] 표 감지 배너: 에디터 모드에서 content에 표가 포함된 경우 amber 배너를 표시하여 '표 편집' 버튼으로 바로 TableEditor를 열 수 있도록 개선.",
      "[블로그 에디터] 소스 모드 표 경고: 소스 모드에서 에디터 모드로 전환 시 표가 포함된 경우 확인 다이얼로그를 표시해 데이터 손실 방지.",
    ],
  },
  {
    version: "2.27",
    date: "2026-03-11",
    changes: [
      "[수업 안내] 성악 발성반 UI 통일: 기존 카드형(grid) 레이아웃을 제거하고 민요 정규반과 동일한 ClassRow 리스트/테이블 형식으로 변경. '성악 개인 레슨(부원장 직강 / 1:1 맞춤형, 200,000원/1시간)'과 '성악 소그룹 반(왕초보 환영 / 기초 발성, 주 1회 단체 수업, 100,000원/월)' 2개 행으로 구성.",
    ],
  },
  {
    version: "2.26",
    date: "2026-03-11",
    changes: [
      "[블로그] 표(Table) 삽입 기능 추가: 에디터 하단에 '⊞ 표 삽입' 버튼을 추가하여 3×2 기본 HTML 표 템플릿을 HTML 소스 모드로 즉시 삽입 가능. HTML 소스 모드 진입 시에는 현재 커서 위치에 정확히 삽입되며, 에디터 모드에서 클릭하면 소스 모드로 전환 후 콘텐츠 끝에 표 삽입.",
      "[블로그] 표 스타일 개선: .ql-editor 내 table/th/td 에 border-collapse, 헤더 배경(#e8f0fe), 짝수 행 음영, hover 강조, 모바일 가로 스크롤 등 접근성·가독성 중심 CSS 적용. 에디터와 블로그 뷰어 모두 동일한 스타일로 WYSIWYG 동기화.",
      "[공지사항] is_notice 컬럼 기반 공지 상단 고정 기능 구현: Supabase posts 테이블에 is_notice BOOLEAN(DEFAULT false) 컬럼 추가 마이그레이션(migrations/add-is-notice-to-posts.sql) 제공.",
      "[공지사항] 관리자 소식 관리 페이지에 '공지' 체크박스 컬럼 추가: No. 컬럼 옆에 체크박스를 배치하여 클릭 한 번으로 공지 설정·해제 토글 가능. 공지 글은 행 배경색(amber-50)으로 시각 구분, 제목 좌측에 빨간 '공지' 배지 표시. 페이지 새로고침 없이 로컬 상태 즉시 반영.",
      "[공지사항] 사용자 블로그 목록 페이지에서 공지 글 최상단 고정: 탭(음악교실/국악원소식) 필터와 무관하게 공지 글을 항상 상단에 표시. 왼쪽 amber 보더라인과 배경색으로 일반 글과 시각 구분, 번호 위치에 빨간 '공지' 배지 표시. DB 쿼리에서도 is_notice DESC → published_at DESC 이중 정렬 적용.",
    ],
  },
  {
    version: "2.25",
    date: "2026-03-11",
    changes: [
      "[수업 안내] 성악 발성반 신설: 한양대 성악과 출신 부원장의 전문성을 강조하는 홍보 문구와 함께 '2. 성악 발성반' 섹션 추가. 개인 레슨(200,000원/1시간)과 단체 수업(100,000원/월) 수강료를 카드형 레이아웃으로 시각적으로 구분하여 표시.",
      "[수업 안내] 국악문화체험 순번 조정: 기존 '2. 국악 문화 체험'을 '3. 국악 문화 체험'으로 변경하여 성악 발성반 신설에 따른 섹션 순서 재배치.",
      "[수업 안내] 문의 채널 확장: 기존 네이버 예약·카카오톡 상담 버튼에 '전화 & 문자하기(010-5943-1843)' 버튼(tel: 링크)을 추가. 3개 버튼을 가로 나열(flex-row) 방식으로 균형 있게 배치하여 즉각적인 전화·문자 문의 경로 제공.",
    ],
  },
  {
    version: "2.24",
    date: "2026-03-11",
    changes: [
      "[이미지 관리] 마스터 카테고리 UI 추가: 관리자 업로드 페이지 상단에 [공연 / 체험 / 수업] 3개 토글 버튼을 배치하여, 사진 선택 전에 카테고리를 미리 지정할 수 있도록 개선. 같은 버튼 재클릭 시 선택 해제(토글), 선택 시 안내 문구 표시.",
      "[이미지 관리] 대량 카테고리 일괄 적용: 마스터 카테고리를 선택한 뒤 여러 장을 동시에 업로드하면 모든 사진의 category 필드에 해당 값이 자동 적용됨. 기존 개별 텍스트 입력 방식(category 칸)을 버튼 방식으로 대체하여 실수 없는 대량 업로드 지원.",
      "[이미지 관리] 사후 편집 패널 카테고리 개선: 이미지 클릭 시 열리는 수정 패널에서도 [공연 / 체험 / 수업] 빠른 선택 버튼 제공, 직접 입력 텍스트 필드와 병행 사용 가능.",
      "[활동 갤러리] 카테고리 필터 버튼 추가: 공개 활동 갤러리(/activities) 상단에 [전체 / 공연 / 체험 / 수업] 필터 버튼을 배치하여 원하는 카테고리 사진만 선별 조회 가능.",
      "[활동 갤러리] 필터 전환 애니메이션: 버튼 클릭 시 200ms fade-out → 필터 적용 → fade-in 순서의 부드러운 전환 애니메이션 구현. Masonry 2열 레이아웃 및 ISR(revalidate=60) 캐시 정책은 기존 그대로 유지.",
      "[이미지 관리] 관리자 목록 필터 추가: '저장된 이미지' 섹션 상단에 [전체 / 공연 / 체험 / 수업] 필터 버튼 추가. 카테고리별 이미지 수 배지 표시, 필터 전환 시 수정 패널 자동 닫힘. 전체 선택 버튼도 현재 필터 범위 내 항목만 선택/해제.",
      "[이미지 관리] 인라인 수정 UI로 개선: 화면 맨 아래에 표시되던 수정 패널을 선택한 카드 바로 뒤(col-span-full)에 인라인으로 배치. 스크롤 이동 없이 해당 사진 근처에서 즉시 caption·category 수정 가능.",
      "[이미지 관리] 다중 이미지 일괄 수정(Bulk Edit) 기능 추가: 체크박스로 여러 이미지를 선택한 뒤 상단 [N개 일괄 수정] 버튼을 클릭하면 Caption·Category를 한 번에 수정할 수 있는 일괄 수정 패널이 표시됨. 체크박스로 수정 항목(Caption·Category) 개별 선택 가능, Supabase .in('id', selectedIds) 쿼리로 선택된 모든 행을 단일 UPDATE 요청으로 처리. 저장 중 스피너 로딩 표시 및 완료 후 선택 해제 자동 처리. 개별 인라인 수정과 충돌 없이 독립 동작.",
    ],
  },
  {
    version: "2.23",
    date: "2026-03-11",
    changes: [
      "이미지 관리 페이지 전면 개편: '업로드 현황' 별도 섹션을 제거하고 업로드 진행 상태를 '저장된 이미지' 그리드 상단에 통합. 업로드 완료 후 목록 갱신 시 업로드 카드 자동 소멸.",
      "다중 삭제 기능 추가: 갤러리 이미지에 체크박스 추가, '전체 선택/해제' 토글, 선택된 항목 수 표시 삭제 버튼. Supabase Storage remove(array) + DB .in('id', [...]) 동시 삭제.",
      "사후 편집 기능 추가: 갤러리 이미지 카드 클릭 시 하단에 Caption·Category 수정 패널 표시. [수정 완료] 클릭 시 gallery 테이블 UPDATE 후 로컬 상태 즉시 반영(재로딩 없음).",
      "SEO 최적화: 수정된 Caption이 해당 이미지의 alt 속성에 즉시 반영되도록 로컬 상태 동기화 처리.",
    ],
  },
  {
    version: "2.22",
    date: "2026-03-10",
    changes: [
      "관리자 상단 메뉴 개편: '회원승인' 메뉴 제거, 메뉴 순서를 [Home, 공지사항, 회원관리, 수업관리, 소식관리, 이미지]로 재배치.",
      "관리자 대시보드 '승인 대기 중' 위젯 클릭 시 승인 대기 회원 목록 팝업(Modal) 표시, 모달 내에서 직접 승인/거절 처리 가능.",
      "신규 '이미지' 관리 페이지 추가: 다중 파일 선택, browser-image-compression을 이용한 자동 WebP 변환 및 용량 최적화, Supabase Storage(images 버킷) 업로드. 업로드 진행 상태(변환 중/업로드 중/완료/실패) UI 피드백 및 저장된 이미지 갤러리(URL 복사/삭제) 제공.",
    ],
  },
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
