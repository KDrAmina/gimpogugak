# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 1. Project Overview & Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Database & Auth:** Supabase (PostgreSQL, RLS, Auth)
- **Styling:** Tailwind CSS
- **Domain:** Gimpo Gugak Center (김포국악원) — Public Website & Admin Dashboard

**Key Directories:**
- `app/` — App Router pages (blog, admin, intro, etc.)
- `components/` — Reusable UI (PostModal, Navbar, etc.)
- `lib/` — Utilities (supabase, fonts, date-utils, changelog)

---

## 2. Strict Performance & SEO Rules (CRITICAL)

These rules MUST be followed to maintain PageSpeed scores and avoid regressions.

### Fonts (2026-08-15 개정 — Phase 1 성능 회귀 수정)
- **NEVER** use `@import` for heavy web fonts in `globals.css`.
- **NEVER** declare `next/font/google` or `next/font/local` in `app/layout.tsx`.
  한글 웹폰트 1종이 `@font-face` 92~372개를 **모든 라우트**의 CSS에 싣는다.
  실측: 5종 선언 시 `@font-face` 1,214개 / 683 KB.
- **NEVER** commit a whole (non-subset) Korean font such as `PretendardVariable.woff2` (2.0 MB).
  `unicode-range`가 없어 한 글자를 그리려고 전체를 받아야 하고, `next/font`가 최고 우선순위
  `Link: rel=preload`를 걸어 LCP 이미지와 대역폭을 다툰다.
- **Pretendard**: `public/fonts/pretendard-1.3.9/` 자체 호스팅 **variable dynamic subset**
  (공식 v1.3.9 배포본, 92 조각). `app/layout.tsx`가 `<link rel="stylesheet">`로 로드하며
  패밀리명은 `'Pretendard Variable'`. Tailwind `fontFamily.sans`가 이를 가리킨다.
- **라우트 전용 폰트**는 그 라우트에서만 선언한다. 예: Nanum Myeongjo → `app/blog/[id]/page.tsx`.
- **에디터 폰트**는 `PostEditor.tsx` / `PostModal.tsx`의 `content_css`로 iframe 내부에만 주입한다.
- 이 규칙들은 `scripts/check-font-regression.mjs`가 `prebuild`에서 강제한다.

### React-Quill & Lazy Loading
- `React-Quill` and `quill.snow.css` **MUST** be lazy-loaded via `next/dynamic` with `ssr: false`.
- Import Quill CSS **ONLY** in:
  - `components/PostModal.tsx`
  - `app/blog/[id]/page.tsx`
- **Global import** of `quill.snow.css` in `layout.tsx` or `globals.css` is **strictly forbidden** (causes render-blocking).

### Rendering & Caching
- Public list pages (Blog, Activities) use **SSG/ISR**:
  - `export const revalidate = 60`
  - `export const dynamic = "force-static"` (for blog list)
- Do **NOT** fetch dynamically on the client for public list data unless necessary (e.g., auth-gated notices).

### LCP (Largest Contentful Paint)
- The main hero image **MUST** use the `priority` attribute:
  ```tsx
  <Image src="/main_image.webp" alt="..." priority sizes="100vw" className="object-cover" />
  ```

### Viewport & Accessibility
- Do **NOT** set `userScalable: false` or `maximumScale: 1` in viewport config (breaks Accessibility score).

### CSS Inlining (2026-08-15 개정 — 규칙 반전)
- `next.config.ts`는 `experimental.inlineCss: **false**` 여야 한다.
- 이유: 인라인 CSS는 `<style>` 블록과 RSC flight payload에 **각각 한 번씩 2중 직렬화**되고
  외부 stylesheet를 0개로 만들어, 페이지 이동·재방문마다 전량 재전송·재파싱된다.
  실측(`/intro` 문서): `true` 162,451 B → `false` **28,216 B**.
- CSS가 수 KB 수준으로 줄어들면 재검토할 수 있으나, 그때도 반드시 문서 크기를 실측할 것.

---

## 3. Editor (React-Quill) Conventions

### Blog Detail Viewer
- Tailwind's `prose` class is **strictly banned** in the blog detail content wrapper — it collapses line breaks.
- Use **only** Quill's native viewer classes:
  ```tsx
  <div className="ql-snow">
    <div className="ql-editor" dangerouslySetInnerHTML={{ __html: post.content }} style={{ padding: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }} />
  </div>
  ```

### Line Breaks & Paragraphs
- Custom `!important` CSS overrides in `globals.css` force Quill line breaks and paragraph margins.
- Do **NOT** remove or weaken these overrides; Tailwind preflight would otherwise collapse empty paragraphs.

### Font Sizes
- Font sizes use **explicit numerical pixel values** (10px, 12px, 14px, 16px, 18px, 20px, 24px, 28px, 32px, 36px) via inline styles.
- The SizeStyle attributor (`attributors/style/size`) is registered with a whitelist; default classes (small, large, huge) are not used.

### Custom Fonts in Editor
- Custom fonts (Gowun Dodum, Nanum Myeongjo) are scoped **locally** using CSS variables.
- Apply font variables only to the editor/viewer wrapper divs, not globally.
- Font whitelist: `['gowunDodum', 'nanumMyeongjo']` — defined in `PostModal.tsx` and mapped in `globals.css`.

---

## 4. Recent Business Logic States

### Blog List
- **Simplified UI:** Text and date only, matching the Press Release (언론 보도) style.
- Structure: Title (left) | Dotted border (middle) | Date `YY.MM.DD` (right).
- No thumbnails, no content snippets. Whole row is a clickable `Link`.

### Class Management (수업관리)
- **Progress (진도) logs:** Must display the date of each progress entry (e.g., `YY.MM.DD` or `YYYY년 MM월 DD일`).
- **Cancel Class (수업취소):** When "↩️ 취소" (undo) is clicked, the Calendar must update immediately — `loadLessonHistory()` is called and `selectedDateLessons` is synced.
- **Calendar Delete Button:** The Daily Schedule modal includes a "삭제" (Delete) button per event. On confirm, the record is deleted from `lesson_history`, `lessons.current_session` is decremented, and the calendar is refreshed.

### Database
- `lessons` — Per-student lesson records (user_id, category, current_session, is_active, payment_date).
- `lesson_history` — Attendance/session records (lesson_id, session_number, completed_date).
- RLS: Admins manage all; users view own data.

---

## 5. Commands & Environment

```bash
npm run dev       # 개발 서버 (Turbopack)
npm run build     # 프로덕션 빌드
npm run start     # 프로덕션 서버
npm run lint      # ESLint 실행
ANALYZE=true npm run build  # 번들 분석
```

**Environment variables** (`.env.local`):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 6. Auth & Routes

- **Public:** `/`, `/intro/*`, `/blog/*`, `/classes`, `/activities`, `/contact`, `/login`
- **Member-only** (`status = 'active'`): `/notices`, `/gallery`, `/materials`, `/my-lessons`
- **Admin-only** (`role = 'admin'` + `status = 'active'`): `/admin/*`
- `pending` users → `/waiting`

---

## 7. Supabase Clients

- `lib/supabase/client.ts` — Browser (Client Components)
- `lib/supabase/server.ts` — Server (Server Components, Route Handlers)

Use `server.ts` for Server Component DB queries.

---

## 8. Version & Changelog

- Version and changelog live in `lib/changelog.ts`.
- All `changes` entries must be in **Korean**.
- Increment version for each significant change.
