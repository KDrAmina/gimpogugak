# 김포국악원 Phase 3A — Dynamic Rendering · Cache · 예약발행 · Middleware READ-ONLY 구조 감사

- **대상**: `https://gimpogugak.com` (Production) + 저장소 `C:\Users\JUN\gimpo-gugak` (branch `main`)
- **감사 일시**: 2026-08-15
- **감사 유형**: READ-ONLY. 소스/설정/DB/배포 **일체 미변경** (본 보고서 파일 1개만 신규 생성)
- **감사 시작·종료 HEAD**: `eba9320` (변동 없음)
- **선행 문서**: `KIMPO_GUGAK_PERFORMANCE_READONLY_AUDIT.md`, `KIMPO_GUGAK_PHASE1_FONT_REMEDIATION_REPORT.md`, `KIMPO_GUGAK_PHASE2_HERO_LCP_REMEDIATION_REPORT.md` (3건 모두 열람)
- **최종 판정**: ✅ **PASS** — 최종 추천: **A. ISR RECOMMENDED** (§17, §24)

증거 등급: `MEASURED`(실측) / `CODE-CONFIRMED`(코드 확인) / `DOC-CONFIRMED`(공식 문서) / `INFERRED`(추론) / `NOT VERIFIED`·`NOT MEASURED`(미확인)

---

## 1. Executive Summary

### 결론 4줄

1. **홈 `/`가 Dynamic인 직접 원인은 단 하나 — `lib/supabase/server.ts:5`의 `await cookies()`다.** `new Date()`도, middleware도, Supabase SDK도 아니다. 임시 worktree 사본에서 cookie 클라이언트만 cookie-free 클라이언트로 교체하자 `/`가 `ƒ` → `○ (Static, revalidate 1m)`으로 뒤집혔다(`MEASURED`, §6.3).
2. **Middleware는 렌더링 분류와 무관한 순수 TTFB 비용이며, 익명 사용자에게는 그 비용조차 작다.** `auth.getUser()`는 세션 쿠키가 없으면 **네트워크 왕복 없이** 조기 반환한다(`CODE-CONFIRMED`, §8.2).
3. **예약발행은 "시간 술어" 방식이다.** `.lte("published_at", now)`가 쿼리 시점마다 평가되므로 DB 업데이트·운영자 조작·크론 없이 시간만 지나면 공개된다. 과거 두 회귀(`3ee6d03`, `0c172be`)는 모두 **상세 페이지의 404 음성 캐시 + `revalidate=false`(영구 캐시)** 조합에서 터졌고, 홈 같은 **목록 표면에는 그 실패 모드가 구조적으로 존재하지 않는다**(§10).
4. **최종 추천은 홈 ISR 60초 전환(A)이다.** `/blog`가 `0c172be`에서 이미 채택해 13개월째 검증된 것과 동일한 계약이며, 조기노출은 구조적으로 불가능하고, 노출 지연은 이미 제품이 수용한 "최대 1분 내" 수준이다. 단, **수동 즉시발행의 홈 반영 시점이 "즉시 → 최대 ~1분"으로 약화되므로 `revalidatePath("/")` 훅 추가와 대표 승인(§17.3)을 조건으로 한다.** Middleware 최적화는 **독립된 별도 Phase(3B-2)** 로 분리한다.

### 이번 감사에서 새로 확정된 사실

| # | 사실 | 등급 |
|---|---|---|
| 1 | cookie 클라이언트 → cookie-free 교체만으로 `/`가 `○ 1m/1y`로 전환됨 (worktree 인과 실험) | `MEASURED` |
| 2 | `new Date()`는 정적 빌드에 그대로 남아도 분류에 영향 없음 (`/blog`·`/blog/[id]`·실험 빌드 3중 확인) | `MEASURED` |
| 3 | 익명 `getUser()`는 Supabase Auth 서버 왕복 없이 `AuthSessionMissingError` 조기 반환 | `CODE-CONFIRMED` |
| 4 | `/blog`에서 `X-Vercel-Cache: STALE` 실측 — Vercel 시간 기반 재검증의 stale-while-revalidate 동작 확인 | `MEASURED` |
| 5 | `revalidatePath("/")`는 코드베이스 어디에도 없음 — 홈이 Dynamic이라 지금까지 불필요했음 | `CODE-CONFIRMED` |
| 6 | middleware matcher가 `.css`/`.woff2`를 제외하지 않아 폰트 서브셋 요청도 middleware를 통과 | `CODE-CONFIRMED` |
| 7 | `ƒ /sitemap.xml` — sitemap도 같은 cookie 클라이언트 때문에 Dynamic | `MEASURED` |
| 8 | 저장소에 테스트 스위트가 전무 — 과거 두 회귀를 막을 안전망 자체가 없었음 | `MEASURED` |

---

## 2. Git / Repository Baseline (`MEASURED`)

```
$ git status                → working tree clean (기존 변경 없음)
$ git branch --show-current → main
$ git rev-parse HEAD        → eba9320ccae41468f9f5a73f72faaf0543417d85
```

| 질문 | 답 | 근거 |
|---|---|---|
| 현재 HEAD | `eba9320` — "docs: Phase 2 히어로/LCP 이미지 성능 회귀 수정 보고서 추가" | `git rev-parse` |
| `464ee1e` 존재? | 존재. **HEAD의 직계 부모**이자 Phase 2 코드 커밋 (v5.25.0) | `git log`, `merge-base --is-ancestor` |
| `eba9320` 존재? | 존재. HEAD 그 자체 — Phase 2 **보고서 문서 전용 커밋** | 동일 |
| 두 커밋 관계 | `464ee1e`(코드) → `eba9320`(문서). Phase 2 보고서의 "코드 결과 HEAD 464ee1e" 기술과 정합 — **모순 없음** | `MEASURED` |
| `3ee6d03` / `0c172be` | 둘 다 존재, HEAD의 조상 (2026-04-27 / 2026-07-12) | `git cat-file`, `git log` |
| `reports/` tracking | tracked (Phase 1 문서 커밋 `d7cb350` 이후) | `git ls-files` |
| 기존 tracked/untracked 변경 | **없음** — reset/revert 수행 안 함 | `git status` |

**버전 기준선** (`MEASURED`, package-lock.json 실측): Next.js **16.1.6** (Turbopack), React **18.3.1**, `@supabase/ssr` **0.5.2**, `@supabase/supabase-js` **2.95.3**. App Router. `experimental.optimizePackageImports`만 활성, `cacheComponents`/PPR **미사용**. 빌드 시 "middleware convention is deprecated. use proxy instead" 경고 존재.

---

## 3. Production Baseline (`MEASURED`, 2026-08-15)

### 3.1 홈 `/` — 8회 연속 GET

| 회차 | TTFB | X-Vercel-Cache |
|---|---:|---|
| 1 | **1.431 s** | MISS |
| 2 | 0.372 s | MISS |
| 3 | 0.336 s | MISS |
| 4 | 0.326 s | MISS |
| 5 | 0.356 s | MISS |
| 6 | 0.303 s | MISS |
| 7 | 0.294 s | MISS |
| 8 | 0.315 s | MISS |

- `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` / `Age: 0` / `Server-Timing` 없음 / brotli 11,957~12,009 B (Phase 2 실측 11,960 B와 정합)
- **MISS 8/8 — CDN 캐시 0%.** 선행 감사(MISS 4/4)와 동일. 1회차 1.43 s는 콜드 경로(연결 수립 + 콜드 함수 추정, `INFERRED`)의 tail을 보여준다. 선행 감사에서는 2.59 s까지 관측됐다.

### 3.2 Static 공개 라우트 대조 (각 3회)

| 라우트 | TTFB (1→3회) | X-Vercel-Cache | Cache-Control |
|---|---|---|---|
| `/intro` | 0.462 → 0.226 → 0.218 s | PRERENDER → HIT → HIT | `public, max-age=0, must-revalidate` |
| `/classes` | 0.572 → 0.243 → 0.240 s | PRERENDER → HIT → HIT | 동일 |
| `/blog` | 0.223 → 0.396 → 0.279 s | **STALE** → HIT → HIT | 동일 |
| `/blog/[id]` (기존 글 1건) | 0.510 s | PRERENDER | 동일 |
| `/sitemap.xml` | 1.379 s | **MISS** | `public, max-age=0, must-revalidate` |

**구조적 차이 판독:**

1. **워밍 상태 기준 홈 MISS(≈0.30~0.37 s) vs 정적 HIT(≈0.22~0.24 s) — 격차 약 +70~130 ms.** Vercel에서 middleware는 캐시 조회 **앞**에서 실행되므로 정적 HIT의 0.22 s에도 middleware 실행이 이미 포함돼 있다. 따라서 이 격차는 middleware가 아니라 **함수 호출 + SSR + Supabase 쿼리 2건**의 몫이다.
2. **홈의 진짜 손실은 평균이 아니라 tail이다.** HIT 라우트는 콜드 함수 스파이크가 없지만, 홈은 매 요청 함수 실행이라 1.4~2.6 s 스파이크(본 감사 1회차 + 선행 감사)가 실사용자에게 그대로 노출된다.
3. **`/blog`의 `STALE`은 살아있는 SWR 증거다.** 60초 창이 지난 첫 요청이 이전 캐시본을 즉시 받고(0.223 s) 백그라운드 재생성이 돌았다 — §12의 지연 분석이 실측으로 뒷받침된다.

---

## 4. Next.js Rendering Baseline (`MEASURED`)

로컬 production build (`npm run build`, prebuild 폰트 가드 통과 후) 재현:

```
┌ ƒ /                      ← 유일한 Dynamic 공개 페이지
├ ○ /blog        1m  1y
├ ● /blog/[id]   1m  1y    (+71 paths, generateStaticParams)
├ ○ /activities  ○ /intro  ○ /classes  ○ /contact ...
├ ƒ /sitemap.xml           ← 신규 확인
├ ƒ /notices/[slug], ƒ /admin/students/[id], ƒ /api/* (force-dynamic)
ƒ Proxy (Middleware)
```

`.next/prerender-manifest.json` 대조 (`MEASURED`):

- `routes["/"]` → **부재** (prerender 대상 아님)
- `routes["/blog"]` → `initialRevalidateSeconds: 60, initialExpireSeconds: 31536000`
- `routes["/blog/<slug>"]` → 동일 (60 / 1y)
- `routes["/intro"]` → `initialRevalidateSeconds: false` (순수 Static)

즉 `app/page.tsx:25`의 `export const revalidate = 60`은 **현재 완전히 무력** — 라우트가 Dynamic으로 분류되는 순간 시간 기반 재검증 대상 자체에서 빠진다(§32 답변).

---

## 5. Home Request / Data Flow (`CODE-CONFIRMED`)

```
Request
  ↓
Vercel Edge (PoP → icn1)
  ↓
middleware.ts  ← matcher가 "/" 매칭 (§8)                 [request-specific / 캐시조회 앞단 / 분류 무관]
  ├ createServerClient(request.cookies)
  ├ await supabase.auth.getUser()      익명: in-process 조기반환(무왕복) / 회원: Auth 왕복
  ├ (user 존재 시) profiles 1쿼리       회원만
  └ "/"에 대해서는 어떤 분기도 발동하지 않고 NextResponse.next()
  ↓
[CDN 캐시 조회] → "/"는 no-store라 항상 BYPASS/MISS       [★ 캐시 불가의 발현 지점]
  ↓
Vercel Function 호출 (매 요청)
  ↓
app/layout.tsx  RootLayout [Server]                       [정적 콘텐츠만 — 동적 API 없음]
  ↓
app/page.tsx  HomePage [Server, async]
  ├ :25  export const revalidate = 60                     [무력화 상태]
  ├ :44  await createClient()
  │        └ lib/supabase/server.ts:5  await cookies()    [★★ Dynamic 분류의 유일한 trigger]
  ├ :48  Promise.all([gallery 4건, posts 5건])            [병렬 — 순차 아님 (§29)]
  │        └ posts: .lte("published_at", new Date().toISOString())   [예약발행 필터 — 분류 무관]
  └ RSC 직렬화 → 응답
  ↓
Cache-Control: private, no-cache, no-store  /  X-Vercel-Cache: MISS
```

단계별 판정:

| 단계 | request-specific | cacheable | Dynamic 분류 영향 | TTFB 영향 |
|---|---|---|---|---|
| middleware | ✅ (쿠키 읽음) | 해당 없음 (캐시 앞단) | **없음** (§8.1) | 익명 소량 / 회원 왕복 2회 |
| `cookies()` (page) | ✅ | ✖ | **✅ 유일 원인** | — |
| Supabase 쿼리 2건 | ✖ (익명 anon key, 세션 무관) | 이론상 가능 | 없음 | 병렬 1왕복 몫 |
| `new Date()` | ✖ (분류 관점) | — | **없음** | — |
| RSC 직렬화 | — | Dynamic이라 불가 | — | 소량 |

---

## 6. Direct Dynamic Trigger — 증거 3중 확정

### 6.1 코드 전수 조사 (`CODE-CONFIRMED`)

`app/` + `lib/` + `components/` 전체에서 Dynamic API를 전수 grep한 결과:

- `cookies()` 호출: **`lib/supabase/server.ts:5` 단 1곳.** 홈 트리에서의 유일한 소비자는 `app/page.tsx:44`의 `createClient()`.
- `headers()` / `draftMode()` / `connection()` / `unstable_noStore` / `fetch(..., no-store)` 명시 / `searchParams` prop / `dynamic = "force-dynamic"`(홈): **전무.** (`force-dynamic`은 admin·api 라우트에만 존재)
- `app/layout.tsx`: 정적 metadata·폰트 link·Script뿐 — 동적 API 없음.

### 6.2 저장소 내 자연 대조군 (`MEASURED` — 현행 빌드)

| 라우트 | cookie 클라이언트 | `new Date()` | middleware 매칭 | `force-static` | 빌드 분류 |
|---|---|---|---|---|---|
| `/` | ✅ | ✅ | ✅ | ✖ | **ƒ Dynamic** |
| `/sitemap.xml` | ✅ | ✅ | ✅ | ✖ | **ƒ Dynamic** |
| `/blog` | ✅ (동일 `createClient`) | ✅ | ✅ | **✅** | **○ Static (1m)** |
| `/blog/[id]` | ✖ (`createClientForBuild`) | ✅ | ✅ | ✖ | **● SSG (1m)** |
| `/activities` | ✖ (supabase-js 직접) | ✖ | ✅ | ✖ | **○ Static** |

변수 분리: cookie 클라이언트가 있고 `force-static`이 없으면 예외 없이 ƒ(2/2), `force-static`이 cookies를 무력화하거나 cookie 클라이언트가 없으면 예외 없이 ○/●(3/3). `new Date()`와 middleware는 양쪽 모두에 존재 → 판별력 없음.

### 6.3 인과 실험 — worktree 사본에서 단일 변수 교체 (`MEASURED`)

방법: `git worktree add --detach <시스템 temp>` 로 HEAD 사본 생성(메인 working tree 무변경) → 사본의 `app/page.tsx`에서 **딱 2줄** 교체(`createClient`→`createClientForBuild`; `new Date()`·middleware·`revalidate=60` 전부 유지) → 사본에서 `npm run build`.

```
결과:  ┌ ○ /        1m      1y
manifest:  routes["/"] = { revalidate: 60, expire: 31536000 }
```

실험 후 worktree 완전 제거·prune, 메인 저장소 `git status` clean 재확인. (부수 조치: 사본 빌드를 위해 node_modules junction과 사본 next.config의 `turbopack.root` 조정이 필요했다 — 모두 사본 내에서만.)

### 6.4 공식 문서 (`DOC-CONFIRMED`)

> "`cookies` is a **Request-time API** whose returned values cannot be known ahead of time. **Using it in a layout or page will opt a route into dynamic rendering.**"
> — Next.js 공식 문서 `cookies` API Reference (v16.3.1 문서, nextjs.org/docs/app/api-reference/functions/cookies)

**Finding P3A-1 — 홈 Dynamic의 직접 trigger는 `cookies()` 단독**
Severity: HIGH (성능 관점) · Confidence: **HIGH** · 등급: `MEASURED` + `CODE-CONFIRMED` + `DOC-CONFIRMED`

---

## 7. Supabase Client Analysis

| 질문 | 답 | 등급 |
|---|---|---|
| 어떤 helper인가 | `lib/supabase/server.ts` `createClient()` — `@supabase/ssr`의 `createServerClient` | `CODE-CONFIRMED` |
| cookie를 읽는가 | ✅ `await cookies()` 후 getAll/setAll 어댑터 제공 | `CODE-CONFIRMED` |
| auth session을 읽는가 | 클라이언트는 쿠키 기반 세션을 읽을 **수 있으나**, 홈 쿼리 2건은 세션과 무관한 **anon key 공개 조회** | `CODE-CONFIRMED` |
| service role인가 | ✖ (service role은 cron 라우트만) | `CODE-CONFIRMED` |
| 요청마다 새 client인가 | ✅ (함수 호출마다 생성) | `CODE-CONFIRMED` |
| 쿼리 자체가 cacheable한가 | ✅ — 세션 무관·결정적 필터. cookie-free 클라이언트로 대체 시 정적 생성 가능함을 실험으로 증명(§6.3) | `MEASURED` |
| SDK가 Next fetch cache를 우회하나 | supabase-js는 내부 fetch 사용. **정적/ISR 분류를 막지 않음** — `/activities`·`/blog/[id]`·실험 빌드가 증명. 단 Next Data Cache에 태워지지도 않으므로 데이터 신선도는 페이지 재생성 주기에 종속 | `MEASURED` |
| auth state가 쿼리 결과에 필요한가 | **✖.** `gallery`·`posts` 공개 조회이며 RLS 공개 정책 대상. 홈 HTML은 사용자 무관(§8.3) | `CODE-CONFIRMED` |

**결론: 홈에서 cookie 기반 클라이언트를 쓸 이유가 데이터 정합성 측면에서 전혀 없다.** 저장소에는 이미 대체재(`lib/supabase/build.ts` `createClientForBuild`)가 존재하고 `/blog/[id]`가 사용 중이다.

---

## 8. Middleware / Auth Analysis

### 8.1 라우트별 실행 표 (`CODE-CONFIRMED` — matcher `middleware.ts:111`)

matcher: `"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"`

| Route 분류 | Middleware 실행 | `auth.getUser()` | 인증 필요 | 현재 비용 | 캐시 영향 |
|---|---|---|---|---|---|
| `/` | ✅ | ✅ (결과 **미사용** — `/`에 대한 분기 없음) | ✖ | 익명: in-process / 회원: Auth 왕복+profiles 쿼리 | 분류 영향 **없음**, TTFB만 |
| `/intro` `/classes` `/contact` 등 공개 | ✅ | ✅ (미사용) | ✖ | 동일 | HIT여도 middleware는 실행됨 (캐시 앞단) |
| `/blog`, `/blog/[id]` | ✅ | ✅ (미사용) | ✖ | 동일 | 동일 |
| `/notices` `/gallery` `/materials` `/my-lessons` | ✅ | ✅ (사용 — status 검사·redirect) | ✅ member | 정당 | — |
| `/admin`, `/admin/*` | ✅ | ✅ (사용 — role/status 검사·redirect) | ✅ admin | 정당 | — |
| `/api/*` (cron 포함) | ✅ | ✅ (미사용 — API는 자체 인증) | 라우트별 | 낭비 (cron은 세션 없음 → 저비용) | — |
| `/sitemap.xml` | ✅ | ✅ (미사용) | ✖ | 낭비 | — |
| `/fonts/*.css`, `/fonts/*.woff2` | **✅ (제외 누락)** | ✅ (미사용) | ✖ | **신규 발견 — §8.4** | — |
| `/_next/static`, `/_next/image`, favicon, svg/png/jpg/jpeg/gif/webp | ✖ | — | — | — | — |

### 8.2 익명 `getUser()`의 실제 비용 (`CODE-CONFIRMED`)

`@supabase/auth-js` `GoTrueClient._getUser()` 소스 확인: 세션 access_token이 없으면

```js
if (!data.session?.access_token && !this.hasCustomAuthorizationHeader) {
  return { data: { user: null }, error: new AuthSessionMissingError() };
}
```

— **Supabase Auth 서버로의 네트워크 왕복 없이** 조기 반환한다. 선행 감사 F-5가 `NOT VERIFIED`로 남겼던 항목이 이번에 코드로 확정됐다. 즉 **익명 방문자(홈 트래픽의 대부분)에 대한 middleware 비용은 edge 실행 + 쿠키 파싱 수준**이고, 실질 왕복 비용(Auth `/user` + `profiles` 쿼리)은 **로그인 회원에게만** 발생한다. 회원 요청의 격리 측정은 불가(§22) → `NOT MEASURED`.

### 8.3 핵심 질문 §13 — A/B/C 판정

- **A. Middleware가 빌드 분류의 원인인가? → 아니오.** ○/● 라우트 전부가 같은 matcher에 매칭되며(§8.1), middleware를 건드리지 않은 인과 실험에서 `/`가 ○로 전환됐다(§6.3). `MEASURED`.
- **B. TTFB 비용인가? → 예, 단 캐시 앞단 공통 비용.** 정적 HIT 0.22 s에도 middleware가 포함되므로, middleware만 제거해도 홈 TTFB가 정적 수준이 되지는 않는다. `MEASURED`+`CODE-CONFIRMED`.
- **C. 둘 다인가? → 아니오. B만이다.**

### 8.4 공개 `/`에서 `getUser()`가 필요한가 (§14)

**불필요하다.** `middleware.ts:50-97`의 user 소비 분기 중 `pathname === "/"`에 발동하는 것은 하나도 없다(waiting redirect는 `/waiting`, member 검사·admin 검사는 각 prefix). 홈 서버 HTML도 사용자 무관 — `Navbar`는 `"use client"` 컴포넌트로 브라우저 Supabase 클라이언트에서 세션을 읽어 **클라이언트측에서만** 개인화한다(`CODE-CONFIRMED`, `components/layout/Navbar.tsx`). 따라서 공개 라우트 auth skip은 인증/보안상 안전하며 admin 보호와 논리적으로 분리 가능하다. — 단, 본 Phase에서는 미수정.

**Finding P3A-2 — matcher가 `.css`/`.woff2` 정적 에셋을 제외하지 않음 (신규)**
`public/fonts/pretendard-1.3.9/`의 CSS 1개 + woff2 조각(방문당 통상 수~수십 개) 요청이 전부 middleware를 통과한다. 익명은 저비용이지만, **로그인 회원은 폰트 조각 요청마다 Auth 왕복 + profiles 쿼리가 발생할 수 있는 구조**다. Severity: MEDIUM · Confidence: HIGH(구조) / 비용 규모는 `NOT MEASURED` · Phase 3B-2 대상.

---

## 9. Scheduled Publishing — 현재 계약 (`CODE-CONFIRMED`)

### 9.1 수명주기

```
Admin 저장 (PostEditor)
  ↓  parseDatetimeLocalAsKST(입력) → "+09:00" 부여 → UTC ISO로 DB 저장
DB posts row: published_at = 미래 UTC 시각   (별도 status 플래그 없음 — 시간 술어가 곧 상태)
  ↓  isScheduled = published_at > now 판정 (PostEditor.tsx:208)
저장 직후:
  ├ revalidateBlogList() — 항상 호출 (/blog 무효화. 예약글은 필터로 걸러지므로 무해)
  ├ revalidateBlogPost(path) — 예약 신규글은 **생략** (3ee6d03의 404 캐시 재발 방지)
  ├ IndexNow — 예약글은 생략 (발행 후 크론이 수행)
  └ 상세 URL 이동 **금지**, 관리 목록으로 복귀 (3ee6d03)
─────────────── T < published_at ───────────────
  홈 위젯      : Dynamic — 매 요청 쿼리 → .lte 필터로 비노출 ✓
  /blog 목록   : ISR 60 — 재생성마다 새 now로 필터 → 비노출 ✓
  /blog/[id]   : fetch가 .lte 필터로 null → notFound() → 404 (60초 재검증 대상으로 캐시) ✓
  sitemap      : Dynamic — 비포함 ✓
─────────────── T ≥ published_at ───────────────
  홈 위젯      : 다음 요청 즉시 노출 (Dynamic)
  /blog 목록   : 다음 재생성(≤60초 창 + SWR 1요청)에 노출
  /blog/[id]   : 404 캐시가 60초 재검증으로 자연 해소 → 200
  sitemap      : 다음 요청 즉시 포함
  cron (하루 1회 00:00 UTC): 지난 25시간 내 발행된 글 revalidatePath(/blog, /blog/[path]) + IndexNow  [백스톱]
```

### 9.2 §19 — 시간 경과만으로 공개되는가? **예 (Q7)**

DB update·운영자 클릭·크론 어느 것도 상태 전환에 필요 없다. 공개 여부는 오로지 "**각 surface의 쿼리가 언제 다시 실행되는가**"에 의해 결정된다. 이것이 Phase 3B 설계의 축이다.

### 9.3 전체 surface 목록 (§33)

| Surface | 쿼리 필터 | 렌더링 | 발행 후 갱신 시점 |
|---|---|---|---|
| 홈 `/` 위젯 | `.lte(published_at, now)` + 카테고리 3종 + `is_notice=false` | ƒ Dynamic | 즉시 (매 요청) |
| `/blog` 목록 | 동일 `.lte` + 카테고리 3종 | ○ force-static + ISR60 | ≤60초 창 + SWR |
| `/blog/[id]` | 동일 `.lte` (fetch 2단 + prev/next) | ● SSG + ISR60 + dynamicParams | 404 캐시 자연 해소, 동일 |
| `/sitemap.xml` | `.lte` — 단 **카테고리 "소식"만** | ƒ Dynamic | 즉시 |
| cron blog-publish | `gte(windowStart) & lte(now)` 25h 창 | — | 하루 1회 백스톱 + IndexNow |
| admin 관리 목록 | 필터 없음 (전체) | 클라이언트 fetch | — |
| RSS / admin preview | **존재하지 않음** | — | — |
| `/notices` | posts `category="공지사항"` — `published_at` 필터 **없음** (회원 전용, 클라이언트 fetch) | — | 예약발행 무관 |

부수 관찰(성능 무관, `CODE-CONFIRMED`): sitemap은 "소식" 단일 카테고리만 포함해 "음악교실" 글이 sitemap에서 누락된다. 본 감사 범위 밖이므로 기록만 남긴다.

### 9.4 시간대 감사 (§34)

입력(KST) → `parseDatetimeLocalAsKST`가 `+09:00`를 명시해 UTC ISO로 변환 저장(`lib/date-utils.ts:71-76`) → 모든 비교는 `new Date().toISOString()`(UTC) vs timestamptz(UTC) → 표시만 `formatDateKST`로 KST 변환. **일관적이며 결함 없음.** 캐시 변경이 시간 비교에 주는 영향은 "비교 자체"가 아니라 "비교가 실행되는 시점(재생성 시점)"뿐 — 이는 §12 지연 분석에 이미 포함된다. 리팩터링 불요. `CODE-CONFIRMED`.

### 9.5 SLA (§37)

명시적 SLA 문서는 없다. 유일한 준-계약은 `0c172be` 변경로그의 표현 — *"예약 시각 도달 후 **최대 1분 내** 자동 노출"* (blog 목록/상세 대상). 홈은 현재 기술적으로 그보다 강한 "즉시"가 유지되고 있다. → **Phase 3B 결정 필요사항**: 홈 ISR 채택 시 대표가 "홈 위젯도 blog와 같은 ~1분 계약"을 승인할 것 (§17.3).

---

## 10. Historical Regression Analysis

### 10.1 `3ee6d03` (2026-04-27, v5.17.0) — "예약 발행 블로그 상세 404 오류 수정 + ISR 크론 추가"

| 항목 | 내용 |
|---|---|
| 버그 (수정 대상) | 예약글 저장 → PostEditor가 **즉시 `revalidateBlogPost(path)` 호출 + 상세 URL로 `router.replace`** → 상세 페이지가 미래 `published_at` 필터에 걸려 `notFound()` 렌더 → 당시 `/blog/[id]`는 `revalidate = false`(온디맨드 전용)라 **404가 영구 음성 캐시** → 발행 시각이 지나도 404 지속 |
| 경로 | 캐시를 실제로 심는 주체가 **관리자 저장 플로우 자신**이었다는 것이 핵심. 방문자가 없어도 저장 순간 404가 캐시됨 |
| 수정 | ① 예약 신규글은 revalidateBlogPost 생략 ② 예약글 저장 후 상세 URL 이동 금지(관리 목록 복귀 + 안내 alert) ③ **10분 주기 크론** `/api/cron/blog-publish` 신설 — 직전 11분 창의 신규 발행 글 revalidatePath ④ vercel.json `*/10 * * * *` |
| 테스트가 못 막은 이유 | **테스트 스위트가 저장소에 전무** (`MEASURED` — test 파일/스크립트 0건). 막을 수 있었을 테스트: "미래 published_at 글 저장 직후 상세 revalidate가 호출되지 않는다" + "발행 시각 경과 후 상세가 200이 된다" (§18 T3·T4·T7) |
| 현재 잔존 여부 | ①·② PostEditor에 그대로 잔존(`components/PostEditor.tsx:208-236`). ③·④는 `0c172be`·`3a2b0a9`에서 형태 변경 |

### 10.2 중간 회귀 유발 커밋 `3a2b0a9` (2026-05-27) — 반드시 함께 봐야 한다

Vercel **Hobby 플랜의 크론 제약**(하루 1회)에 맞춰 스케줄만 `*/10` → `0 0 * * *`로 변경. **그러나 크론 내부 조회 창은 "직전 11분"으로 남았다.** 하루 1회 실행 + 11분 창 = 00:00 UTC 직전 11분에 발행된 글이 아니면 **크론이 사실상 아무 글도 재검증하지 않는 no-op**. `revalidate=false`의 영구 404 캐시를 풀어줄 유일한 장치가 조용히 죽었다.

### 10.3 `0c172be` (2026-07-12, v5.23.0) — "발행 시각 이후에도 404로 남는 문제 수정"

| 항목 | 내용 |
|---|---|
| 버그 | §10.2의 결과 — 예약글이 발행 시각 후에도 404 유지. 근본 원인 2중: ① `revalidate=false` → 404 영구 캐시 ② 크론 창 불일치로 백스톱 사망 |
| 수정 | ① `/blog`·`/blog/[id]`를 **`revalidate = 60` ISR로 전환** — 시간 기반 재검증이 발행의 1차 메커니즘이 됨 ② 크론 창 11분 → **25시간**(하루 1회 + 1시간 여유), 역할을 "백스톱 + IndexNow"로 재정의 ③ 크론에서 발행 완료 글 IndexNow |
| 테스트가 못 막은 이유 | 동일 — 테스트 전무. 막을 수 있었을 테스트: "크론 스케줄 주기 ≤ 크론 조회 창" 불변식 검증 (설정-코드 정합성 테스트, §18 T7 파생) |
| 현재 잔존 여부 | **전부 현행이다.** `/blog`·`/blog/[id]` revalidate=60, 크론 25h 창, PostEditor 생략 로직 — 오늘의 예약발행 계약(§9) 그 자체 |

### 10.4 두 회귀의 공통 구조와 Phase 3B에 주는 교훈

```
공통 실패 모드 = [상세 URL의 notFound() 음성 캐시] × [영구 캐시(revalidate=false)] × [백스톱 단일점 고장]
```

1. 실패는 항상 **상세 페이지(404를 만들 수 있는 표면)** 에서 났다. **홈·목록처럼 글이 "빠질 뿐 404가 없는" 표면에서는 이 모드가 성립하지 않는다.**
2. `revalidate=false`(온디맨드 전용)가 근본 증폭기였다. **시간 기반 재검증이 있는 한 어떤 잘못된 캐시도 60초 후 자연 치유된다** — 이것이 `0c172be`가 채택한 해법이고, Phase 3B가 홈에 적용하려는 것과 동일한 원리다.
3. **크론을 1차 메커니즘으로 삼는 설계는 이미 한 번 죽었다** (플랜 정책 변경이라는 외부 요인으로). Hobby 플랜에서 크론은 하루 1회뿐이므로(§38) 백스톱 이상의 역할을 줘서는 안 된다.
4. Phase 3B가 다시 깨뜨릴 수 있는 지점: 홈 ISR 전환 시 `revalidate`를 실수로 `false`/생략으로 두거나, 예약글 저장 플로우에 `revalidatePath("/")`를 **무조건** 추가하는 경우(홈은 404가 없어 실해는 없지만, 상세에 대한 동일 실수를 유발할 수 있는 패턴 복제 위험). §18 테스트로 고정한다.

---

## 11. Cache Layer Analysis (§40, Next.js 16 / Vercel 현행 용어)

| 계층 | `/` 현재 | `/blog` (대조) |
|---|---|---|
| Browser Cache | ✖ (`private, no-cache, no-store`) | max-age=0 (재검증 전제) |
| Vercel CDN Cache (regional) | **BYPASS/MISS 100%** | HIT/STALE (§3.2 실측) |
| Vercel ISR Cache (durable, function region) | 항목 없음 (prerender 대상 아님) | 60s 창, `revalidatePath` 온디맨드 병용 |
| Next.js Full Route Cache | 없음 (Dynamic) | 있음 |
| Next.js Data Cache / React `cache()` | 미사용 (supabase-js는 Data Cache 비경유, `unstable_cache`·태그 없음) | 동일 (페이지 재생성이 곧 데이터 갱신) |
| Supabase (PostgREST → Postgres) | **매 요청 2쿼리** (병렬) | 재생성 시에만 |

즉 홈은 **모든 캐시 계층을 우회**하고, 유일한 재사용 자산은 `immutable` 정적 에셋(JS/CSS/폰트/이미지)뿐이다.

---

## 12. ISR Feasibility — 예약발행과 결합한 실제 semantics

### 12.1 시간 기반 재검증의 정확한 동작 (`DOC-CONFIRMED` + `MEASURED`)

Next.js 공식 ISR 가이드(v16.3.1 문서) 원문 요지:

> "After 60 seconds has passed, **the next request will still return the cached (now stale) page**. The cache is invalidated and a new version of the page begins generating **in the background**. Once generated successfully, the next request will return the updated page."
> "If an error is thrown while attempting to revalidate, **the last successfully generated data will continue to be served**, and the revalidation is retried on the next request."
> "`revalidatePath` invalidates the cache entries but **regeneration happens on the next request**." (App Router에는 즉시 eager 재생성 API가 아직 없음)

Vercel 계층에서의 표현(공식 캐싱 문서 체계 기준): 시간 기반·`revalidatePath` 모두 **stale-while-revalidate** — 창 경과 후 첫 요청은 `X-Vercel-Cache: STALE`로 이전 본을 즉시 받고 백그라운드 재생성이 돈다. **본 감사에서 `/blog` 1회차에 STALE을 직접 실측했다**(§3.2).

### 12.2 §20 시나리오 직답 — 발행 12:00:00, 직전 재생성 11:59:50 (revalidate=60)

| 질문 | 답 |
|---|---|
| 12:00:00에 자동 background 재생성이 발생하는가 | **아니오.** 타이머 push가 아니라 **요청 트리거**다. 트래픽이 없으면 아무 일도 안 일어난다 |
| 언제 발생하는가 | 12:00:50(직전 생성 +60s) 이후 **최초 요청**이 재생성을 트리거 |
| stale이 먼저 반환되는가 | **예.** 그 최초 요청 자신은 11:59:50본(예약글 없음)을 받는다 |
| 최대 노출 지연 | 트래픽 연속 가정: **≈ revalidate 창(≤60s) + 요청 1개** — 12:00:50 이후 첫 방문자는 구본, 그다음 방문자부터 신본. 트래픽 부재 시: **비한정**(단, 보는 사람도 없음 — 첫 이후 방문자 쌍만 위 규칙 적용). 크론 백스톱이 하루 1회 강제 재검증 |
| 예상 헤더 | 창 내 `HIT` → 창 경과 첫 요청 `STALE` → 직후 `HIT`(신본). 재생성 실패 시 last-good 유지 + 재시도 |

### 12.3 §21 — "최대 60초" 단정 금지에 대한 답

정확한 문장은 이렇다: **"홈 ISR 60은 '60초 이내 노출 보장'이 아니라 '60초 창 + SWR 1요청' 계약이다."** 이는 `0c172be` 이후 `/blog`가 이미 13개월째 운영 중인 계약과 **완전히 동일**하며, 변경로그의 "최대 1분 내" 표현도 실제로는 이 SWR 뉘앙스를 포함한 근사였다.

### 12.4 §22 조기노출 위험 — **구조적으로 불가능** (`CODE-CONFIRMED`)

모든 재생성은 "그 시점의 `new Date()`"로 `.lte` 필터를 재평가한다. 생성 시각은 항상 과거→미래로만 진행하므로, **미래 `published_at` 글이 정적 HTML·RSC payload·metadata에 포함되는 경로가 존재하지 않는다.** 빌드 시점 프리렌더도 동일(빌드 시각의 now로 필터). prefetch(`Vary: rsc` 계열)는 동일 캐시 항목의 RSC 표현이므로 같은 필터 결과를 공유한다. sitemap은 Dynamic이라 무관.

### 12.5 §23 발행 후 미노출 위험

| 위험 | 판정 |
|---|---|
| 오래된 ISR 캐시가 계속 남음 | `revalidate=60`인 한 불가능 — 60초마다 재검증 대상. **`revalidate=false`로 두는 순간 `0c172be` 재발 구조가 된다 (금지 조건)** |
| 404 음성 캐시 | 홈은 목록 — 예약글로 인한 notFound() 경로 자체가 없음. 상세는 현행 ISR60이 이미 해결 |
| sitemap 불일치 | sitemap은 Dynamic 유지 → 즉시 반영. 홈(≤1분)과 최대 1분 창 불일치 — 크롤러 관점 무해 |
| client router cache | 세션 내 프리페치 stale 가능성은 현행 `/blog`와 동일 수준 — 신규 위험 아님 |
| 빈 위젯 캐시 | 재생성 중 Supabase 오류 시: 현재 코드는 오류를 삼키고 `data: null` → "등록된 소식이 없습니다"가 60초 캐시될 수 있음. Dynamic인 오늘도 같은 요청은 같은 화면을 보므로 **신규 위험은 '60초 지속'뿐** — 3B에서 쿼리 오류 시 throw하여 last-good 유지(§12.1 실패 semantics)로 설계 가능. LOW |

### 12.6 홈 특유의 추가 조건

`revalidatePath("/")`가 현재 **어디에도 없다**(`CODE-CONFIRMED`). Dynamic이라 필요 없었기 때문. 홈을 ISR로 바꾸면: 수동 즉시발행·글 수정의 홈 반영이 순수 시간 창에 의존하게 된다 → PostEditor(비예약 저장·수정 경로)와 크론에 `revalidatePath("/")` 추가가 계약 유지의 실질 조건이다. 예약 신규글 저장 시에도 홈 revalidate는 **안전**하다(홈은 필터로 거를 뿐 404를 만들지 않음) — 다만 일관성을 위해 상세와 같은 규율로 다루는 것을 권장.

---

## 13. Dynamic-Keep Alternative (Option A 상세)

홈 Dynamic을 유지하고 서버 비용만 줄이는 경우의 여지:

| 항목 | 여지 | 기대 효과 |
|---|---|---|
| middleware public auth skip | 있음 (§8.4) | 익명: 미미(§8.2 무왕복 확인) / 회원: 요청당 왕복 2회 제거 |
| matcher 폰트 제외 | 있음 (§8.4 P3A-2) | edge 호출 수 감소 |
| 쿼리 축소 (gallery) | **실익 없음** — `Promise.all` 병렬이라 TTFB는 max(쿼리)로 결정(§15) | ≈0 |
| 쿼리 병렬성 | **이미 병렬** (§29 답) | — |
| 함수 워밍/리전 | Hobby 플랜에서 통제 수단 제한 | — |

**한계**: 어떤 조합으로도 ① 매 요청 함수 호출+DB 왕복 ② 콜드 스파이크(1.4~2.6 s tail) ③ CDN 캐시 0%는 사라지지 않는다. 익명 getUser가 무왕복임이 확정된 이상(§8.2), **Dynamic 유지 시 얻을 수 있는 익명 사용자 TTFB 개선분은 매우 작다.**

**장점**: 예약발행 "즉시" 노출과 수동 발행 즉시 반영이 무조건 유지된다. 코드 변경 0에 가깝고 회귀 위험 최소.

---

## 14. Hybrid Alternatives (Option C / D / E)

- **C. Static shell + dynamic 일부 (PPR / Cache Components)**: Next 16에서 `cacheComponents` 설정으로 존재하나 이 저장소는 미채택 상태이고, 도입은 렌더링 모델 전면 전환(Suspense 경계 재설계, `use cache` 지시어 도입)이다. 홈처럼 "동적일 이유가 없는" 페이지에 동적 홀을 남길 필요 자체가 없다 — **비용 대비 무의미. 탈락.**
- **D. Tagged caching / 온디맨드 전용**: 예약발행은 "시간이 지나면 공개"라 **발행 순간에 invalidation을 쏠 이벤트가 없다.** 이벤트 소스가 될 크론은 Hobby 플랜에서 하루 1회뿐(§38) → 온디맨드 전용 설계는 최대 24시간+ 지연, 즉 `3a2b0a9`~`0c172be` 실패 구조의 재현이다. 시간 기반 재검증은 어떤 설계에서도 유지돼야 하며, 그렇다면 B와의 차별점이 없다. **탈락.**
- **E. 기타**: `unstable_cache`/Data Cache로 쿼리만 캐시하고 라우트는 Dynamic 유지 — cookies()가 남는 한 라우트 분류·CDN은 그대로라 이득이 반쪽. **탈락.**

---

## 15. Gallery Query Finding (§28)

- 재확인: `app/page.tsx:186` `<aside className="hidden lg:flex ...">` — gallery 4건은 이 aside에서만 소비(`CODE-CONFIRMED`). 모바일에서는 DOM만 생성.
- **TTFB 기여: 사실상 0.** `Promise.all` 병렬(§5)이므로 gallery를 제거해도 TTFB는 posts 쿼리 시간으로 결정된다. 홈이 ISR가 되면 이 쿼리는 재생성 시에만 실행되어 논점 자체가 소멸한다.
- payload: 4행 × (id, image_url, caption) ≈ 1~2 KB 수준 (`INFERRED`, 선행 감사 ≈1.5 KB와 정합).
- viewport 서버 분기: 서버는 viewport를 신뢰성 있게 알 수 없다(UA 스니핑은 캐시 파편화 + 오분기 위험). **1~2 KB를 위해 렌더링 분기를 도입하는 것은 §28 원칙대로 비권장.**

**판정: Phase 3B-3은 "변경 없음"을 권고한다.** Severity: LOW · Confidence: HIGH.

---

## 16. Architecture Comparison Matrix (§25)

| 후보 | TTFB | CDN Cache | 예약발행 조기노출 위험 | 예약발행 지연 위험 | 구현 복잡도 | 회귀 위험 | 추천 |
|---|---|---|---|---|---|---|---|
| **A. Dynamic 유지 (+3B-2만)** | warm ≈0.30 s, cold 1.4~2.6 s tail 잔존 | 0% | 없음 | 없음 (즉시) | 낮음 | **최저** | 2순위 |
| **B. 홈 ISR 60** (cookie-free client + revalidate 60 + `revalidatePath("/")` 훅) | ≈0.22 s HIT, **tail 제거** | HIT/STALE | **구조적으로 없음** (§12.4) | ≤60 s 창+SWR 1요청 — `/blog` 기수용 계약과 동일. 수동발행은 revalidatePath로 즉시 복원 | 낮음 (핵심 2줄 + 훅 2~3곳) | 낮음~중간 (§12.5) | ✅ **1순위** |
| **C. Hybrid (PPR/CacheComponents)** | shell HIT + hole 함수 호출 | 부분 | 설계 의존 | 설계 의존 | **높음** (렌더링 모델 전환) | 높음 | ✗ |
| **D. Tagged/온디맨드 전용** | B와 동일 잠재 | 가능 | 없음 | **최대 24 h+** (Hobby 크론 1회/일) — 과거 회귀 구조 재현 | 중간 | **높음** | ✗ |

---

## 17. Recommended Architecture — §47 최종 판정

# **A — `ISR RECOMMENDED`** (홈 `/` ISR 60초 전환)

### 17.1 선정 이유

1. **제품 불변식 전 항목 보존** — 조기노출 불가(§12.4) / 발행 후 영구 미노출 불가(§12.5, revalidate=60 전제) / 상세 URL 정책 무변경 / 시간 경과 자동 공개 유지 / 과거 404 회귀 모드는 목록 표면에 부재(§10.4).
2. **저장소 내 13개월 선례** — `/blog`가 `0c172be`에서 동일 계약(force-static 계열 + ISR60 + 크론 백스톱)으로 전환된 뒤 관련 회귀 재발 이력이 git history에 없다. 홈은 그보다 안전한 표면(404 없음)이다.
3. **성능 이득이 tail에 집중** — 평균 ~0.1 s 개선보다, 콜드 스파이크(1.4~2.6 s) 제거와 CDN 캐시 확보(오리진 장애 내성 포함)가 실질 가치다. CLAUDE.md §2의 "Public list pages use SSG/ISR" 원칙과도 정합.
4. Dynamic 유지(A안)의 기대 이득이 §8.2 확정으로 크게 줄었다 — 익명 방문자에게 middleware auth는 이미 무왕복이므로, Dynamic을 유지하면서 최적화할 거리가 거의 없다.

### 17.2 2순위 대안

**B — `DYNAMIC + MIDDLEWARE OPTIMIZATION`**: 대표가 §17.3의 계약 변경(수동 발행 즉시성 완화)을 승인하지 않는 경우의 대안. 이 경우에도 3B-2(middleware)는 독립적으로 가치가 있다.

### 17.3 채택 전 대표 승인 필요 사항 (명시적 트레이드오프)

> 홈 우측 "최신 국악원 소식" 위젯의 반영 시점이 **"즉시" → "예약글: 최대 ~1분+SWR / 수동 발행·수정: revalidatePath 훅으로 사실상 즉시"** 로 바뀐다. `/blog` 목록이 이미 수용 중인 것과 같은 계약이다. gallery 위젯도 동일(≤1분).

### 17.4 Phase 3B-1 구현 지침 (감사 결론으로서의 설계, 수정은 미수행)

1. `app/page.tsx`: `createClient()` → `createClientForBuild()` (2줄) — **`force-static` 방식보다 이 방식을 권장**한다. `force-static`은 cookies()를 조용히 빈 값으로 만들어, 미래에 홈에 사용자 의존 렌더링이 추가될 때 조용한 오동작을 만들 수 있다. 클라이언트 교체는 의도가 코드에 드러난다 (`/blog/[id]` 선례).
2. `revalidate = 60` **유지** (이미 있음 — 전환 즉시 유효해짐). `revalidate=false`·생략 **금지** (§10.4 교훈).
3. `app/actions/revalidate.ts`에 `revalidateHome()` 추가 → PostEditor 저장(비예약·수정 경로)과 cron 성공 경로에서 호출 — 수동 발행 즉시성 복원 + 무트래픽 백스톱.
4. (선택) 홈 쿼리 오류 시 throw로 last-good 유지 (§12.5).
5. (선택) `scripts/check-font-regression.mjs` 방식의 prebuild 가드 또는 CI 검사: 빌드 후 `prerender-manifest.json`에 `routes["/"]`(revalidate 60)가 존재하는지 검증 — cookies() 재유입으로 인한 조용한 Dynamic 회귀 방지.

---

## 18. Phase 3B Regression Test Specification (T1~T10)

**전제 구조 제안**: 현재 `.lte("published_at", now)` 술어가 3개 파일에 산재한다. `lib/posts-query.ts`(가칭)로 **now 주입 가능한 pure query builder**를 추출하면 (`publicPostsFilter(query, now: Date)`) DB 없이 술어를 단위 테스트할 수 있다. 통합 계층은 로컬 `next build && next start` + PostgREST 목(mock fetch/MSW)으로 검증한다. **Production DB mutation은 어떤 테스트에서도 금지.**

| # | 시나리오 | 셋업 (주입 now / 목 데이터) | 기대 결과 |
|---|---|---|---|
| T1 | 발행 전 홈 | now=11:59, post.published_at=12:00 | 홈 위젯 목록에 미포함. 정적 HTML/RSC 문자열에 제목 부재 |
| T2 | 발행 시각 통과 | now=12:00:01, 직전 생성본 11:59:50 | 재생성 트리거 후 포함. SLA 검증: "재생성 시점 기준 즉시" + 통합 테스트에서 stale 1회 허용을 명시적으로 assert |
| T3 | 미래 상세 URL | now < published_at, GET /blog/[path] | **404** (현행 계약 유지). 404 응답이 revalidate 60 대상으로 캐시되는지(영구 캐시 아님) 확인 |
| T4 | 발행 후 상세 URL | now > published_at | 200 + 본문 렌더. T3에서 심긴 404 캐시가 60초 창 경과 후 해소 |
| T5 | 기존 공개 글 | published_at 과거 | 홈·목록·상세 모두 무변화 |
| T6 | 비공개/미래 초안 | published_at null 또는 미래 | 목록·홈·sitemap 미노출 유지 (null 처리 명시 테스트) |
| T7 | Cache stale 상황 | 발행 전 생성된 캐시 존재 상태에서 시간 경과 | 창 경과 첫 요청 stale → 다음 요청 신본. **크론 창(25h) ≥ 크론 주기(24h) 불변식을 설정-코드 정합성 테스트로 고정** (`0c172be` 재발 방지) |
| T8 | admin 인증 | 비로그인 GET /admin | 307 → /admin/login?next=... 유지 |
| T9 | 공개 홈 무세션 | 쿠키 없는 GET / | 200, 세션 무관 동일 HTML. ISR 전환 후에는 `X-Vercel-Cache`가 HIT 계열인지 확인 |
| T10 | 공개 route middleware 변경 내성 | (3B-2에서) public auth skip 적용 시 | member/admin 보호 라우트의 redirect 동작 T8과 함께 전건 유지. matcher 변경 후 `/fonts/*` 무영향 확인 |

---

## 19. Phase 3B Change Scope (§42 — 예상 변경 파일)

```
[3B-1 — Home ISR]
app/page.tsx                        createClient → createClientForBuild (2줄) + 주석
app/actions/revalidate.ts           revalidateHome() 추가
components/PostEditor.tsx           비예약 저장·수정 경로에 revalidateHome() 호출
app/api/cron/blog-publish/route.ts  성공 경로에 revalidatePath("/") 백스톱
scripts/ 또는 CI                    홈 prerender 분류 회귀 가드 (선택)
lib/posts-query.ts (신규, 선택)     now 주입형 술어 추출
tests/ (신규)                       T1~T7, T9

[3B-2 — Middleware (독립)]
middleware.ts                       public route auth skip + matcher에 css|woff2|ico 등 제외
                                    (+ Next 16 deprecation에 따른 proxy 개명은 별도 커밋 권장)
tests/                              T8, T10

[3B-3 — Gallery]
변경 없음 권고 (§15)
```

`/sitemap.xml`의 Dynamic(cookies) 정리는 3B-1과 동일 패턴의 후속 후보로 기록만 한다 (트래픽이 적어 우선순위 낮음).

---

## 20. Phase 3B Split Decision (§43)

**분리를 권고한다 — Q12 답: 2단계.**

- **3B-1 (Home ISR)** 과 **3B-2 (Middleware)** 는 회귀 표면이 완전히 다르다(콘텐츠 신선도 vs 인증 경계). 하나가 잘못돼도 다른 하나의 롤백에 영향이 없도록 **별도 커밋·별도 배포·배포 간 Production 검증**(X-Vercel-Cache 확인, 예약글 1건 실전 관찰)을 사이에 둔다.
- 순서는 **3B-1 먼저** — 성능 이득의 대부분이 여기 있고, 3B-2는 익명 트래픽 기준 이득이 작음이 확정됐다(§8.2).
- **3B-3은 실행하지 않는다** (§15).

---

## 21. Remaining Risks

| # | 위험 | Severity | Confidence | 완화 |
|---|---|---|---|---|
| R-1 | ISR 전환 후 수동 발행 즉시성 — revalidateHome 훅 누락 시 최대 ~1분 지연 | MEDIUM | HIGH | §17.4-3 훅 + T2 |
| R-2 | 미래에 홈에 사용자 의존 UI 추가 시 ISR와 충돌 (전원 동일 화면 캐시) | MEDIUM | MEDIUM | 클라이언트 컴포넌트 개인화 원칙(Navbar 방식) 문서화 + prerender 가드 |
| R-3 | cookies() 재유입으로 조용한 Dynamic 회귀 (성능만 저하, 제품 무해) | LOW | HIGH | §17.4-5 빌드 가드 |
| R-4 | 재생성 중 Supabase 오류 → 빈 위젯 60초 캐시 | LOW | MEDIUM | 쿼리 오류 시 throw로 last-good 유지 (§12.5) |
| R-5 | 트래픽 공백 시간대의 stale 홈 (보는 사람 없음 → 실해 미미) | LOW | HIGH | 크론 백스톱 revalidatePath("/") |
| R-6 | middleware→proxy 컨벤션 deprecated (Next 16 경고) — 방치 시 향후 업그레이드 장애 | LOW | HIGH | 3B-2에서 별도 커밋 |
| R-7 | (관찰) admin 페이지 다수가 `"use client"` 파일에서 `export const dynamic = "force-dynamic"` 선언 — 빌드는 ○ Static으로 분류 (선언 무효 추정). 데이터는 전부 클라이언트 fetch라 실해 없음 | LOW | MEDIUM (`INFERRED`) | 필요 시 별도 정리 |
| R-8 | (관찰) sitemap "소식" 카테고리만 포함 — 음악교실 글 SEO 누락 | LOW | HIGH | 범위 밖, 기록만 |

**SEO 영향 (§39, 간결)**: ISR 홈은 크롤러에 ≤1분 stale HTML을 줄 수 있으나 홈은 글 목록 5건의 표면일 뿐이고 상세·sitemap 경로가 정상이라 색인 영향은 무시 가능. Dynamic 유지 대비 오히려 안정된 응답 시간이 크롤 예산에 유리. sitemap(즉시)과 홈(≤1분)의 시차는 무해.

---

## 22. Verification Gaps

| 항목 | 사유 | 등급 |
|---|---|---|
| 로그인 회원 요청의 middleware 비용(Auth 왕복 + profiles 쿼리) 정량 | 외부에서 격리 측정 불가 (서버 내부) | `NOT MEASURED` |
| middleware 단독 실행 시간 | Server-Timing 부재, Vercel 로그 접근 안 함 | `NOT MEASURED` |
| Vercel plan 확정 | 저장소 증거(`3a2b0a9` 메시지, cron 주석, vercel.json 일일 스케줄)로 **Hobby로 판단** — 대시보드 직접 확인은 안 함 | `CODE-CONFIRMED`(간접) |
| gallery 쿼리 단독 DB latency | Supabase 서버측 측정 불가 | `NOT MEASURED` (병렬 구조상 결론에 불영향) |
| ISR 전환 후 실제 TTFB | 수정 미수행 (READ-ONLY) — 정적 라우트 실측(0.22~0.24 s)을 대리 지표로 사용 | `INFERRED` |
| 예약글 실전 노출 타이밍 관찰 | Production 예약글 생성 금지(§50) 준수 | 3B-1 배포 후 관찰 항목 |

**사용한 공식 문서 (§9)**:
- Next.js `cookies` API Reference — https://nextjs.org/docs/app/api-reference/functions/cookies (v16.3.1 문서)
- Next.js ISR 가이드 — https://nextjs.org/docs/app/guides/incremental-static-regeneration (v16.3.1 문서)
- Vercel 캐싱 체계(CDN/ISR 계층·`x-vercel-cache` 값·SWR semantics) — Vercel 공식 문서 체계 (https://vercel.com/docs/caching, https://vercel.com/docs/incremental-static-regeneration)
- 커뮤니티 글·블로그는 결정 근거로 사용하지 않음.

---

## 23. Repository Integrity

```
$ git status --porcelain   →  ?? reports/performance/KIMPO_GUGAK_PHASE3A_DYNAMIC_CACHE_READONLY_AUDIT.md (본 보고서만)
$ git diff --stat          →  (tracked 변경 없음)
$ git rev-parse HEAD       →  eba9320 (감사 시작과 동일)
```

- tracked 소스/설정 변경: **0건.** commit/push/branch 변경/배포: **없음.**
- Production: GET/HEAD 관측만 (홈 8회 + 정적 3라우트 각 3회 + sitemap/상세 각 1회). DB row·예약글·revalidate 호출·purge: **일체 없음.**
- 임시 산출물: 시스템 temp의 실험 worktree — **완전 삭제 + `git worktree prune` 완료** (worktree list에서 소멸 확인). 사용자의 기존 `.cursor` worktree 3개는 **미접촉**. `.next/`는 gitignore 대상 로컬 빌드 산출물.

---

## 24. Q1~Q12 직답 (§46)

**Q1.** `/`의 직접 trigger는 `app/page.tsx:44 → lib/supabase/server.ts:5`의 **`await cookies()`** 단독이다. (`MEASURED` 인과실험 §6.3 + `CODE-CONFIRMED` 전수조사 + `DOC-CONFIRMED`)

**Q2.** **아니다.** `.lte("published_at", new Date())`의 `new Date()`는 Dynamic 판정과 무관하다 — 동일 표현이 ○ `/blog`·● `/blog/[id]`·실험 정적 빌드에 그대로 존재한다. 단 정적화 시 "쿼리 데이터가 생성 시점에 고정"되는 효과는 있으며 그것이 §12의 지연 분석 대상이다. (Cache Components 미사용 전제)

**Q3.** **TTFB 비용일 뿐, 분류 원인이 아니다.** 그리고 그 비용도 익명 사용자 기준 왕복 없음이 확정됐다(§8.2). 캐시 앞단에서 실행되므로 정적 HIT 라우트도 같은 비용을 이미 지불 중이다.

**Q4.** **불필요하다.** `/`에 대해 getUser 결과를 소비하는 분기가 없고, 홈 HTML은 사용자 무관(Navbar 클라이언트 개인화). skip해도 인증 경계 불침해 — 단 수정은 3B-2.

**Q5.** `3ee6d03`은 "예약글 저장 플로우가 스스로 상세 404를 영구 캐시하는" 버그를 **고친** 커밋 — 저장 시 revalidate/이동 생략 + 10분 크론 신설. 상세는 §10.1.

**Q6.** `0c172be`는 `3a2b0a9`(크론 일일화)가 만든 "크론 창 불일치 no-op + revalidate=false 영구 404" 회귀를 **고친** 커밋 — blog 목록/상세 ISR60 전환 + 크론 창 25h + IndexNow. 상세는 §10.3.

**Q7.** **그렇다.** DB update·클릭·크론 없이 시간 술어만으로 공개된다. 관건은 "각 surface의 쿼리 재실행 시점"이다(§9.2).

**Q8.** 요청 트리거 SWR로 결정된다: **직전 생성 +60초 이후의 최초 요청이 stale을 받으며 재생성을 트리거하고, 그다음 요청부터 신본** — 트래픽 연속 시 체감 "≤1분+α", 무트래픽 시 비한정(크론이 일 1회 백스톱). §12.2.

**Q9.** **만족한다** — 단 3대 조건: ① `revalidate=60` 유지(false 금지) ② 수동 발행 경로에 `revalidatePath("/")` ③ 대표의 "~1분 계약" 승인. 조기노출은 구조적으로 불가(§12.4), 404 음성 캐시 모드는 목록 표면에 부재(§10.4).

**Q10.** 더 "안전"하긴 하나(회귀 위험 최저) **더 낫지는 않다** — 익명 middleware 비용이 무왕복임이 확정되어 개선 여지가 작고, 콜드 tail과 CDN 0%가 그대로 남는다. 2순위 대안으로 유지(§17.2).

**Q11.** **홈 ISR 60초 전환 (§47-A)** — cookie-free 클라이언트 교체(2줄) + 기존 revalidate=60 활성화 + revalidateHome 훅 + 빌드 분류 가드. 근거는 §17.1.

**Q12.** **분리한다**: 3B-1(Home ISR) → 검증 → 3B-2(Middleware). 3B-3(Gallery)은 실행하지 않음. §20.

---

## Independent Challenge (§51 반증 검토)

1. **Dynamic trigger 오특정?** — 반박 시도: supabase-js의 내부 fetch(no-store 기본)가 공동 원인일 가능성. **기각**: cookie-free supabase-js를 쓰는 `/activities`·`/blog/[id]`·실험 빌드가 모두 정적으로 분류됐다. cookies() 제거 단독으로 분류가 뒤집힌 인과 실험이 결정적.
2. **ISR 지연 과소평가?** — 정당한 지적 하나를 수용해 본문에 반영했다: "최대 60초"는 부정확하며 **SWR 특성상 창 경과 후 첫 방문자는 구본을 받는다**(§12.3). 무트래픽 시나리오의 비한정성도 명시했다. 그럼에도 이는 `/blog`가 13개월째 수용 중인 계약과 동일하다는 사실이 판단을 지지한다.
3. **Dynamic 유지 시 캐시 가능성 누락?** — 해당 없음(ISR 추천). 역방향으로 "Dynamic 유지의 이득을 과소평가했나"를 검토: 익명 getUser 무왕복 확인(§8.2)이 오히려 Dynamic 유지안의 기대 이득을 줄였다. 편향 없음.
4. **Middleware와 분류의 혼동?** — 분리 검증 완료: 동일 middleware 하의 ○ 라우트 다수 + middleware 무변경 인과 실험. 오히려 "정적 HIT에도 middleware 비용이 포함된다"는 역방향 통찰을 얻었다.
5. **과거 회귀 해법의 오적용?** — 반박 시도: "홈도 상세처럼 404 캐시가 생길 수 있지 않나." **기각**: 홈은 `notFound()` 경로가 없는 목록이다. 예약글은 필터로 제외될 뿐 오류 상태를 만들지 않는다. 남는 유사 위험(빈 위젯 캐시)은 R-4로 별도 식별했다.
6. **성능을 위한 제품 약화?** — **부분 인정**: 수동 발행·수정의 홈 즉시 반영이 유일한 실질 약화다. 이를 숨기지 않고 §17.3 "대표 승인 필요 사항"으로 전면에 명시했고, revalidateHome 훅으로 사실상 복원 가능함을 설계에 포함했다. 이 조건이 거부되면 추천은 2순위(Dynamic 유지)로 전환된다.

---

## 24-부록. 최종 판정 근거 (§53 PASS 기준 대조)

| # | PASS 조건 | 충족 | 근거 |
|---|---|---|---|
| 1 | `/` Dynamic 직접 trigger 확정 | ✅ | §6 (3중 증거) |
| 2 | Middleware 영향 분리 확정 | ✅ | §8 |
| 3 | 두 예약발행 회귀 커밋 원인 확정 | ✅ | §10 (+중간 커밋 `3a2b0a9`) |
| 4 | 현재 예약발행 계약 확정 | ✅ | §9 |
| 5 | ISR 실제 위험/지연 구조 확정 | ✅ | §12 (STALE 실측 + 공식 문서) |
| 6 | Dynamic 유지 대안 평가 | ✅ | §13 |
| 7 | 최소 3개 구조 비교 | ✅ | §16 (4개) |
| 8 | 최종 추천 1개 선택 | ✅ | §17 (A. ISR + 2순위 명시) |
| 9 | Phase 3B 회귀 테스트 설계 | ✅ | §18 (T1~T10 + now 주입 구조) |
| 10 | source 변경 0 | ✅ | §23 |

# 최종 판정: ✅ **PASS**

(비핵심 측정 공백 — 회원 middleware 비용 정량, ISR 전환 후 실측 — 은 §22에 명시. 핵심 10항은 전부 증거 기반으로 확정됨.)
