# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # 개발 서버 (Turbopack)
npm run build     # 프로덕션 빌드
npm run start     # 프로덕션 서버
npm run lint      # ESLint 실행
ANALYZE=true npm run build  # 번들 분석
```

환경 변수는 `.env.local`에 설정 (`.env.local.example` 참고):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 아키텍처

**스택**: Next.js (App Router) + TypeScript + Tailwind CSS + Supabase

### 인증 & 권한 흐름

`middleware.ts`에서 모든 라우트 보호를 담당한다.

- **공개 라우트**: `/`, `/intro/*`, `/blog/*`, `/classes`, `/activities`, `/contact`, `/Song-Ri-Gyel`, `/Park-Jun-Yeol`, `/login`
- **회원 전용** (`status = 'active'`): `/notices`, `/gallery`, `/materials`, `/my-lessons`
- **관리자 전용** (`role = 'admin'` + `status = 'active'`): `/admin/*`
- `pending` 상태 사용자 → `/waiting` 리다이렉트

### Supabase 클라이언트

- `lib/supabase/client.ts` — 브라우저용 (Client Component에서 사용)
- `lib/supabase/server.ts` — 서버용 (Server Component / Route Handler에서 사용)

Server Component에서 DB를 직접 조회할 때는 반드시 `server.ts`의 `createClient()`를 사용한다.

### DB 주요 테이블

| 테이블 | 설명 |
|--------|------|
| `profiles` | 유저 정보 + 수강 정보 통합 관리. (`class_name`, `tuition`, `payment_date`, `current_session`, `role`, `status`) |
| `attendance` | 출석/수업 캘린더 기록. (`user_id`, `date`, `status`, `memo`) |
| `posts` | 블로그, 소식, 공지사항 게시판 (`title`, `content`, `category`, `thumbnail_url`) |
| `gallery` | 갤러리 이미지 |

*참고: 현재 별도의 `lessons` 테이블 없이 `profiles` 테이블에 1:1로 수강 정보가 통합되어 있음.*
*모든 테이블에 RLS 적용. 어드민은 전체 접근, 일반 유저는 자신의 데이터만 조회 가능.*

SQL 스키마 파일: `database-schema.sql`, `FIX_*.sql`, `UPDATE_*.sql` (Supabase SQL Editor에서 직접 실행)

### 디자인 시스템

- **색상**: 한지 톤 (`hanji-*`), 잉크 (`ink`), 포인트 (`accent`) — Tailwind 커스텀 색상
- **폰트**: Noto Serif KR (제목), Noto Sans KR (본문)
- **UI 라이브러리**: Headless UI + Tailwind CSS
- **애니메이션**: framer-motion 사용

### 이미지 스토리지

Supabase Storage `public-media` 버킷 사용. `site/`, `teachers/`, `gallery/` 경로.
`next.config.ts`에 Supabase 호스트(`zvwukvwtunqfptanctuc.supabase.co`) 허용 설정 포함.
