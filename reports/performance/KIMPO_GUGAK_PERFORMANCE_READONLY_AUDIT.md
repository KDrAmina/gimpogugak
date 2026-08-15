# 김포국악원 홈페이지 READ-ONLY 성능 감사 보고서

- **대상**: `https://gimpogugak.com` (Production)
- **저장소**: `C:\Users\JUN\gimpo-gugak` — branch `main`, HEAD `b770fea`
- **감사 일시**: 2026-08-15 (측정 시각 UTC 2026-08-14 17:39~17:45)
- **감사 유형**: READ-ONLY. 소스/설정/DB/배포 **일체 미변경**
- **최종 판정**: 🔴 **CRITICAL PERFORMANCE REMEDIATION REQUIRED**

증거 등급 표기: `MEASURED`(실측) / `CODE-CONFIRMED`(코드 확인) / `INFERRED`(추론) / `NOT VERIFIED`(미확인)

---

## 1. Executive Summary

### 결론 한 줄

> **폰트가 문제다.** 이미지도, Supabase 쿼리도, JS 번들도, 본문 직렬화도 아니다.
> 초기 전송량의 **80.2%가 폰트**이며, HTML 문서의 **88.0%가 `@font-face` CSS(그것도 2번 중복)** 다.

### 핵심 수치 3개 (`MEASURED`)

| 지표 | 실측값 |
|---|---|
| 홈 초기 전송량 (모바일 콜드) | **2,639,972 B ≈ 2.64 MB** |
| 그중 폰트 | **2,118,504 B = 80.2%** |
| 그중 `PretendardVariable.woff2` 단일 파일 | **2,057,688 B = 77.9%** |
| 홈 HTML 문서 (압축 해제) | **1,593,123 B ≈ 1.52 MB** |
| 그중 실제 눈에 보이는 텍스트 | **2,860 B = 0.18%** |

### 확정된 4대 Root Cause

| # | Root Cause | 등급 | 근거 |
|---|---|---|---|
| **RC-1** | `PretendardVariable.woff2` **2.0 MB 비서브셋 폰트를 HTTP `Link:` 헤더로 preload** | 🔴 CRITICAL | `MEASURED` 2,057,688 B / `CODE-CONFIRMED` `app/layout.tsx:10-15` |
| **RC-2** | **미사용 한글 Google Font 5종**이 `@font-face` 규칙 **1,214개(683 KB)** 를 생성, `inlineCss`로 **HTML에 2번 인라인** → 1.40 MB | 🔴 CRITICAL | `MEASURED` / `CODE-CONFIRMED` `app/layout.tsx:17-60` |
| **RC-3** | 홈 `/` 만 **Dynamic 렌더링** — CDN 캐시 0%, 매 요청 SSR + Supabase 2쿼리 | 🟠 HIGH | `MEASURED` `X-Vercel-Cache: MISS` / **빌드 출력 `ƒ /`** |
| **RC-4** | LCP 히어로 이미지 `unoptimized` → 175 KB (최적화 시 28 KB) | 🟠 HIGH | `MEASURED` 175,424 vs 28,486 B / `CODE-CONFIRMED` `app/page.tsx:128` |

### 최근 점수 하락의 직접 원인 (`CODE-CONFIRMED`)

**2026-03-30 하루에 커밋 3개**가 연달아 들어가면서 발생했다. 세 커밋 모두 **"성능 최적화"를 의도**했으나 실제로는 전부 성능을 악화시켰다.

| 커밋 | 날짜 | 의도 | 실제 결과 |
|---|---|---|---|
| `0bf8b63` | 03-30 15:08 | "모바일 PageSpeed 최적화: LCP/FCP 개선" | Pretendard를 preload + async로 변경 |
| `64ec14e` | 03-30 | "메인 이미지 unoptimized 강제 적용 (LCP 병목 해결)" | **LCP 이미지가 28 KB → 175 KB (6.2배 증가)** |
| `4621b6b` | 03-30 16:06 | "블로그 최적화" | **Pretendard Dynamic Subset CDN(사용 글자만 로딩) → 자체 호스팅 2.0 MB 통짜 폰트** |

`4621b6b`이 결정타다. 이전에는 `pretendard-dynamic-subset.css`(jsDelivr)를 썼고 이는 **실제 사용된 글자의 서브셋만** 내려받는 방식이었다. 이를 `next/font/local` + 단일 2.0 MB `woff2`로 교체하면서, next/font가 자동으로 `<link rel=preload as=font>`(HTTP `Link:` 헤더)를 생성 → **모든 페이지에서 2 MB를 최우선 순위로 내려받게** 되었다.

---

## 2. Audit Scope

### 검사한 범위

- ✅ Production HTTP 실측 (HTML/JS/CSS/Font/Image, 6개 라우트)
- ✅ Transfer Size vs Resource Size 분리 측정 (identity / gzip / br 3회 각각)
- ✅ 응답 헤더 (`cache-control`, `content-encoding`, `x-vercel-cache`, `age`, `link`)
- ✅ HTML 문서 구성요소별 바이트 해부 (style / inline script / RSC flight / DOM)
- ✅ `@font-face` 규칙 1,214개 패밀리별 분해
- ✅ 로컬 production build (`npm run build`) → 라우트별 렌더링 모드 확정
- ✅ `/` 라우트 Server/Client 컴포넌트 경계 및 Supabase 쿼리 전수 추적
- ✅ Git history 역추적 (폰트·이미지·config 변경 시점)
- ✅ `select('*')` 전수 조사

### 검사하지 못한 범위 (→ §14)

- ❌ Lighthouse 실측 (PSI API 일일 쿼터 소진, Chrome 확장 미연결)
- ❌ 실제 브라우저 네트워크 워터폴 / 우선순위 / LCP 요소 확정
- ❌ CrUX Field Data
- ❌ Supabase 서버측 쿼리 latency

---

## 3. Environment / Repository Baseline

| 항목 | 값 |
|---|---|
| Framework | Next.js `^16.1.6` (App Router) |
| React | `^18.3.1` |
| Bundler | Turbopack (`turbopack: {}`) |
| Styling | Tailwind CSS `^3.4.1` |
| DB/Auth | Supabase (`@supabase/ssr ^0.5.0`) |
| Host | Vercel (`Server: Vercel`, 리전 `icn1`) |
| Editor | **TinyMCE** (`tinymce ^8.3.2`) — CLAUDE.md의 React-Quill 기술은 **현행이 아님** |
| Middleware | `middleware.ts` 존재 (3,714 B), `/` 포함 매칭 |
| 무거운 의존성 | `recharts ^3.8.1`, `framer-motion ^11.11.0`, `xlsx`, `solapi`, `tinymce` |

**Git 상태 (감사 시작 시점)**: `git status --porcelain` → **완전 clean**. 감사 시작 전 기존 변경사항 **없음**.

> ⚠️ **문서 정합성 이슈**: `CLAUDE.md` §2·§3 전체가 React-Quill 기준으로 작성되어 있으나, 커밋 `bf590e7`(2026-03-12, "TinyMCE 에디터 전면 도입, Quill 완전 제거")로 이미 대체됨. `MEMORY.md`의 Quill 항목도 동일하게 무효. (성능과 무관하나 향후 작업 오도 위험)

---

## 4. Production Baseline (`MEASURED`)

### 4.1 홈 `/` 문서 응답

```
HTTP/1.1 200 OK
Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate   ← 캐시 전면 금지
Content-Encoding: br
X-Vercel-Cache: MISS                                                      ← 4회 연속 전부 MISS
Age: 0
Vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch
Link: </_next/static/media/7fc9c92292d32c4a-s.p.c199330c.woff2>; rel=preload; as="font"
      </_next/static/media/PretendardVariable-s.p.77d5d991.woff2>; rel=preload; as="font"   ← 2.0 MB
      </_next/static/media/fca78c2ee6cec166-s.p.11a55858.woff2>; rel=preload; as="font"
```

| 인코딩 | 바이트 | 비고 |
|---|---:|---|
| identity (Resource Size) | **1,593,123** | 브라우저가 압축 해제 후 파싱해야 하는 실제 크기 |
| brotli (Transfer Size) | **99,713** | 압축률 **16.0 : 1** ← 극단적 반복 데이터의 신호 |
| gzip (Transfer Size) | 493,480 | 압축률 3.2 : 1 |

### 4.2 TTFB (4회 연속, 동일 세션)

| 회차 | TTFB | X-Vercel-Cache |
|---|---:|---|
| 1 (cold) | **2.588 s** | MISS |
| 2 | 0.468 s | MISS |
| 3 | 0.474 s | MISS |
| 4 | 0.450 s | MISS |

→ **캐시가 전혀 동작하지 않음.** 모든 요청이 오리진 SSR.

### 4.3 라우트별 비교 (`MEASURED`)

| 라우트 | Resource | BR Transfer | TTFB | Vercel-Cache | Cache-Control |
|---|---:|---:|---:|---|---|
| **`/`** | **1,593,123** | 99,713 | 0.420 s | **MISS** | **private, no-cache, no-store** |
| `/classes` | 1,586,985 | 97,740 | 0.252 s | HIT | public, max-age=0, must-revalidate |
| `/blog` | 1,604,479 | 104,018 | 0.245 s | HIT | public, max-age=0, must-revalidate |
| `/activities` | 1,960,743 | 120,278 | 0.383 s | HIT | public, max-age=0, must-revalidate |
| `/contact` | 1,573,498 | 95,486 | 0.216 s | HIT | public, max-age=0, must-revalidate |
| `/intro` | 1,569,762 | 93,989 | 0.234 s | HIT | public, max-age=0, must-revalidate |

**두 가지가 동시에 보인다:**
1. **폰트 CSS 바닥값 ≈ 1.57 MB가 전 페이지 공통** — 콘텐츠가 거의 없는 `/intro`조차 1.57 MB
2. **`/` 만 MISS** — 유일하게 CDN 캐시를 못 받는 라우트

---

## 5. Network Payload Breakdown

### 5.1 모바일 콜드 로드 — Above-the-fold Critical Path (`MEASURED`)

| Type | Requests | Transfer Size | Resource Size | 주요 원인 |
|---|---:|---:|---:|---|
| **Document/HTML** | 1 | 99,713 | 1,593,123 | @font-face CSS 2중 인라인 (88.0%) |
| **RSC/Flight** | 0 (문서 내 인라인) | — | *799,659* | 위 HTML에 포함. 폰트 CSS 중복분 |
| **CSS** | **0 (외부 없음)** | 0 | *767,984* | `inlineCss:true` → 문서에 인라인, **캐시 불가** |
| **JS** | 13 | 246,331 | 803,091 | 아래 5.3 |
| **Fonts** | 3 (preload) | **2,118,504** | **2,118,504** | **Pretendard 2,057,688** |
| **Images** | 1 (히어로) | 175,424 | 175,424 | `unoptimized` |
| **XHR/Fetch** | 0 | 0 | 0 | 클라이언트 재조회 없음 |
| **Third-party** | 1 (gtag, lazyOnload) | 지연 | 지연 | 초기 경로 밖 |
| **TOTAL** | **18** | **2,639,972** | **4,690,142** | |

> *기울임* = 상위 항목에 포함되는 내역이므로 합계에 중복 산입하지 않음.

**폰트 비중: 전송량의 80.2% / Pretendard 단독 77.9%** — 이것이 Q3의 답이다.

### 5.2 HTML 문서 1,593,123 B 해부 (`MEASURED`)

| 구성요소 | 바이트 | 비율 |
|---|---:|---:|
| `@font-face` CSS — `<style>` 블록 | 699,922 | 43.9% |
| `@font-face` CSS — **RSC flight 중복분** | ~702,000 | 44.1% |
| Tailwind + globals.css (실제 스타일) | 68,062 | 4.3% |
| 렌더링된 DOM 마크업 | 18,508 | 1.2% |
| ㄴ **그중 실제 보이는 텍스트** | **2,860** | **0.18%** |
| **폰트 CSS 합계 (2중)** | **1,401,922** | **88.0%** |

### 5.3 JS 청크 13개 (`MEASURED`, 전부 `immutable` 캐시 정상)

| 청크 | Transfer (br) | Resource |
|---|---:|---:|
| `c362a2181257f15f.js` | 71,098 | 223,454 |
| `8b84f4268769c838.js` | 44,512 | 167,933 |
| `a6dad97d9634a72d.js` | 41,343 | 112,594 |
| `3005a2d6acab9f56.js` | 23,353 | 84,443 |
| `ede07827fa0504fb.js` | 15,792 | 50,681 |
| `80c6256e0702c86b.js` | 15,336 | 45,923 |
| `a6cfbee5cb1d3323.js` | 11,522 | 33,600 |
| 기타 6개 | 23,375 | 84,463 |
| **합계** | **246,331** | **803,091** |

**판정: JS는 정상 범위.** 246 KB 전송 / 803 KB 파싱은 App Router + Supabase + Analytics 구성에서 과하지 않다. **폰트 하나가 JS 전체의 8.6배**다.

### 5.4 폰트 3종 preload (`MEASURED`)

| 파일 | 바이트 | 패밀리 | unicode-range | 홈에서 사용? |
|---|---:|---|---|---|
| `PretendardVariable-s.p.*.woff2` | **2,057,688** | pretendard (100-900 variable) | **없음 (통짜 전체)** | ✅ body 기본 폰트 |
| `7fc9c92292d32c4a-s.p.*.woff2` | 34,732 | **Noto Serif KR** (400/600/700) | latin | ❌ **미사용** |
| `fca78c2ee6cec166-s.p.*.woff2` | 26,084 | **Noto Sans KR** (400/500/700) | latin | ❌ **미사용** |
| **합계** | **2,118,504** | | | **60,816 B 완전 낭비** |

---

## 6. PageSpeed / Core Web Vitals Analysis

> ⚠️ Lighthouse 직접 실행 실패 (§14). 아래는 **실측 리소스 값에서의 추론**이며 점수를 단정하지 않는다.

| 지표 | 예상 영향 | 근거 | 등급 |
|---|---|---|---|
| **TTFB** | 나쁨 | 실측 0.42~2.59 s, `X-Vercel-Cache: MISS` 100% | `MEASURED` |
| **FCP** | 나쁨 | 1.52 MB HTML 압축 해제 + 파싱 + **1,214개 `@font-face` CSSOM 구축**이 첫 페인트 앞을 막음 | `INFERRED` |
| **LCP** | 나쁨 | 히어로 이미지(175 KB, srcset 없음)가 **2 MB 폰트와 동일 preload 우선순위로 대역폭 경쟁** | `INFERRED` |
| **TBT** | 중간 | JS 246 KB는 정상. 다만 1.52 MB HTML 파싱 + 대형 CSSOM 구축이 메인스레드 롱태스크 유발 | `INFERRED` |
| **CLS** | 양호 | 히어로 `width/height` 명시 + `placeholder="blur"`, 뱃지 `min-h-[52px]` | `CODE-CONFIRMED` |

**Lighthouse가 반드시 지적할 항목 (`INFERRED`, 실측 근거 있음):**
- `Avoid enormous network payloads` → 폰트 2.1 MB
- `Reduce unused CSS` → `@font-face` 683 KB 중 홈에서 쓰는 건 Pretendard 1개 규칙(154 B)뿐
- `Properly size images` / `Serve images in next-gen formats` → 히어로 175 KB WebP, srcset 없음, AVIF 미제공
- `Reduce initial server response time` → TTFB
- `Preload key requests` 오용 → 미사용 Noto 2종 preload

### CLS 관련 주의 (`CODE-CONFIRMED`)

`display: "swap"` + **2 MB 폰트**의 조합은 폰트 도착까지 fallback으로 그려지다가 스왑되며 **긴 FOUT 구간**을 만든다. next/font의 자동 fallback metric(`pretendard Fallback` @font-face 확인됨)이 CLS는 억제하지만, **체감상 글자가 뒤늦게 바뀌는 현상**은 남는다.

---

## 7. GPT Hypothesis Verification

| # | GPT 사전 가설 | 판정 | 실제 확인 내용 | 증거 |
|---|---|---|---|---|
| A | 초기 HTML/RSC 과대 | ✅ **CONFIRMED** *(단, 원인은 GPT 추정과 다름)* | HTML 1,593,123 B. 단 원인은 게시물/데이터가 아니라 **@font-face CSS 2중 인라인 88.0%**. RSC flight 799,659 B 중 대부분이 폰트 CSS 중복분 | `MEASURED` §5.2 |
| B | Supabase 과다조회 | ❌ **REJECTED** | 홈의 쿼리 2개 모두 **명시적 컬럼 선택**. `select('*')` 전무 | `CODE-CONFIRMED` `app/page.tsx:48-62` |
| C | 본문 전체 직렬화 | ❌ **REJECTED** | `posts` 쿼리에 `content`/`body`/HTML **미포함**. flight payload에 본문 문자열 없음 | `CODE-CONFIRMED` `app/page.tsx:56` + `MEASURED` |
| D | Client 범위 과다 | ❌ **REJECTED** | 홈 Client 컴포넌트 4개 총 **8.4 KB 소스**. 전부 정당(onClick/useState/analytics). Page·Layout·HomeBadges·HomeConnect는 Server | `CODE-CONFIRMED` §9.2 |
| E | 큰 props 전달 | ❌ **REJECTED** | Server→Client props 전달 자체가 없음. photos/posts는 Server 컴포넌트 내부에서만 렌더 | `CODE-CONFIRMED` `app/page.tsx:196-265` |
| F | JS bundle 과다 | ❌ **REJECTED** | 13청크 246 KB 전송 / 803 KB 파싱 — 정상. TinyMCE·recharts·xlsx **공개 번들 미유입** 확인 | `MEASURED` §5.3 |
| G | 중복 fetch | ❌ **REJECTED** | 홈에 클라이언트 재조회 없음. XHR 0건. layout↔page 중복 쿼리 없음 | `CODE-CONFIRMED` + `MEASURED` |
| H | 이미지 문제 | 🟡 **PARTIAL** | 대부분 `/_next/image`+srcset+lazy로 **정상**. 단 **히어로만 `unoptimized`**로 175 KB (AVIF 28 KB 가능). `gimpogugak_map.png` 원본 650 KB는 `/_next/image` 경유(22 KB)라 런타임 무해 | `MEASURED` §10 |
| I | Hero/LCP 리소스 전략 | ✅ **CONFIRMED** | preload 정상이나 ①`unoptimized`로 6.2배 과대 ②**2 MB 폰트와 preload 우선순위 경쟁** ③`sizes` 지정했으나 `unoptimized`라 무효(srcset 미생성) | `MEASURED` + `CODE-CONFIRMED` |
| J | eager/priority 과다 | 🟡 **PARTIAL** | 이미지는 히어로 1개만 priority — 정상. 그러나 **미사용 폰트 2종(60,816 B)이 preload**됨 + **히어로 preload 태그가 2개 중복** | `MEASURED` §5.4, §10.3 |
| K | Font 문제 | ✅ **CONFIRMED (최우선)** | **6개 패밀리 / `@font-face` 1,214개 / woff2 URL 712개 / CSS 683 KB / preload 2.12 MB.** 4개 패밀리는 CSS 변수가 **어디에서도 소비되지 않음** | `MEASURED` + `CODE-CONFIRMED` §8.2 |
| L | CSS 문제 | ✅ **CONFIRMED** | 실제 Tailwind CSS는 68,062 B로 정상. 문제는 **@font-face 683 KB + `inlineCss:true`로 인한 2중 인라인 + 외부 stylesheet 0개 → 페이지 간 캐시 재사용 불가** | `MEASURED` §5.2 |
| M | Third-party 문제 | ❌ **REJECTED** | HTML 내 서드파티는 `googletagmanager` 1개뿐, `strategy="lazyOnload"`. Vercel Analytics/Speed Insights는 `dynamic({ssr:false})`. **초기 경로 밖** | `CODE-CONFIRMED` `app/layout.tsx:174-185`, `components/AnalyticsSpeedInsights.tsx` |
| N | Cache 문제 | ✅ **CONFIRMED** | 정적 asset은 `immutable` 정상. 그러나 **`/`만 `private, no-cache, no-store` + MISS 100%**. 추가로 인라인 CSS 1.5 MB는 **재방문·페이지이동 시 매번 재전송** | `MEASURED` §4 |
| O | Next rendering 문제 | ✅ **CONFIRMED** | 빌드 출력 **`ƒ /`** — 공개 마케팅 페이지 중 **홈만 Dynamic**. `revalidate = 60`이 `cookies()`에 의해 무효화 | **빌드 출력** + `CODE-CONFIRMED` |

### 집계

| 판정 | 건수 | 항목 |
|---|---:|---|
| ✅ CONFIRMED | **6** | A, I, K, L, N, O |
| 🟡 PARTIAL | **2** | H, J |
| ❌ REJECTED | **7** | B, C, D, E, F, G, M |
| ⚪ NOT VERIFIABLE | **0** | — |

> **주목**: GPT가 가장 강하게 의심했던 **데이터 계층 5개 가설(B·C·D·E·G)이 전부 REJECTED**다. 이 코드베이스의 데이터 흐름은 오히려 잘 설계되어 있다. 실제 병목은 전혀 다른 곳(폰트/렌더링모드)에 있었다.

---

## 8. Root Cause Analysis

### RC-1 🔴 CRITICAL — Pretendard 2.0 MB 통짜 폰트 preload

**증상 → 원인 체인 (`MEASURED` + `CODE-CONFIRMED`)**

```
모바일 초기 전송량 2.64 MB
  ↓
그중 2,057,688 B (77.9%) 가 PretendardVariable.woff2 단일 파일
  ↓
app/layout.tsx:10-15  localFont({ src: "../public/fonts/PretendardVariable.woff2" })
  ↓  next/font/local 은 preload 를 자동 활성화
HTTP 응답 헤더에 Link: <...PretendardVariable...>; rel=preload; as="font"
  ↓  as=font preload = 최고 우선순위, 렌더 시작과 동시에 fetch
LCP 히어로 이미지(175 KB)와 대역폭 정면 경쟁
  ↓
LCP 지연 + FCP 이후 장시간 FOUT
```

**핵심 사실**: 이 woff2에는 **`unicode-range`가 없다**(`MEASURED`, §5.4). 즉 한글 11,172자 + Latin + 기호 전체가 담긴 **단일 통짜 파일**이며, 브라우저는 "가"자 하나를 그리려고 2 MB 전부를 받아야 한다.

**결정적 대조 (`CODE-CONFIRMED`)**: 커밋 `4621b6b` 직전까지는 **Pretendard Dynamic Subset CDN**을 썼다.

```diff
-        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
-        <link rel="preload" as="style"
-          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.css" />
```

커밋 `34c34b1`의 메시지가 그 의도를 직접 밝힌다 — *"Pretendard Dynamic Subset CDN 링크 추가 (font-display:swap 내장, **사용 글자만 로딩**)"*. Dynamic Subset은 `unicode-range`로 쪼개진 수백 개 조각 중 **실제 쓰인 글자의 조각만** 내려받는다. 이를 통짜 2 MB로 되돌린 것이 이번 성능 하락의 최대 단일 원인이다.

---

### RC-2 🔴 CRITICAL — 미사용 한글 폰트 5종이 만든 683 KB CSS의 2중 인라인

**패밀리별 `@font-face` 실측 (`MEASURED`)**

| 패밀리 | 규칙 수 | CSS 바이트 | CSS 변수 소비처 | 홈 사용 |
|---|---:|---:|---|---|
| Noto Serif KR | 372 | 233,772 | **없음** | ❌ |
| Noto Sans KR | 372 | 233,400 | globals.css fallback(블로그 전용) | ❌ |
| Nanum Myeongjo | 184 | 92,356 | `.blog-content h1~h3`(블로그 전용) | ❌ |
| Nanum Gothic | 184 | 91,988 | **없음** | ❌ |
| Gowun Dodum | 95 | 47,320 | **없음** | ❌ |
| pretendard | 1 | 154 | `tailwind.config.js:14`, `globals.css:31,41` | ✅ |
| Fallback 6종 | 6 | 932 | (자동 생성) | — |
| **합계** | **1,214** | **699,922** | | |

**미사용 확정 (`CODE-CONFIRMED`)** — 전수 grep 결과, 다음 4개 CSS 변수는 **정의된 `app/layout.tsx` 외 어디에서도 참조되지 않는다**:

- `--font-noto-serif` → `app/layout.tsx:20` 에만 존재
- `--font-noto-sans` → `app/layout.tsx:28` 에만 존재
- `--font-gowun-dodum` → `app/layout.tsx:36` 에만 존재
- `--font-nanum-gothic` → `app/layout.tsx:56` 에만 존재

**함정 하나 더**: `app/page.tsx:91`의 `<h1 className="font-serif">`는 Noto Serif KR을 쓰지 않는다. `tailwind.config.js:11-17`은 `fontFamily.sans`만 확장했고 `serif`는 건드리지 않았으므로, `font-serif` = Tailwind 기본값 `ui-serif, Georgia, Cambria, "Times New Roman", ...` 로 해석된다. **즉 233 KB짜리 Noto Serif KR을 CSS에 싣고 preload까지 하면서, 정작 h1은 시스템 폰트로 그려진다.**

**2중 인라인 메커니즘 (`MEASURED`)**

```
next.config.ts:29   experimental.inlineCss: true
  ↓
① SSR HTML <style> 블록에 인라인 ............ 767,984 B (@font-face 699,922 B)
② RSC flight payload(self.__next_f.push)에 동일 CSS 재직렬화 ... 799,659 B
     └ flight 내 @font-face 출현 횟수 = 1,214 (① 과 정확히 동일)
  ↓
<link rel="stylesheet"> = 0개  ← 외부 CSS 파일이 아예 없음
  ↓
문서 1,593,123 B 중 1,401,922 B (88.0%) 가 폰트 CSS
  ↓
페이지를 이동할 때마다, 재방문할 때마다 1.5 MB를 다시 받고 다시 파싱
```

`inlineCss`는 원래 소규모 CSS의 렌더블로킹을 없애는 기능이다. 그러나 CSS가 683 KB일 때는 **캐시 가능한 외부 파일을 캐시 불가능한 인라인으로 바꾸고, RSC 페이로드에 한 번 더 복제하는** 정반대 효과를 낸다.

---

### RC-3 🟠 HIGH — 홈만 Dynamic 렌더링

**빌드 출력 (결정적 증거)**

```
Route (app)                    Revalidate  Expire
┌ ƒ /                                              ← 유일한 Dynamic 공개 페이지
├ ○ /about        ├ ○ /activities   ├ ○ /classes
├ ○ /contact      ├ ○ /intro        ├ ○ /Song-Ri-Gyel
├ ○ /blog                  1m    1y
├ ● /blog/[id]             1m    1y
...
ƒ  (Dynamic)  server-rendered on demand
```

**원인 체인 (`CODE-CONFIRMED`)**

```
app/page.tsx:44        const supabase = await createClient()
  ↓
lib/supabase/server.ts:5   const cookieStore = await cookies()
  ↓
cookies() 호출 → Next.js가 라우트를 Dynamic 으로 강제 전환
  ↓
app/page.tsx:25 의 `export const revalidate = 60` 무효화
  ↓
Cache-Control: private, no-cache, no-store  /  X-Vercel-Cache: MISS (4/4)
  ↓
매 방문마다: middleware → Supabase 2쿼리 → SSR → 1.52 MB 직렬화
  ↓
TTFB 0.42~2.59 s
```

**같은 저장소 안에 이미 정답이 두 가지 있다:**

1. `app/blog/page.tsx:7` — 동일한 쿠키 기반 `createClient()`를 쓰지만 `export const dynamic = "force-static"`으로 **강제 정적화** → 빌드 결과 `○ /blog`
2. `app/activities/page.tsx:8-12` — `@supabase/supabase-js`의 쿠키 없는 클라이언트 직접 생성 → `○ /activities`
3. `lib/supabase/build.ts` — 이미 **쿠키 없는 빌드용 클라이언트가 구현되어 있음**

`app/page.tsx`만 이 처리를 못 받았다. `CLAUDE.md` §2에도 *"Public list pages use SSG/ISR"*라고 적혀 있으나 홈은 그 목록에서 빠져 있다.

---

### RC-4 🟠 HIGH — LCP 히어로 이미지 `unoptimized`

**실측 대조 (`MEASURED`)**

| 방식 | 크기 | 포맷 | srcset |
|---|---:|---|---|
| 현재 (`unoptimized`) `/main_image.webp` | **175,424 B** | WebP 1200×600 | **없음** |
| `/_next/image?url=%2Fmain_image.webp&w=828&q=75` | **28,486 B** | **AVIF** | 있음 |
| **차이** | **−146,938 B (−83.8%)** | | |

**원인 (`CODE-CONFIRMED`)**: `app/page.tsx:128`의 `unoptimized` — 커밋 `64ec14e`(2026-03-30) *"메인 이미지 unoptimized 강제 적용 (LCP 병목 해결)"*. **LCP 병목을 해결하려던 변경이 LCP 리소스를 6.2배로 키웠다.**

**부수 효과**: `unoptimized`는 srcset 생성을 막으므로 `app/page.tsx:131`의 `sizes="(max-width: 640px) 100vw, ..."`가 **완전히 무의미**해진다. 실제 서빙 HTML에서 히어로만 `srcset` 없음을 확인했다(`MEASURED`). 360 px 폭 단말도 1200 px 이미지를 그대로 받는다.

**대조군**: 같은 페이지의 다른 이미지 8개는 전부 `/_next/image` + srcset + `loading="lazy"`로 **정상 동작 중**이다. 히어로 하나만 예외다.

---

## 9. Source Trace

### 9.1 `/` 데이터 흐름 (`CODE-CONFIRMED`)

```
middleware.ts:4-99  [Edge/Node]
  ├ matcher(:111) 가 "/" 매칭 → 홈 요청마다 실행
  ├ createServerClient(:14)
  └ await supabase.auth.getUser()  (:38-40)   ← 매 요청 실행
       ↓
app/layout.tsx  RootLayout [Server]
  ├ localFont Pretendard (:10-15)      → 2,057,688 B preload
  ├ Noto_Serif_KR preload:true (:17-23) → 233,772 B CSS + 34,732 B preload  ✗미사용
  ├ Noto_Sans_KR  preload:true (:25-31) → 233,400 B CSS + 26,084 B preload  ✗미사용
  ├ Gowun_Dodum   preload:false(:33-42) → 47,320 B CSS                      ✗미사용
  ├ Nanum_Myeongjo preload:false(:44-51)→ 92,356 B CSS   (블로그 전용)
  ├ Nanum_Gothic  preload:false(:53-60) → 91,988 B CSS                      ✗미사용
  ├ <Script gtag lazyOnload> (:174-185)
  ├ JSON-LD ×2 (:188-206)   ~1.4 KB — 정상
  ├ <Navbar/> [Client]
  ├ <AnalyticsSpeedInsights/> [Client, dynamic ssr:false]
  └ <GoogleAnalyticsWrapper/> [Client, useEffect]
       ↓
app/page.tsx  HomePage [Server, async]
  ├ :25  export const revalidate = 60        ← cookies()에 의해 무효
  ├ :44  createClient()  → lib/supabase/server.ts:5  cookies()  ★ Dynamic 전환점
  ├ :48-62 Promise.all([ gallery 4건, posts 5건 ])
  ├ :67  <link rel=preload as=image>          ← 중복 preload ①
  ├ :122 <Image priority unoptimized>         ← 중복 preload ② + 175 KB
  ├ :186 <aside className="hidden lg:flex">   ← 모바일에서 DOM만 생성, 미표시
  └ :315-316 <Suspense><HomeBadges/><HomeConnect/></Suspense>  [Server]
```

### 9.2 Server / Client 경계 (`CODE-CONFIRMED`)

| 컴포넌트 | 유형 | 소스 크기 | Client 사유 | 판정 |
|---|---|---:|---|---|
| `RootLayout` | Server | — | — | ✅ |
| `HomePage` | Server | — | — | ✅ |
| `HomeBadges` | **Server** | 1,181 B | — | ✅ |
| `HomeConnect` | **Server** | 1,530 B | — | ✅ |
| `HeroCTA` | Client | 1,139 B | `onClick` 전환추적 | ✅ 정당 |
| `PhoneCallLink` | Client | 357 B | 클릭 핸들러 | ✅ 정당 |
| `Navbar` | Client | 6,929 B | 모바일 메뉴 상태 | ✅ 정당 |
| `AnalyticsSpeedInsights` | Client | 405 B | `dynamic({ssr:false})` | ✅ 정당 |
| `GoogleAnalyticsWrapper` | Client | 467 B | `localStorage` 체크 | ✅ 정당 |

**Client 컴포넌트 소스 총합 8,392 B.** Server→Client props 전달 **없음**. hydration 대상이 최소로 유지되어 있다 — **이 부분은 잘 설계되어 있다.**

### 9.3 Supabase 쿼리 감사 (`CODE-CONFIRMED`)

| 위치 | 테이블 | 선택 컬럼 | UI 실사용 | 과다조회 |
|---|---|---|---|---|
| `app/page.tsx:49-52` | `gallery` | `id, image_url, caption` | `photo.id`(:200), `image_url`(:205), `caption`(:206) | ❌ **없음 (3/3 사용)** |
| `app/page.tsx:54-61` | `posts` | `id, slug, title, external_url, published_at` | `id`(:252), `slug`(:238), `title`(:246), `external_url`(:237), `published_at`(:241) | ❌ **없음 (5/5 사용)** |

`select('*')` 전수 조사 결과 **13곳** 발견 — 전부 `/admin/*`(8), `/api/*`(1), 회원전용 `/my-info`·`/my-lessons`·`/notices`·`/waiting`(4). **공개 마케팅 페이지에는 0건.** PageSpeed 측정 대상인 `/`와 무관하다.

**단, 낭비 구간 하나 (`CODE-CONFIRMED`)**: `gallery` 4건 쿼리는 `app/page.tsx:186`의 `<aside className="hidden lg:flex">` 안에서만 쓰인다. **모바일에서는 렌더링만 되고 화면에 표시되지 않는데도** 매 요청 Supabase를 조회하고 HTML에 직렬화한다. 페이로드 영향은 작지만(≈1.5 KB) TTFB에는 기여한다.

---

## 10. Claude Independent Findings — 신규 발견

GPT 사전 가설에 없었으나 감사 중 독립 발견한 항목 **7건**.

### 🆕 F-1 🔴 CRITICAL — 인라인 CSS가 RSC flight payload에 통째로 중복 직렬화

| 항목 | 값 |
|---|---|
| **발견** | 동일한 683 KB `@font-face` CSS가 `<style>` 블록과 `self.__next_f.push` RSC flight 양쪽에 **각각 1,214개 규칙 전체**로 존재 |
| **증거** | `MEASURED` — `<style>` 내 `@font-face` = 1,214개 / flight 내 `@font-face` 문자열 = **1,214개** (정확히 일치). flight 총 799,659 B |
| **실제 영향** | 문서 1.59 MB 중 **1.40 MB(88.0%)**. 폰트 CSS를 줄이면 **2배로 절감**된다 |
| **Root Cause** | `next.config.ts:29` `inlineCss:true` + 683 KB CSS. 인라인 CSS는 클라이언트 라우팅에도 필요하므로 flight에 재직렬화됨 |
| **심각도 / 난이도** | CRITICAL / **LOW** (미사용 폰트 제거만으로 자동 해소) |

> GPT 가설 A는 "HTML이 크다"까지만 짚었고 원인을 게시물 데이터로 추정했다. 실제 원인은 폰트 CSS의 **구조적 2중화**다.

### 🆕 F-2 🟠 HIGH — 외부 stylesheet가 0개 → 페이지 간 CSS 캐시 재사용 불가

| 항목 | 값 |
|---|---|
| **발견** | 서빙 HTML에 `<link rel="stylesheet">` **0개**. 모든 CSS가 인라인 |
| **증거** | `MEASURED` — 정규식 추출 결과 0건. 6개 라우트 전부 1.57~1.96 MB |
| **실제 영향** | 외부 CSS라면 `immutable`로 1회 캐시 후 재사용되나, 인라인이라 **페이지 이동·재방문마다 1.5 MB 재전송·재파싱**. 재방문 사용자 체감이 특히 나쁨 |
| **Root Cause** | `inlineCss:true` (`next.config.ts:29`, 커밋 `e42c30b` 2026-02-12 — **한글 폰트 도입 이전에 설정됨**) |
| **심각도 / 난이도** | HIGH / LOW |

> `inlineCss`는 2월(CSS가 작았을 때) 켠 것이고, 3월에 683 KB 폰트 CSS가 들어오면서 전제가 무너졌다. **설정 자체가 아니라 설정과 데이터 크기의 조합**이 문제다.

### 🆕 F-3 🟡 MEDIUM — 히어로 이미지 preload 태그 2개 중복 + 무효 속성

| 항목 | 값 |
|---|---|
| **발견** | 서빙 HTML에 `/main_image.webp` preload가 **2개** |
| **증거** | `MEASURED` — `app/page.tsx:67` 수동 `<link>` + `app/page.tsx:124` `priority` 자동 생성 |
| **추가 결함** | 두 태그 모두 `imageSizes`만 있고 **`imageSrcSet`이 없다**. HTML 명세상 `imagesizes`는 `imagesrcset`과 함께여야 유효 → **이 속성은 무시된다** |
| **실제 영향** | 중복 preload 자체는 브라우저가 병합하나, Lighthouse `unused preload` 경고 유발 및 유지보수 혼란 |
| **심각도 / 난이도** | MEDIUM / LOW |

### 🆕 F-4 🟡 MEDIUM — 미사용 폰트 2종을 preload (60,816 B 순수 낭비)

| 항목 | 값 |
|---|---|
| **발견** | `preload: true`인 Noto Serif KR·Noto Sans KR의 latin 서브셋이 HTTP `Link:` 헤더로 preload되나, **홈에서 두 폰트를 쓰는 요소가 하나도 없다** |
| **증거** | `MEASURED` 34,732 + 26,084 = **60,816 B** / `CODE-CONFIRMED` `--font-noto-serif`·`--font-noto-sans` 소비처 0건 |
| **가중 요인** | `app/page.tsx:91` `font-serif`는 `tailwind.config.js`에 `serif` 확장이 없어 **Georgia 계열로 폴백**된다 |
| **실제 영향** | LCP 경쟁 대역폭 60 KB 낭비 + Lighthouse `unused preload` |
| **Root Cause** | `app/layout.tsx:22, 30` `preload: true` |
| **심각도 / 난이도** | MEDIUM / LOW |

> **중요한 오해 정정**: `MEMORY.md`와 `app/layout.tsx:38-41` 주석은 *"`preload:false`가 대역폭 경쟁을 제거한다"*고 기록하고 있다. 이는 **절반만 맞다.** `preload:false`는 `<link rel=preload>`만 막을 뿐, **`@font-face` CSS 683 KB는 그대로 HTML에 인라인된다.** Gowun Dodum(47 KB)·Nanum Gothic(92 KB)은 `preload:false`인데도 CSS 139 KB를 전 페이지에 싣고 있다. 폰트를 안 쓰면 `preload:false`가 아니라 **선언 자체를 지워야** 한다.

### 🆕 F-5 🟡 MEDIUM — middleware가 모든 홈 요청에서 Supabase 인증 클라이언트 생성

| 항목 | 값 |
|---|---|
| **발견** | `middleware.ts:111` matcher가 `/`를 포함 → 홈 요청마다 `createServerClient` 생성 + `await supabase.auth.getUser()`(`:38-40`) |
| **증거** | `CODE-CONFIRMED` matcher 정규식은 `_next/static`·`_next/image`·favicon·이미지 확장자만 제외 |
| **실제 영향** | `/`는 `publicRoutes`(`:43`)에 있어 **인증 결과가 어차피 쓰이지 않는다.** 익명 사용자는 세션 쿠키가 없어 `getUser()`가 조기 반환하므로 비용은 제한적이나, middleware 호출 + 클라이언트 생성 오버헤드는 매 요청 발생 |
| **미확인** | 익명 요청 시 실제 네트워크 왕복 발생 여부는 `NOT VERIFIED` (서버 내부 동작) |
| **심각도 / 난이도** | MEDIUM / MEDIUM (인증 로직이라 회귀 위험 있음) |

### 🆕 F-6 🟢 LOW — 모바일에서 표시되지 않는 `<aside>`를 위해 Supabase 조회 수행

| 항목 | 값 |
|---|---|
| **발견** | `gallery` 4건 쿼리(`app/page.tsx:49-52`) 결과는 `app/page.tsx:186`의 `hidden lg:flex` aside에서만 사용 |
| **증거** | `CODE-CONFIRMED` — `photos`의 유일한 참조는 `:196-215` (aside 내부) |
| **실제 영향** | 모바일 PageSpeed 측정 시 **DOM은 생성되나 화면에 없음**. 페이로드 ≈1.5 KB, TTFB에 Supabase 왕복 1회 기여 |
| **심각도 / 난이도** | LOW / LOW |

### 🆕 F-7 🟢 LOW — `public/` 대용량 원본 이미지 (런타임 무해, 저장소/빌드 부담)

| 파일 | 크기 | 런타임 서빙 |
|---|---:|---|
| `gimpogugak_map.png` | 649,895 B | `/_next/image` 경유 → **21,967 B AVIF** ✅ |
| `Song-Ri-Gyeol-profile.jpg` | 499,643 B | 프로필 페이지 |
| `image_b4e966.jpg` | 274,343 B | 블로그 상세 |
| `main_image.webp` | 175,424 B | ⚠️ **원본 그대로 서빙** (RC-4) |

**명확히 밝힌다: `gimpogugak_map.png` 650 KB는 런타임 성능 문제가 아니다.** `/_next/image`를 거쳐 22 KB AVIF로 서빙됨을 실측 확인했다. "public에 큰 파일이 있으니 문제"라는 추정은 이 경우 **틀렸다**. `main_image.webp`만 예외다.

---

## 11. Severity Ranking

| 등급 | 항목 | 정량 근거 |
|---|---|---|
| 🔴 **CRITICAL** | **RC-1** Pretendard 2.0 MB 통짜 폰트 preload | 초기 전송량의 **77.9%** |
| 🔴 **CRITICAL** | **RC-2 + F-1** 미사용 폰트 5종 → 683 KB CSS의 2중 인라인 | HTML의 **88.0%** = 1.40 MB |
| 🟠 **HIGH** | **RC-3** 홈 Dynamic 렌더링 / 캐시 MISS 100% | TTFB 0.42~2.59 s |
| 🟠 **HIGH** | **RC-4** LCP 히어로 `unoptimized` | **+146,938 B (6.2배)** |
| 🟠 **HIGH** | **F-2** 외부 stylesheet 0개 → 페이지 간 캐시 불가 | 이동마다 1.5 MB 재전송 |
| 🟡 **MEDIUM** | **F-4** 미사용 폰트 2종 preload | 60,816 B 낭비 |
| 🟡 **MEDIUM** | **F-3** 히어로 preload 중복 + 무효 `imageSizes` | Lighthouse 경고 |
| 🟡 **MEDIUM** | **F-5** middleware가 공개 홈에서 인증 조회 | TTFB 기여 |
| 🟢 **LOW** | **F-6** 모바일 미표시 aside용 gallery 쿼리 | ≈1.5 KB + 왕복 1회 |
| 🟢 **LOW** | **F-7** `public/` 원본 대용량 (런타임 무해) | 저장소/빌드만 |

---

## 12. Remediation Priority

> **본 감사에서는 어떤 수정도 수행하지 않았다.** 아래는 권장 순서일 뿐이다.
> 우선순위 = 성능 영향 × (1/수정 비용) × (1/회귀 위험) × 사용자 체감

### 1순위 🥇 — Pretendard를 서브셋 또는 Dynamic Subset으로 되돌리기 (RC-1)

- **대상**: `app/layout.tsx:10-15`, `public/fonts/PretendardVariable.woff2`
- **선택지 A (권장)**: 커밋 `4621b6b` 이전의 **Dynamic Subset CDN** 방식 복원 — 이미 검증된 구성이고 `git show 4621b6b`에 원본 코드가 그대로 남아 있다
- **선택지 B**: 한글 상용 2,350자 + Latin으로 서브셋한 woff2 자체 호스팅 (2.0 MB → 약 200~400 KB 예상, `INFERRED`)
- **선택지 C**: `next/font/local`에 `unicode-range`로 쪼갠 다중 `src` 지정
- **예상 효과 (`MEASURED` 기반)**: 초기 전송량 **2.64 MB → 0.6~0.9 MB (−65~78%)**
- **수정 난이도**: LOW · **회귀 위험**: LOW (선택지 A는 과거 동작 코드 복원)

### 2순위 🥈 — 미사용 폰트 4종 선언 제거 (RC-2 / F-1 / F-2 / F-4)

- **대상**: `app/layout.tsx:17-60` 중 **Noto Serif KR, Noto Sans KR, Gowun Dodum, Nanum Gothic**
- **주의**: `Nanum Myeongjo`는 `globals.css:56,64,72`에서 `.blog-content h1~h3`에 실제 사용 중 → **블로그 전용으로 분리**하거나 유지 판단 필요. Noto Sans KR도 `globals.css:31,41`에서 **문자열 fallback**으로만 등장하므로 제거해도 시스템 폰트로 안전 폴백
- **예상 효과 (`MEASURED` 산술)**: `@font-face` CSS **699,922 B → 약 93,000 B**. 2중 인라인이므로 문서에서 **약 1.21 MB 감소** → HTML **1.59 MB → 약 0.38 MB (−76%)**
- **수정 난이도**: LOW · **회귀 위험**: LOW~MEDIUM (블로그 본문 서체 확인 필요)

> 1·2순위를 함께 적용하면 **전송량 2.64 MB → 약 0.5 MB, HTML 1.59 MB → 약 0.38 MB**로 예상된다. 이 둘이 전체 개선의 대부분을 차지한다.

### 3순위 🥉 — 홈을 정적 렌더링으로 전환 (RC-3)

- **대상**: `app/page.tsx:44`
- **방법 A (최소 변경)**: `app/blog/page.tsx:7`과 동일하게 `export const dynamic = "force-static"` 추가
- **방법 B (구조적으로 더 정확)**: `app/activities/page.tsx:8-12`처럼 쿠키 없는 클라이언트 사용, 또는 기존 `lib/supabase/build.ts`의 `createClientForBuild()` 활용
- **예상 효과**: `X-Vercel-Cache: MISS → HIT`, TTFB **0.42~2.59 s → 0.21~0.25 s** (다른 정적 라우트 실측값 수준)
- **수정 난이도**: LOW · **회귀 위험**: **MEDIUM** — ⚠️ 아래 §13 필독

### 4순위 — 히어로 이미지 `unoptimized` 제거 (RC-4)

- **대상**: `app/page.tsx:128`
- **예상 효과**: LCP 리소스 **175,424 B → 28,486 B (−83.8%)** + srcset 활성화로 `sizes`가 비로소 동작
- **수정 난이도**: LOW · **회귀 위험**: LOW
- **주의**: 최초 1회 `/_next/image` 변환 지연이 있으나 이후 `immutable` 캐시. 배포 직후 워밍 권장

### 5순위 — preload 정리 (F-3 / F-4)

- `app/page.tsx:67` 수동 preload 제거 (`priority`가 이미 생성) 또는 `imageSrcSet` 동반
- 2순위에서 Noto 2종을 제거하면 F-4는 자동 해소
- **수정 난이도**: LOW · **회귀 위험**: LOW

### 손대지 않아도 되는 것 (Q9)

| 항목 | 판정 |
|---|---|
| Supabase 쿼리 컬럼 선택 | ✅ 이미 최적. `select('*')` 공개 페이지 0건 |
| Client/Server 경계 | ✅ 이미 최적. Client 소스 8.4 KB |
| JS 번들 | ✅ 246 KB 전송 — 정상 범위 |
| 히어로 외 이미지 8개 | ✅ `/_next/image` + srcset + lazy 정상 |
| Third-party 스크립트 | ✅ `lazyOnload` / `ssr:false` 정상 |
| 정적 asset 캐시 헤더 | ✅ `immutable` 정상 |
| `gimpogugak_map.png` 650 KB | ✅ 런타임 22 KB — **건드릴 필요 없음** |
| JSON-LD ×2 | ✅ 약 1.4 KB — 무시 가능 |
| CLS 대책 | ✅ width/height·blur·min-h 적용됨 |

---

## 13. Regression Risks

### ⚠️ 3순위(홈 정적화)의 회귀 위험 — 가장 주의 요망

| 위험 | 설명 | 완화 |
|---|---|---|
| **예약 발행 글 노출 지연** | `app/page.tsx:58` `.lte("published_at", new Date().toISOString())` — 정적화 시 `new Date()`가 **빌드/재검증 시점에 고정**된다. 커밋 `3ee6d03`·`0c172be`가 이미 이 문제로 두 차례 수정된 이력이 있다 | `revalidate = 60` 유지 필수. 기존 `/api/cron/blog-publish` 재검증 크론과의 연동 확인 |
| **크론 주기 제약** | 커밋 `3a2b0a9` — Vercel Hobby 플랜은 크론 **하루 1회** 제한 | 시간 기반 `revalidate`에 의존해야 함 |
| **로그인 사용자 UI** | 홈이 사용자별 UI를 렌더한다면 정적화 시 전원 동일 화면 | `app/page.tsx` 전수 확인 결과 **사용자 분기 없음** → 위험 낮음 (`CODE-CONFIRMED`) |

### 기타 회귀 위험

| 수정 | 위험 | 완화 |
|---|---|---|
| 폰트 4종 제거 | 블로그 본문 h1~h3 서체 변경 (`globals.css:56,64,72`) | `Nanum Myeongjo`는 유지하거나 블로그 라우트로 국소화 |
| 폰트 4종 제거 | TinyMCE 에디터 폰트 선택 UI가 해당 폰트를 참조 (`components/PostEditor.tsx`, `PostModal.tsx` — 커밋 `34c34b1`) | 에디터 폰트는 `content_css`로 주입되므로 **layout.tsx 선언과 분리 가능**. 제거 전 확인 필수 |
| Pretendard 서브셋화 | 한자·희귀 한글 글자 깨짐 | 상용 2,350자 + 한자 일부 포함 서브셋 사용, 블로그 본문 샘플로 검증 |
| Pretendard CDN 복원 | 외부 CDN 의존 재도입 (jsDelivr 장애 시 폴백) | `font-display:swap` + 시스템 폰트 폴백으로 완화됨 |
| `unoptimized` 제거 | `/_next/image` 최초 변환 지연 | 배포 후 워밍. Vercel 이미지 최적화 사용량 확인 |
| `inlineCss:false` 검토 | 2순위 적용 후에는 CSS가 93 KB 수준이므로 **inlineCss 유지가 오히려 유리할 수 있음** | 2순위 완료 후 A/B 측정 권장 |

---

## 14. Verification Gaps

| 미확인 항목 | 사유 | 영향 |
|---|---|---|
| **Lighthouse 실측 점수** | PSI API 익명 일일 쿼터 소진 (`HTTP 429`, `Quota exceeded ... Queries per day`) | 점수 수치는 미제시. 다만 리소스 실측만으로 병목은 확정됨 |
| **브라우저 네트워크 워터폴 / 리소스 우선순위** | Chrome 확장 미연결 (`Browser extension is not connected`) | preload 경쟁의 정확한 타이밍 미확인. 크기 기반 추론으로 대체 |
| **LCP 요소 확정** | 위와 동일 | 히어로 이미지가 LCP일 가능성이 높다고 **추론**(`INFERRED`). 360×640 뷰포트 기준 이미지가 약 y=384~540에 위치, 면적 약 48,672 px² > h1 약 24,960 px². 텍스트가 LCP일 가능성도 배제 못함 |
| **CrUX Field Data** | PSI 쿼터 | 실사용자 데이터 미확인 |
| **middleware 익명 요청의 실제 네트워크 왕복** | 서버 내부 동작 | F-5의 비용 규모 `NOT VERIFIED` |
| **폰트 서브셋 후 정확한 크기** | 서브셋 도구 미실행(READ-ONLY) | 200~400 KB는 `INFERRED` |
| **빌드 출력의 First Load JS 수치** | Next.js 16 + Turbopack이 라우트 표에 크기 컬럼 미출력 | 네트워크 실측(§5.3)으로 대체 — 오히려 더 정확 |

### 재현 방법 (참고)

```bash
# HTML Resource vs Transfer Size
curl -s -H "Accept-Encoding: identity" https://gimpogugak.com/ -o /dev/null -w "%{size_download}\n"
curl -s -H "Accept-Encoding: br"       https://gimpogugak.com/ -o /dev/null -w "%{size_download}\n"

# 캐시 상태
curl -sI https://gimpogugak.com/ | grep -iE "cache-control|x-vercel-cache|age"

# 폰트 실측
curl -s https://gimpogugak.com/_next/static/media/PretendardVariable-s.p.77d5d991.woff2 -o /dev/null -w "%{size_download}\n"

# LCP 이미지 최적화 전후
curl -s https://gimpogugak.com/main_image.webp -o /dev/null -w "%{size_download}\n"
curl -s -H "Accept: image/avif,image/webp,*/*" "https://gimpogugak.com/_next/image?url=%2Fmain_image.webp&w=828&q=75" -o /dev/null -w "%{size_download}\n"

# 렌더링 모드
npm run build   # 라우트 표에서 "ƒ /" 확인
```

---

## 15. 대표 질문 직답 (Q1~Q10)

**Q1. 네트워크 페이로드가 실제로 큰가?**
→ **예. 명백히 크다.** 모바일 콜드 로드 초기 전송량 **2.64 MB**, 압축 해제 기준 **4.69 MB**. 실제 보이는 텍스트는 **2,860 B**다.

**Q2. 크다면 무엇이 몇 %인가?**
→ 전송량 기준: **폰트 80.2%** / JS 9.3% / 이미지 6.6% / HTML 3.8%. **Pretendard 단일 파일이 77.9%.**

**Q3. 가장 큰 원인은?**
→ **폰트다.** 이미지·JS·HTML/RSC·쿼리 전부 아니다. 두 갈래: ① 폰트 **파일** 2.06 MB ② 폰트 **CSS** 1.40 MB(2중 인라인).

**Q4. PageSpeed 하락과 직접 연결되는 병목은?**
→ 2026-03-30 커밋 3개(`0bf8b63`, `64ec14e`, `4621b6b`). 특히 `4621b6b`의 **Dynamic Subset CDN → 2 MB 통짜 폰트** 교체가 결정타. 셋 다 "최적화" 의도였으나 전부 역효과였다.

**Q5. GPT 가설 중 맞은 것과 틀린 것은?**
→ **맞음 6건**(A·I·K·L·N·O) / **부분 2건**(H·J) / **틀림 7건**(B·C·D·E·F·G·M).
GPT가 가장 강하게 의심한 **데이터 계층 5개(B·C·D·E·G)는 전부 틀렸다.** 이 코드베이스의 쿼리·컴포넌트 경계·직렬화는 오히려 잘 설계되어 있다. 가설 A는 "HTML이 크다"는 증상은 맞혔으나 원인 추정(게시물 본문)은 틀렸다.

**Q6. Claude가 새로 발견한 것은?**
→ **7건.** F-1 RSC flight CSS 중복(CRITICAL), F-2 외부 stylesheet 0개(HIGH), F-3 히어로 preload 중복+무효 속성, F-4 미사용 폰트 preload 60 KB, F-5 middleware 인증 조회, F-6 모바일 미표시 aside 쿼리, F-7 public 원본 대용량(런타임 무해).
가장 중요한 것은 **F-1** — 폰트 CSS를 줄이면 절감 효과가 **2배**로 돌아온다는 사실이다.

**Q7. 1~5순위는?**
→ ① Pretendard 서브셋/CDN 복원 ② 미사용 폰트 4종 제거 ③ 홈 정적화 ④ 히어로 `unoptimized` 제거 ⑤ preload 정리.
**①+②만으로 전송량 2.64 MB → 약 0.5 MB, HTML 1.59 MB → 약 0.38 MB 예상.**

**Q8. 각 수정의 회귀 위험은?**
→ 가장 위험한 건 **③ 홈 정적화**다. `app/page.tsx:58`의 `new Date()`가 예약 발행 로직과 얽혀 있고, 이미 `3ee6d03`·`0c172be`에서 두 번 터진 이력이 있다. ①②④⑤는 위험 낮음. 단 ②는 블로그 본문 서체(`globals.css:56,64,72`)와 TinyMCE 폰트 UI 확인이 선행되어야 한다. 상세는 §13.

**Q9. 반드시 고쳐야 할 것 vs 안 건드려도 되는 것?**
→ **고칠 것**: 폰트(파일+CSS), 홈 렌더링 모드, 히어로 이미지.
**안 건드릴 것**: Supabase 쿼리, Client/Server 경계, JS 번들, 나머지 이미지 8개, third-party, 캐시 헤더, `gimpogugak_map.png`. 이들은 이미 잘 되어 있고 손대면 오히려 손해다.

**Q10. 실제 사용자 체감 개선의 핵심은?**
→ **폰트 2.06 MB를 없애는 것.** 한국 모바일 LTE 기준 이 한 파일만 수 초를 잡아먹으며, LCP 이미지와 대역폭을 직접 다툰다.
그다음이 **HTML 1.5 MB → 0.38 MB**다. 이건 점수보다 **재방문·페이지 이동 체감**에 크게 작용한다 — 현재는 인라인 CSS라 이동할 때마다 1.5 MB를 다시 받는다(F-2).
반대로 Supabase 쿼리나 JS 번들을 아무리 손봐도 체감은 거의 바뀌지 않는다.

---

## 최종 판정

# 🔴 CRITICAL PERFORMANCE REMEDIATION REQUIRED

**근거**: 초기 전송량의 **80.2%가 폰트**, HTML 문서의 **88.0%가 중복 인라인된 `@font-face` CSS**, 실제 보이는 텍스트는 문서의 **0.18%**. 홈은 공개 페이지 중 **유일하게 CDN 캐시를 받지 못하며**, LCP 리소스는 필요 대비 **6.2배** 크다.

**동시에 기록해 둘 것**: 이 코드베이스의 **데이터 계층(쿼리·컴포넌트 경계·직렬화·번들 분할)은 잘 설계되어 있다.** 문제는 좁고 명확하며, 대부분 `app/layout.tsx` 한 파일의 폰트 선언 6개에 집중되어 있다. **수정 범위가 작고 회귀 위험이 낮은 것이 이 감사의 좋은 소식이다.**

---

## 무결성 확인

- 감사 시작 시 `git status --porcelain` → **clean** (기존 변경사항 없음)
- 감사 중 수정한 tracked 파일: **0개**
- 생성한 파일: `reports/performance/KIMPO_GUGAK_PERFORMANCE_READONLY_AUDIT.md` (본 보고서) **1개만**
- 생성한 untracked artifact: `.next/` (로컬 빌드 산출물, `.gitignore` 61행 `/.next/`로 무시됨)
- Production DB / Supabase / Vercel 설정 / 배포 / commit / push: **일체 없음**
