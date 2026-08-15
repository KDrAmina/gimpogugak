# 김포국악원 Phase 3B-2 — Middleware / 공개 Route 인증 · 정적 에셋 최적화 수정 보고서

- **대상**: 저장소 `C:\Users\JUN\gimpo-gugak` (branch `main`) + Production `https://gimpogugak.com`
- **작업 일시**: 2026-08-15
- **작업 유형**: 수정 + 배포 (Phase 3A READ-ONLY 감사의 후속 실행 단계)
- **시작 HEAD**: `eba9320` → **종료 HEAD**: `fd91ad7`
- **선행 문서**: `KIMPO_GUGAK_PHASE3A_DYNAMIC_CACHE_READONLY_AUDIT.md`, `..._PHASE2_HERO_LCP_...md`, `..._PHASE1_FONT_...md` (3건 모두 열람)
- **최종 판정**: ✅ **PASS**

증거 등급: `MEASURED`(실측) / `CODE-CONFIRMED`(코드 확인) / `INFERRED`(추론) / `NOT MEASURED`(미확인)

---

## 1. Executive Summary

### 결론 4줄

1. **middleware 는 모든 요청에서 `auth.getUser()` 를 호출했지만, 그 결과를 소비하는 라우트는 6개 프리픽스뿐이었다.** `/admin`, 회원 전용 4종(`/notices` `/gallery` `/materials` `/my-lessons`), `/waiting` 이외의 경로에는 `user` 를 읽는 분기가 **하나도 없다**(`CODE-CONFIRMED`, §5). 이 낭비를 게이트 하나로 제거했다.
2. **효과는 "로그인 세션을 가진 사용자의 공개 페이지 요청"에서 크다.** Production 실측 기준, 세션 쿠키가 붙은 공개 라우트 요청에 붙던 **+326 ms** 의 Supabase Auth 왕복이 **±16 ms(노이즈 수준)** 으로 사라졌다(`MEASURED`, §14). 익명 사용자에게는 Phase 3A §8.2 확정대로 원래부터 왕복이 없어 이득이 작다.
3. **matcher 가 Pretendard dynamic subset(CSS 1개 + woff2 92개)과 robots.txt·ads.txt 를 middleware 로 흘려보내고 있었다(P3A-2).** 확장자 예외를 추가해 제외했고, 컴파일된 matcher 정규식으로 전후를 대조해 확인했다(`MEASURED`, §6). 폰트 CSS 요청의 세션 쿠키 유발 비용 **+124 ms → 0** 이 되었다.
4. **인증 경계는 한 글자도 약해지지 않았다.** 인증 분기 코드 자체는 diff 가 0이고, 비로그인 26개 라우트의 status/redirect 응답이 수정 전후 **완전히 동일**하며(`MEASURED`, §8), Production 에서 `/admin` → `/admin/login?next=%2Fadmin` 등 redirect 가 전부 유지된다. 보호 라우트는 여전히 auth 왕복(+335 ms)을 지불한다 — 즉 **낭비만 사라지고 검사는 남았다**.

### 이번 작업에서 새로 확정된 사실

| # | 사실 | 등급 |
|---|---|---|
| 1 | `middleware.ts:43` 의 `publicRoutes` 는 **선언만 있고 참조가 0** 인 dead code 였다 (실제 공개 라우트 정책과 무관) | `CODE-CONFIRMED` |
| 2 | Production 에서 세션 쿠키 유무로 auth 왕복 비용을 격리 측정할 수 있다 — 수정 전 공개 라우트 **+326 ms**, 수정 후 **±16 ms** | `MEASURED` |
| 3 | 수정 후에도 보호 라우트는 세션 쿠키 시 **+335~343 ms** 를 지불 — auth 경로 생존의 직접 증거 | `MEASURED` |
| 4 | 빌드 route table·prerender-manifest 가 전후 **완전 동일**, 홈은 `ƒ` Dynamic 유지 | `MEASURED` |
| 5 | `/api/*` 는 8개 route handler 가 쿠키 기반 자체 인증을 수행 → 이번 변경에서 **의도적으로 auth 경로 유지** | `CODE-CONFIRMED` |
| 6 | 저장소의 `node_modules` 가 손상 상태였다(`.bin` 부재 + 패키지 누락) — Phase 3A worktree junction 실험의 잔해로 추정 | `MEASURED` |
| 7 | `npm run lint` 는 Next 16 에서 `next lint` 제거로 이미 고장 — 이번 작업 이전부터의 문제 | `MEASURED` |

---

## 2. Git Baseline

```
$ git status --porcelain → ?? reports/performance/KIMPO_GUGAK_PHASE3A_DYNAMIC_CACHE_READONLY_AUDIT.md
$ git branch --show-current → main
$ git rev-parse HEAD → eba9320ccae41468f9f5a73f72faaf0543417d85
$ git log -8 --oneline
  eba9320 docs: Phase 2 히어로/LCP 이미지 성능 회귀 수정 보고서 추가
  464ee1e perf: 히어로/LCP 이미지 전달 회귀 제거 (v5.25.0)
  d7cb350 docs: Phase 1 폰트 성능 회귀 수정 보고서 추가
  49141b0 perf: 폰트 전달/인라인 CSS 성능 회귀 제거 (v5.24.0)
  b770fea New googleads
  76a1424 googleads
  0c172be fix: 예약 발행 글이 발행 시각 이후에도 404로 남는 문제 수정 (v5.23.0)
  3a2b0a9 fix: Vercel Hobby 플랜 정책에 따른 크론 스케줄 조정 (하루 1회)
```

tracked 변경 0건. 기존 사용자 변경 없음.

### 2.1 환경 복구 (저장소 무관, 기록 목적)

baseline 빌드 시도가 `Cannot find module '@alloc/quick-lru'` 로 실패했고 `node_modules/.bin/` 자체가 부재했다. Phase 3A 보고서 §23 이 기술한 worktree + `node_modules` junction 실험의 정리 과정에서 junction 너머의 실제 내용이 일부 삭제된 것으로 추정한다(`INFERRED`).

- 조치: **`npm ci`** (lock 파일을 절대 수정하지 않는 결정적 설치)
- 검증: `package-lock.json` / `package.json` 의 `git hash-object` 값이 설치 전후 **동일**(`e0625517…` / `e0ddb79a…`), `git status` 변화 없음
- 부수 조치: `npm ci` 가 swc 네이티브 모듈 unlink 에서 `EPERM` 으로 막혀, 이를 점유하던 **사용자의 `next start` 프로덕션 서버(PID 36812)를 정지**했다. `npm run start` 로 언제든 재기동 가능하다.

---

## 3. Phase 3A Report State

- 작업 시작 시점: **untracked** (`?? reports/performance/KIMPO_GUGAK_PHASE3A_DYNAMIC_CACHE_READONLY_AUDIT.md`)
- 내용을 전문(661줄) 열람해 현재 코드와 대조 → 핵심 주장 전부 재확인됨(§5, §6)
- 지침 §5 대로 **source 수정 전에 docs-only 커밋으로 분리**: `aedb824`
- 보고서 내용은 **한 글자도 수정하지 않았다.**

---

## 4. Middleware Before

```ts
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let response = NextResponse.next({ request: { headers: request.headers } });
  const supabase = createServerClient(...);          // ← 모든 요청에서 생성

  const { data: { user } } = await supabase.auth.getUser();   // ← 모든 요청에서 실행

  const publicRoutes = [...];                        // ← 선언만, 참조 0 (dead code)
  const memberRoutes = ["/notices", "/gallery", "/materials", "/my-lessons"];
  const isMemberRoute = memberRoutes.some((route) => pathname.startsWith(route));

  if (user) {
    const { data: profile } = await supabase.from("profiles")...   // ← 로그인 시 추가 쿼리
    // pending / member / waiting / admin 분기
  } else {
    // /admin, /waiting 비로그인 분기
  }
  return response;
}

export const config = { matcher: [
  "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
]};
```

**핵심 관찰(`CODE-CONFIRMED`)**: `user` 를 소비하는 분기의 조건은 전부 `pathname.startsWith("/admin")`, `isMemberRoute`, `pathname === "/waiting"` 중 하나다. `/`, `/intro`, `/blog`, `/classes`, `/contact`, 정적 에셋, `/sitemap.xml`, `/api/*` 에 대해 발동하는 분기는 **없다**.

---

## 5. Protected / Public Route Classification

`app/` 전체 라우트를 열거해(66개 page/route 파일) middleware 코드와 대조한 결과다. 추측 없이 **코드가 실제로 검사하는 경로**만 분류했다.

| 분류 | 경로 | middleware 가 auth 결과를 쓰는가 | 근거 |
|---|---|---|---|
| **Admin protected** | `/admin` 및 하위 전체 | ✅ `role === "admin" && status === "active"`, 비로그인 시 `?next=` 부여 redirect | `middleware.ts` admin 분기 |
| **Member protected** | `/notices` `/gallery` `/materials` `/my-lessons` | ✅ `status` 검사 (pending → `/waiting`, 비active → `/login`) | `memberRoutes` |
| **상태 전이** | `/waiting` | ✅ 로그인 여부 양방향 redirect | `pathname === "/waiting"` |
| **API** | `/api/*` (12개 route) | ✖ (middleware 는 미소비) — **단, 8개 handler 가 쿠키로 자체 인증** | `app/api/**` 의 `auth.getUser()` |
| **Public** | `/` `/intro/*` `/classes` `/contact` `/activities` `/blog` `/blog/[id]` `/login` `/update-password` `/members` `/my-info` `/about` `/privacy` `/teachers` `/director` `/booking` `/secret` `/Song-Ri-Gyel` `/Park-Jun-Yeol` `/sitemap.xml` 등 | ✖ 소비 분기 없음 | 전수 대조 |
| **정적 에셋** | `public/**` | ✖ | — |

### 5.1 중요한 기존 동작 — 오해 금지

비로그인 상태에서 `/notices` `/gallery` `/materials` `/my-lessons` 는 **middleware 가 막지 않는다** (`else` 분기에 member 검사가 없다). 실제로 **200 을 반환**하며 차단은 각 페이지의 클라이언트 컴포넌트가 수행한다(`app/my-lessons/page.tsx` 등의 `auth.getUser()`). 이는 수정 전 실측으로 확인한 **기존 계약**이며(§8), 이번 작업은 이를 **그대로 보존**했다. (강화도 약화도 하지 않음 — 범위 밖.)

### 5.2 `/members` · `/my-info` 는 memberRoutes 에 없다

이 두 라우트는 회원용처럼 보이지만 `memberRoutes` 배열에 없어 **원래부터** middleware 인증 대상이 아니었고, 클라이언트에서 검사한다. 게이트에도 넣지 않아 기존과 동일하다(`CODE-CONFIRMED`).

---

## 6. Static Asset Matcher Finding

### 6.1 실제 `public/` 자산 조사 (`MEASURED`)

| 확장자 | 실제 파일 | 조치 |
|---|---|---|
| `.css` | `public/fonts/pretendard-1.3.9/pretendard-variable-dynamic-subset.css` (1개, 54,380 B) | **제외 추가** |
| `.woff2` | `public/fonts/pretendard-1.3.9/woff2/` **92개** | **제외 추가** |
| `.txt` | `robots.txt`, `ads.txt`, 사이트 소유확인 `c4f2…txt` | **제외 추가** |
| `.ico` | `favicon.ico` | **제외 추가**(기존 literal 예외는 유지) |
| `.woff` `.ttf` `.otf` | 현재 없음 — 동일 폰트 자산 클래스, 충돌 라우트 0 | 제외 추가(방어적) |
| `.js` `.map` | **public/ 에 0개** — Next 자산은 이미 `_next/static` 으로 제외, TinyMCE 는 CDN(`tinymceScriptSrc`) | **추가하지 않음** |
| `.xml` | `/sitemap.xml` 이 **실제 앱 라우트**(`app/sitemap.ts`, `ƒ` Dynamic) | **추가하지 않음** |
| 이미지 6종 | 기존 유지 | 변경 없음 |

### 6.2 확장자형 라우트 edge case 검토 (지침 §13)

`app/` 전체에서 마지막 세그먼트에 점이 있는 라우트는 **`/sitemap.xml` 과 `/icon.png` 둘뿐**이다(`find app -type d -name "*.*"` → 0건). `/icon.png` 는 기존 `png` 예외로 **이미** middleware 를 우회 중이었고(수정 전 probe 에서 `skip` 확인), `/sitemap.xml` 은 `xml` 을 넣지 않아 계속 매칭된다. 따라서 이번 확장자 추가로 **우회하게 된 앱 라우트는 0개**다.

보호 라우트(`/admin` `/notices` `/gallery` `/materials` `/my-lessons` `/waiting`)는 모두 확장자가 없어 어떤 경우에도 이 예외에 걸리지 않는다.

### 6.3 컴파일된 matcher 전후 대조 (`MEASURED`)

소스 문자열이 아니라 **Next 가 실제로 사용하는** `.next/server/middleware-manifest.json` 의 정규식을 추출해 경로 목록에 적용했다.

```diff
-originalSource: /((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)
+originalSource: /((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|woff2|woff|ttf|otf|txt)$).*)

-MIDDLEWARE  /fonts/pretendard-1.3.9/pretendard-variable-dynamic-subset.css
-MIDDLEWARE  /fonts/pretendard-1.3.9/woff2/PretendardVariable.subset.0.woff2
-MIDDLEWARE  /fonts/pretendard-1.3.9/woff2/PretendardVariable.subset.91.woff2
+skip        /fonts/pretendard-1.3.9/pretendard-variable-dynamic-subset.css
+skip        /fonts/pretendard-1.3.9/woff2/PretendardVariable.subset.0.woff2
+skip        /fonts/pretendard-1.3.9/woff2/PretendardVariable.subset.91.woff2
-MIDDLEWARE  /robots.txt
-MIDDLEWARE  /ads.txt
+skip        /robots.txt
+skip        /ads.txt
```

**그 외 36개 경로의 판정은 전부 불변** — `/admin*`, `/notices`, `/gallery`, `/materials`, `/my-lessons`, `/waiting`, `/api/*`, `/`, `/blog`, `/sitemap.xml` 모두 `MIDDLEWARE` 유지. 즉 diff 에 **보호 라우트가 `MIDDLEWARE` → `skip` 으로 바뀐 줄은 한 줄도 없다.**

---

## 7. Selected Minimal Change

변경 파일 4개 (커밋 `fd91ad7`):

```
middleware.ts                           |  60 +++++++++-
scripts/check-middleware-regression.mjs | 187 +++++++++++++++++++++++++++++ (신규)
package.json                            |   4 +-   (prebuild 연결 + 버전 5.26.0)
lib/changelog.ts                        |  10 ++   (v5.26.0 기록, 한국어)
```

### 7.1 인증 게이트

```ts
const AUTH_ROUTE_PREFIXES = [
  "/admin", "/notices", "/gallery", "/materials", "/my-lessons", "/waiting",
];

function needsAuth(pathname: string): boolean {
  if (pathname.startsWith("/api")) return true;
  return AUTH_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

// middleware 진입 직후
if (!needsAuth(pathname)) {
  return NextResponse.next();
}
```

**의미 보존의 근거 — 게이트 술어를 분기 술어와 동일한 형태로 맞췄다.** 기존 분기는 `pathname.startsWith("/admin")` 와 `memberRoutes.some(r => pathname.startsWith(r))` 를 쓴다. 게이트도 **같은 `startsWith`** 를 쓰므로, 예컨대 `/noticesXYZ` 같은 비정상 경로에서도 판정이 기존과 일치한다. (`===` 로 좁혔다면 로그인·비active 사용자의 `/noticesXYZ` 처리가 달라졌을 것이다.) `/waiting` 은 분기가 `===` 이지만 게이트는 `startsWith` 로 **더 보수적으로** 두었다 — 넓게 태워도 내부 분기가 `===` 라 결과는 동일하다.

### 7.2 `/api/*` 를 의도적으로 유지한 이유

`/api/*` 는 middleware 가 `user` 를 소비하지 않으므로 기술적으로는 skip 가능하다. 그러나 middleware 의 `setAll` 은 **세션 토큰 갱신 쿠키를 응답에 심는 경로**이기도 하다. API handler 8곳이 쿠키 기반으로 자체 인증하는 상황에서 갱신 타이밍이 바뀔 가능성을 이번 성능 작업이 떠안을 이유가 없다. 지침 §17 "API 기존 보호 정책 변동 없음" 을 **구조적으로** 보장하기 위해 그대로 태운다. 트래픽 비중도 공개 페이지·정적 에셋에 비해 미미해 성능 손실이 없다.

### 7.3 공개 라우트의 세션 갱신은 누가 하는가 (`CODE-CONFIRMED`)

공개 라우트에서 middleware 가 세션을 갱신하지 않게 되지만, 의존하는 곳이 없음을 전수 확인했다.

- 공개 라우트의 **서버 컴포넌트** 중 세션을 읽는 곳: **0곳**. `app/page.tsx`·`app/blog/page.tsx`·`app/sitemap.ts` 는 `createClient()` 를 쓰지만 전부 anon key 공개 조회이며 `auth.getUser()` 를 호출하지 않는다.
- 공개 라우트의 세션 소비자는 전부 **클라이언트 컴포넌트**(`Navbar`, `/login`, `/update-password`, `/members`, `/my-info`)이고, `lib/supabase/client.ts` 의 `createBrowserClient` 는 쿠키 저장 + 자동 토큰 갱신을 수행한다.
- 보호 라우트 진입 시에는 기존 경로가 그대로 돌아 갱신된다.
- `/auth/callback` 류의 **서버 code-exchange 라우트는 존재하지 않는다**(`find app -type d -name auth` → 0건). 비밀번호 재설정은 `app/update-password/page.tsx` 의 클라이언트 처리다.

### 7.4 회귀 가드 (신규)

`scripts/check-middleware-regression.mjs` 를 `prebuild` 에 연결했다. 이 최적화의 유일한 실패 모드는 **"보호 라우트 분기를 추가하면서 게이트 목록에 넣지 않아 검사가 조용히 사라지는 것"** 이므로, 가드는 성능이 아니라 **보안 불변식**을 강제한다.

검사: ① auth skip 존재 + `getUser()` 보다 앞섬 ② middleware 가 검사하는 **모든** `pathname` 리터럴이 게이트에 포함 ③ `memberRoutes ⊆ AUTH_ROUTE_PREFIXES` ④ matcher 가 보호 라우트·`/sitemap.xml` 을 여전히 매칭 ⑤ matcher 가 폰트 정적 에셋을 제외.

**가드 자체를 음성 테스트로 검증했다(`MEASURED`)** — 6개 고장 시나리오를 사본에 주입해 전부 차단됨을 확인:

| 주입한 고장 | 가드 반응 |
|---|---|
| 새 보호 분기 `/secret` 추가, 게이트 누락 | ✗ 차단 — "그 분기는 절대 실행되지 않는다" |
| `memberRoutes` 의 `/materials` 를 게이트에서 제거 | ✗ 차단 |
| matcher 에 `xml` 추가 (→ `/sitemap.xml` 우회) | ✗ 차단 |
| auth skip 블록 삭제 | ✗ 차단 |
| 폰트 `css`/`woff2` 예외 제거 | ✗ 차단 (3건 동시 검출) |
| 정상본 | ✓ 통과 |

### 7.5 dead code 제거

`publicRoutes` 배열은 선언만 있고 참조가 0이었다(`grep` 전수 확인). 게이트라는 **새 route 목록**을 도입하면서 무관한 옛 목록을 남기면 지침 §11 "중복 route 목록 금지" 에 정면으로 어긋나므로 함께 제거했다.

---

## 8. Security Regression Verification

### 8.1 인증 분기 코드 diff = 0 (`CODE-CONFIRMED`)

`git diff middleware.ts` 상 `if (user) { … } else { … }` 블록 전체가 **무변경**이다. 추가된 것은 파일 상단의 게이트와 진입부 early-return 뿐이고, 삭제된 것은 dead `publicRoutes` 한 줄뿐이다. pending/member/waiting/admin/비로그인 5개 분기 모두 원문 그대로 남아 있다.

### 8.2 비로그인 26개 라우트 응답 전수 대조 (`MEASURED`)

로컬 production 서버(`next start`)에서 수정 전 빌드와 최종 빌드에 동일 probe 를 돌려 status + redirect Location 을 비교했다.

```
$ diff http-before.txt http-final.txt
IDENTICAL — 26개 라우트 응답 100% 동일
```

핵심 항목:

| 경로 | 수정 전 | 수정 후 |
|---|---|---|
| `/admin` | 307 → `/admin/login?next=%2Fadmin` | **동일** |
| `/admin/students` | 307 → `/admin/login?next=%2Fadmin%2Fstudents` | **동일** |
| `/admin/posts/manage` | 307 → `/admin/login?next=%2Fadmin%2Fposts%2Fmanage` | **동일** |
| `/admin/login` | 200 | **동일** |
| `/waiting` | 307 → `/admin/login` | **동일** |
| `/notices` `/gallery` `/materials` `/my-lessons` | 200 (클라이언트 차단) | **동일** |
| `/` `/intro` `/classes` `/contact` `/blog` `/login` … | 200 | **동일** |
| `/intro/director` | 307 → `/director` (페이지 자체 redirect) | **동일** |

`next=` 파라미터의 인코딩까지 문자 단위로 동일하다.

### 8.3 로그인 사용자 분기 — 코드 경로 대조 (지침 §18)

Production 계정 조작은 하지 않았다. 대신 분기 5개가 전후 동일하게 남아 있음을 코드로 대조했고(§8.1), **게이트가 그 분기들에 도달하는 경로를 막지 않음**을 게이트 술어 형태 일치(§7.1) + 가드 검사 ②③(§7.4)로 보장했다.

추가로 **런타임에서 auth 경로 생존을 직접 증명**했다: 가짜 세션 쿠키를 붙이면 보호 라우트는 여전히 Supabase Auth 왕복 비용을 지불한다(로컬 +25~28 ms, Production **+335~343 ms**, §14). auth 를 건너뛰었다면 이 비용이 사라졌을 것이다.

| 분기 | 수정 후 상태 |
|---|---|
| user 없음 + `/admin` → `?next=` redirect | 유지 (실측 §8.2) |
| user 없음 + `/waiting` → `/admin/login` | 유지 (실측 §8.2) |
| user 있음 + pending + member → `/waiting` | 코드 무변경, 게이트 도달 보장 |
| user 있음 + member + 비active → `/login` | 동일 |
| user 있음 + active + `/waiting` → `/` | 동일 |
| user 있음 + `/admin` + (비active or 비admin) → `/admin/login` | 동일 |

### 8.4 방어 심층화 (부수 확인, `CODE-CONFIRMED`)

middleware 는 admin 보호의 유일한 계층이 아니다. `app/admin/layout.tsx` 가 클라이언트에서 `auth.getUser()` + `profiles.role/status` 를 재검사해 비관리자를 `/` 로 돌려보내고, 데이터는 Supabase RLS 로 보호된다. 이번 변경은 이 계층들을 건드리지 않았다.

### 8.5 인증 경계 판정

**약화 없음.** 지침 §9 의 금지 항목 7종(비로그인 `/admin` 접근, 일반 회원 관리자 화면, 비활성 회원 보호 route, admin 검사 소멸, member route 공개화, redirect 목적지 변경, `next=` 처리 파손) 중 발생한 것은 **0건**이다.

---

## 9. Reservation Publishing Non-Regression

### 9.1 관련 소스 diff = 0 (`MEASURED`)

```
$ git diff --stat eba9320 HEAD -- app/page.tsx lib/supabase/server.ts lib/supabase/build.ts \
    components/PostEditor.tsx app/actions/revalidate.ts app/api/cron/blog-publish/ \
    app/blog/ app/sitemap.ts vercel.json next.config.ts
(출력 없음 — diff 0)
```

전체 코드 커밋의 변경 파일은 `middleware.ts`, `scripts/check-middleware-regression.mjs`, `package.json`, `lib/changelog.ts` **4개뿐**이며, 예약발행 경로와 교집합이 없다.

### 9.2 렌더링 분류 불변 (`MEASURED`)

빌드 route table 을 수정 전/후 기계 비교했다.

```
$ diff routes-before.txt routes-final.txt
IDENTICAL
```

```
┌ ƒ /                        ← 홈 Dynamic 유지 ✓
├ ○ /blog          1m   1y   ← ISR 60 유지 ✓
├ ● /blog/[id]     1m   1y   ← SSG+ISR 60 유지 (+68 more paths) ✓
├ ƒ /sitemap.xml             ← 유지 ✓
ƒ Proxy (Middleware)
```

`.next/prerender-manifest.json` 대조:

| 항목 | 수정 전 | 수정 후 |
|---|---|---|
| `routes["/"]` 존재 | **false** (prerender 대상 아님 = Dynamic) | **false** ✓ |
| `routes["/blog"]` | `revalidate 60 / expire 31536000` | **동일** ✓ |
| `/blog/*` prerender 경로 수 | 71 | **71** ✓ |
| `/blog/*` revalidate | 60 | **60** ✓ |

### 9.3 왜 이번 변경이 예약발행에 영향을 줄 수 없는가 (구조적 논증)

예약발행의 공개 여부는 **각 surface 의 쿼리가 언제 재실행되는가**로만 결정된다(Phase 3A §9.2). 이번 변경은:

1. **쿼리를 건드리지 않았다** — `.lte("published_at", now)` 술어가 있는 파일 3개(`app/page.tsx`, `app/blog/page.tsx`, `app/blog/[id]/page.tsx`) 전부 diff 0.
2. **재검증 주기를 건드리지 않았다** — `revalidate` 선언, `revalidatePath` 호출, cron 스케줄·조회 창 전부 diff 0.
3. **렌더링 분류를 바꾸지 않았다** — §9.2 실측.
4. **middleware 는 원래부터 예약발행과 무관하다** — `published_at` 이나 posts 를 읽는 코드가 middleware 에 없다(`CODE-CONFIRMED`).

즉 **이번 성능 수정 때문에 예약발행이 달라질 수 있는 코드 경로가 존재하지 않는다.**

### 9.4 Production 확인 (`MEASURED`)

| 표면 | 응답 | 판정 |
|---|---|---|
| `/` | 200, `Cache-Control: private, no-cache, no-store`, `X-Vercel-Cache: MISS` | **Dynamic 유지** ✓ |
| `/blog` | 200, `X-Vercel-Cache: HIT` | ISR 동작 ✓ |
| `/blog/gimpo-bonjong-…` | 200, `X-Vercel-Cache: PRERENDER` | SSG+ISR 구조 유지 ✓ |
| `/blog/pungmu-dong-…` | 200, `PRERENDER` | 동일 ✓ |
| `/sitemap.xml` | 200, `MISS` (Dynamic) | 유지 ✓ |

DB · 예약글 · cron 은 일체 건드리지 않았다.

---

## 10. Phase 1 / Phase 2 Regression Verification

### Phase 1 (폰트 / inlineCss)

| 항목 | 결과 |
|---|---|
| 통짜 `public/fonts/PretendardVariable.woff2` | **부재** ✓ |
| `app/layout.tsx` 의 `next/font/*` import | **0건** (검출된 3줄은 "왜 쓰지 않는가" 주석) ✓ |
| `next.config.ts` `inlineCss` | **`false`** ✓ |
| dynamic subset woff2 | **92개** ✓ |
| `scripts/check-font-regression.mjs` | prebuild 에서 **PASS** ✓ |
| `/intro` 문서 크기 (Production) | **28,216 B** — Phase 1 보고서 실측치와 정확히 일치 ✓ |

이번 변경은 오히려 Phase 1 자산의 전달 경로를 **개선**했다(matcher 제외, §6).

### Phase 2 (히어로 / LCP)

| 항목 | 결과 |
|---|---|
| `unoptimized` 재등장 | **없음** ✓ |
| 수동 hero `<link rel=preload as=image>` | **0개** (`app/page.tsx`, `app/layout.tsx` 모두) ✓ |
| `app/page.tsx` diff | **0** ✓ |

Phase 1·2 산출물 파일은 이번 작업에서 **한 개도 수정하지 않았다**.

---

## 11. Build / Test

| 검사 | 결과 |
|---|---|
| `npx tsc --noEmit` | **PASS** (exit 0, 오류 0) |
| `npm run build` | **PASS** (exit 0) — Compiled successfully, 126 static pages |
| `node scripts/check-font-regression.mjs` | **PASS** |
| `node scripts/check-middleware-regression.mjs` | **PASS** (게이트 6개 + /api) |
| prebuild 체인 | 두 가드가 빌드마다 실행됨을 빌드 로그로 확인 |
| route table diff | **IDENTICAL** |
| matcher probe diff | 의도한 5줄만 변경 |
| HTTP probe diff (26 라우트) | **IDENTICAL** |
| 가드 음성 테스트 6종 | **전부 차단** |
| `npm run lint` | **FAIL — 기존 문제** (아래) |

### 11.1 lint (지침 §21 — 고치지 않음)

```
> next lint
Invalid project directory provided, no such directory: C:\Users\JUN\gimpo-gugak\lint
```

Next.js 16 에서 `next lint` 서브커맨드가 제거되어 `next <dir>` 로 해석된 결과다. `package.json` 의 `"lint": "next lint"` 는 이번 작업에서 **수정하지 않았고**(diff 상 `prebuild`·`version` 만 변경), 따라서 **이번 작업 이전부터 동일하게 고장난 상태**다. 복구는 별도 후속 사항(§15).

---

## 12. Production Deployment

```
git push origin main
  eba9320..fd91ad7  main -> main
```

- 배포 경로: 기존 검증된 **Vercel Git Integration** (새 배포 경로 만들지 않음)
- DB migration: **없음**
- 환경변수 변경: **없음**
- 배포 커밋: `fd91ad7` (코드), `aedb824` (Phase 3A 문서)

---

## 13. Production Verification

`https://gimpogugak.com` 실측 (브라우저 UA, curl):

| path | cookie | status | X-Vercel-Cache | TTFB | Location |
|---|---|---|---|---|---|
| `/` | no | 200 | **MISS** | 0.72 s | — |
| `/intro` | no | 200 | HIT | 0.230 s | — |
| `/intro` | **yes** | 200 | HIT | 0.224 s | — |
| `/classes` | no | 200 | HIT | 0.262 s | — |
| `/blog` | no | 200 | HIT | 0.280 s | — |
| `/blog` | **yes** | 200 | HIT | 0.225 s | — |
| 폰트 CSS | no | 200 | HIT | **0.125 s** | — |
| 폰트 CSS | **yes** | 200 | HIT | **0.122 s** | — |
| 폰트 woff2 (subset.0) | **yes** | 200 | file | **0.118 s** | — |
| `/robots.txt` | no | 200 | HIT | 0.235 s | — |
| `/sitemap.xml` | no | 200 | MISS | 0.325 s | — |
| **`/admin`** | no | **307** | — | 0.223 s | **`/admin/login?next=%2Fadmin`** |
| **`/admin/students`** | no | **307** | — | 0.226 s | **`/admin/login?next=%2Fadmin%2Fstudents`** |
| **`/waiting`** | no | **307** | — | 0.221 s | **`/admin/login`** |
| `/my-lessons` | no | 200 | HIT | 0.239 s | — |

전 항목이 기대와 일치한다. 특히 `/` 는 `private, no-cache, no-store` + `MISS` 로 **Dynamic 을 유지**한다.

### 13.1 계측 도구 관련 주의 (정직한 한계)

Production 사전 측정은 Node `fetch` 로, 사후 측정은 `curl` 로 수행했다. 사전 측정 중 반복 자동 요청이 **Vercel 봇 보호에 걸려 403** 이 발생했고, 이후 Node `fetch` 클라이언트가 지속 차단되어 `curl`(브라우저 UA)로 전환했기 때문이다.

두 도구는 연결 재사용·TLS 핸드셰이크 특성이 달라 **절대 TTFB 를 도구 간 비교하면 안 된다.** 따라서 §14 의 결론은 전부 **같은 도구·같은 실행 안에서의 "쿠키 유무 델타"** 로만 도출했다. 이 델타가 middleware auth 왕복을 정확히 격리한다.

---

## 14. Performance Before / After

### 14.1 계측 방법

middleware 내부 실행 시간은 외부에서 분리 측정할 수 없다(`NOT MEASURED`). 대신 **관측 가능한 대리 지표**를 사용했다:

> 세션 쿠키가 있으면 `auth.getUser()` 가 Supabase Auth 서버로 실제 왕복한다. 같은 URL 을 **쿠키 없이 / 가짜 세션 쿠키로** 각각 호출한 차이가 곧 middleware auth 비용이다. (익명은 Phase 3A §8.2 대로 왕복이 없어 차이가 0에 가깝다.)

### 14.2 Production — 쿠키 유무 델타 (`MEASURED`, 결정적 증거)

| 경로 | 분류 | 수정 **전** 델타 | 수정 **후** 델타 | 판정 |
|---|---|---:|---:|---|
| `/intro` | 공개 | **+326 ms** | **+16 ms** | 낭비 제거 ✓ |
| `/blog` | 공개 | **+128 ms** | **−13 ms** | 낭비 제거 ✓ |
| `/classes` | 공개 | (미측정) | **+15 ms** | 왕복 없음 ✓ |
| 폰트 CSS | 정적 | **+124 ms** | **−3 ms** | 낭비 제거 ✓ |
| `/my-lessons` | 보호 | — | **+335 ms** | **auth 유지** ✓ |
| `/notices` | 보호 | — | **+343 ms** | **auth 유지** ✓ |
| `/admin` | 보호 | — | **+143 ms** (307) | **auth 유지** ✓ |

공개 라우트의 델타는 ±16 ms 로 **측정 노이즈 수준**이 되었고, 보호 라우트는 수정 전 공개 라우트가 물던 것과 **같은 크기(+326 ms ↔ +335 ms)** 의 비용을 여전히 지불한다. 이보다 명확한 "낭비만 제거되고 검사는 남았다" 의 증거는 없다.

### 14.3 로컬 production 서버 실측 (`MEASURED`, 보조)

세션 쿠키 보유 시 median TTFB (동일 머신, 동일 도구, 10라운드 교차):

| 경로 | 분류 | 수정 전 | 수정 후 | 변화 |
|---|---|---:|---:|---|
| `/intro` | 공개 | 31.6 ms | **5.0 ms** | **−84 %** |
| `/classes` | 공개 | 33.0 ms | **5.6 ms** | **−83 %** |
| `/blog` | 공개 | 32.2 ms | **6.0 ms** | **−81 %** |
| 폰트 CSS | 정적 | 28.0 ms | **5.3 ms** | **−81 %** |
| `/my-lessons` | 보호 | 30.1 ms | 32.0 ms | 유지(auth) |
| `/notices` | 보호 | 31.5 ms | 29.2 ms | 유지(auth) |
| `/gallery` | 보호 | 33.8 ms | 31.2 ms | 유지(auth) |
| `/admin` | 보호 | 24.1 ms | 31.1 ms | 유지(auth, 307) |

로컬 왕복(≈25 ms)이 Production(≈330 ms)보다 작은 것은 개발 머신 → Supabase 경로와 Vercel edge → Supabase 경로의 차이다.

### 14.4 정적 에셋 middleware 매칭 (`MEASURED`)

| 항목 | 수정 전 | 수정 후 |
|---|---|---|
| 폰트 CSS 1개 | middleware 통과 | **제외** |
| 폰트 woff2 92개 | middleware 통과 | **제외** |
| `robots.txt` / `ads.txt` | middleware 통과 | **제외** |
| 보호 라우트 | 통과 | **통과 유지** |

첫 방문 시 실제로 요청되는 subset 조각 수만큼 middleware 호출이 감소한다. 방문당 정확한 조각 수는 렌더 문자에 따라 달라 `NOT MEASURED`.

### 14.5 측정하지 못한 것 (정직한 공백)

| 항목 | 사유 |
|---|---|
| middleware 자체 실행 시간 분리 | Server-Timing 부재, Vercel 로그 미접근 → `NOT MEASURED` |
| 실제 로그인 회원의 Production 체감 | 실계정 조작 금지(지침 §18) → 가짜 세션 쿠키 대리 측정으로 갈음 |
| 홈 `/` TTFB 순변화 | Dynamic SSR + Supabase 2쿼리 비용이 지배적이고 콜드 스파이크 편차가 커 유의미한 분리 불가 → `NOT MEASURED` |
| 방문당 woff2 조각 수 | 렌더 문자 의존 → `NOT MEASURED` |

**이번 수정으로 거대한 PageSpeed 점수 상승을 주장하지 않는다.** 익명 방문자(트래픽 대부분)의 이득은 middleware 호출 수 감소 수준으로 작다. 실질 이득은 **로그인 사용자의 공개 페이지 탐색**과 **정적 에셋 요청 경로 단축**에 집중된다.

---

## 15. Remaining Risks

| # | 위험 | Severity | Confidence | 완화 / 상태 |
|---|---|---|---|---|
| R-1 | 새 보호 라우트 추가 시 게이트 누락 → 인증 검사 소실 | **HIGH** | HIGH | `check-middleware-regression.mjs` 가 prebuild 에서 차단 (음성 테스트 검증 완료, §7.4) |
| R-2 | 공개 라우트에서 middleware 세션 갱신이 사라짐 | LOW | HIGH | 서버측 소비자 0곳 전수 확인, 브라우저 클라이언트 자동 갱신 + 보호 라우트 진입 시 갱신 (§7.3) |
| R-3 | 향후 공개 라우트에 서버측 개인화가 추가되면 게이트와 충돌 | MEDIUM | MEDIUM | 게이트 주석에 명시. 그런 라우트는 게이트에 추가하거나 클라이언트 개인화(Navbar 방식) 유지 |
| R-4 | (기존) 세션 갱신 쿠키가 redirect 응답에 복사되지 않음 — `setAll` 은 `response` 에만 심는데 분기들은 새 `NextResponse.redirect` 를 반환 | LOW | HIGH | **이번 변경 이전부터 존재**하는 동작. 인증 로직 수정 금지 범위라 **손대지 않았다**. 재로그인으로 자연 해소되며 회귀 아님 |
| R-5 | middleware → proxy 컨벤션 deprecated (Next 16 경고) | LOW | HIGH | 지침 §15 대로 **이번 커밋에 섞지 않음**. 빌드 경고는 전후 동일하게 존재. 별도 후속 |
| R-6 | (기존) `npm run lint` 고장 | LOW | HIGH | 기존 문제로 기록만(§11.1). Next 16 은 ESLint CLI 직접 사용 또는 `eslint .` 로의 전환이 필요 |
| R-7 | (기존) `node_modules` 손상 재발 가능성 | LOW | MEDIUM | `npm ci` 로 복구 완료. worktree + junction 실험 시 정리 방식 주의 |
| R-8 | (관찰) `/members` `/my-info` 는 middleware 보호 대상이 아님 | LOW | HIGH | **기존 설계 그대로 보존**. 강화가 필요한지는 제품 결정 사항 — 범위 밖, 기록만 |

---

## 16. Home ISR HOLD Confirmation

대표 결정에 따라 홈 ISR 은 **HOLD** 이며, 이번 작업은 이를 완전히 준수했다.

| 금지 항목 | 상태 |
|---|---|
| `app/page.tsx` 에 `createClientForBuild()` 도입 | **하지 않음** — 파일 diff 0 |
| `revalidateHome()` 추가 | **하지 않음** |
| `revalidatePath("/")` 추가 | **하지 않음** — 코드베이스 전체에 여전히 0건 |
| 홈 prerender guard 추가 | **하지 않음** |
| 홈 렌더링 분류 변경 | **없음** — 빌드 `ƒ /`, manifest 에 `routes["/"]` 부재, Production `no-store` + `MISS` |

지침 §22 의 감시 조건("middleware 수정만으로 `/` 가 `○` 로 바뀌면 배포 중단")은 **발생하지 않았다** — Phase 3A 가 확정한 대로 middleware 는 렌더 분류의 원인이 아니다.

Gallery query(3B-3)도 지침 §30 대로 **변경하지 않았다**.

---

## 17. Repository Integrity

```
$ git status --porcelain        →  (비어 있음, clean)
$ git log --oneline -3
  fd91ad7 perf: 공개 route middleware 인증 낭비 제거 (v5.26.0)
  aedb824 docs: Phase 3A dynamic/cache 구조 감사 보고서 추가
  eba9320 docs: Phase 2 히어로/LCP 이미지 성능 회귀 수정 보고서 추가
```

- 코드 커밋 `fd91ad7` 에 문서·unrelated 변경 **없음** (4개 파일 전부 middleware 최적화 소관)
- 문서 커밋 `aedb824` 에 코드 변경 **없음** (1개 파일)
- `package-lock.json` 변경 **없음** (해시 대조 확인)
- 작업 중 생성한 임시 산출물(probe·measure 스크립트, 빌드 로그, 가드 음성테스트 사본)은 전부 시스템 scratchpad 에 있으며 저장소에 없음
- Production DB · 예약글 · RLS · 환경변수: **일체 미변경**

---

## 18. Final Verdict

# ✅ **PASS**

| # | PASS 조건 (지침 §34) | 충족 | 근거 |
|---|---|---|---|
| 1 | 공개 route 불필요 auth 경로 제거 성공 | ✅ | §7.1, §14.2 (Production 델타 +326 ms → +16 ms) |
| 2 | static font/CSS middleware 우회 성공 | ✅ | §6.3 컴파일 matcher diff, §14.2 |
| 3 | admin/member 보안 완전 유지 | ✅ | §8 (분기 diff 0, 26 라우트 응답 동일, 보호 라우트 auth +335 ms 생존) |
| 4 | 예약발행 코드 변경 0 | ✅ | §9.1 diff 0, §9.2 분류 동일, §9.3 구조적 논증 |
| 5 | 홈 Dynamic 유지 | ✅ | §9.2, §9.4, §16 |
| 6 | Phase 1/2 회귀 0 | ✅ | §10 |
| 7 | build / type PASS | ✅ | §11 |
| 8 | Production 정상 | ✅ | §13 |

**비핵심 계측 공백**(middleware 내부 시간, 실계정 회원 체감, 홈 TTFB 순변화)은 §14.5 에 명시했다. 이 공백들은 판정의 근거가 된 8개 조건 중 어느 것에도 영향을 주지 않는다 — 인증 경계와 예약발행 불변식은 모두 **코드 diff + 실측**으로 직접 확인했기 때문이다.

### 후속 사항 (이번 범위 밖, 기록만)

1. **middleware → proxy 개명** (Next 16 deprecation) — 기능 변경과 분리해 별도 커밋 (R-5)
2. **`npm run lint` 복구** — Next 16 의 `next lint` 제거 대응 (R-6)
3. **홈 ISR** — 대표 결정으로 HOLD. 재검토 시 Phase 3A §17 참조
4. `/sitemap.xml` 의 Dynamic 정리, sitemap 카테고리 누락(Phase 3A R-8) — 미착수
