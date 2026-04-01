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

### Fonts
- **NEVER** use `@import` for heavy web fonts in `globals.css`.
- **ONLY** use `next/font/google` for global fonts (Noto Sans KR, Noto Serif KR).
- Heavy fonts (Gowun Dodum, Nanum Myeongjo, etc.) live in `lib/fonts.ts` and are imported **only** where needed (e.g., PostModal, blog detail viewer).

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

### CSS Inlining
- `next.config.ts` must have `experimental.inlineCss: true` to reduce render-blocking CSS.

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


