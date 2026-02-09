# 김포국악원 홈페이지

Next.js 14 (App Router) + TypeScript + Tailwind CSS + Supabase 기반 김포국악원 공식 사이트입니다.

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.local.example`을 복사해 `.env.local`을 만들고 Supabase·연락처 값을 채웁니다.

```bash
cp .env.local.example .env.local
```

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 으로 접속합니다.

### 4. Supabase 설정

- [Supabase](https://supabase.com) 프로젝트 생성 후, 기획서에 포함된 SQL을 SQL Editor에 붙여 넣어 테이블·RLS·정책을 생성합니다.
- Storage에 `public-media` 버킷을 만들고 `site/`, `teachers/`, `gallery/` 경로를 사용할 수 있습니다.
- `.env.local`에 `NEXT_PUBLIC_SUPABASE_URL`과 `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 설정합니다.

## 프로젝트 구조 (사이트맵 기준)

```
app/
├── layout.tsx          # 전역 레이아웃 (헤더·푸터·Fixed CTA)
├── page.tsx            # 홈 /
├── about/page.tsx      # 국악원 소개 /about
├── teachers/page.tsx   # 강사진 /teachers
├── classes/page.tsx   # 수업 안내 /classes
├── notices/
│   ├── page.tsx        # 공지 목록 /notices
│   └── [slug]/page.tsx # 공지 상세 /notices/[slug]
├── gallery/
│   ├── page.tsx        # 갤러리 목록 /gallery
│   └── [id]/page.tsx   # 갤러리 상세 /gallery/[id]
├── booking/page.tsx    # 공연·섭외 /booking
├── contact/page.tsx    # 문의·오시는 길 /contact
├── privacy/page.tsx    # 개인정보처리방침 /privacy
└── admin/
    ├── layout.tsx
    ├── login/page.tsx   # /admin/login
    ├── notices/page.tsx # /admin/notices
    ├── gallery/page.tsx # /admin/gallery
    ├── teachers/page.tsx # (선택) /admin/teachers
    └── classes/page.tsx  # (선택) /admin/classes

components/
└── layout/
    ├── Header.tsx   # 로고 + 메뉴 + 전화/카톡 CTA
    ├── Footer.tsx   # 링크 + 연락처 + 주소
    └── FixedCTA.tsx # 모바일 하단 바 / 데스크톱 플로팅 버튼

lib/
└── supabase/
    ├── client.ts  # 브라우저용 Supabase 클라이언트
    └── server.ts  # 서버용 Supabase 클라이언트
```

## 디자인 (Modern Korean)

- **색상**: 한지 톤(`hanji-50`~`900`), 잉크(`ink`), 포인트(`accent`)
- **폰트**: Noto Serif KR(제목), Noto Sans KR(본문)
- **레이아웃**: 여백·얇은 구분선·절제된 패턴/그라데이션
- **CTA**: 전화/카톡 버튼을 헤더·푸터·모바일 하단 고정 바·플로팅으로 반복 노출

## 스크립트

| 명령어      | 설명           |
|------------|----------------|
| `npm run dev`   | 개발 서버 (Turbopack) |
| `npm run build` | 프로덕션 빌드   |
| `npm run start` | 프로덕션 서버   |
| `npm run lint`  | ESLint 실행    |
