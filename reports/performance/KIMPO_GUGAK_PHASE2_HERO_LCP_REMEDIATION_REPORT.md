# 김포국악원 Phase 2 — Hero / LCP 이미지 전달 성능 회귀 수정 보고서

- **대상**: `https://gimpogugak.com` (Production)
- **저장소**: `C:\Users\JUN\gimpo-gugak` — branch `main`
- **작업 시작 HEAD**: `d7cb350`
- **작업 결과 HEAD**: `464ee1e` (`perf: 히어로/LCP 이미지 전달 회귀 제거 (v5.25.0)`)
- **작업 일시**: 2026-08-15
- **선행 문서**: `KIMPO_GUGAK_PERFORMANCE_READONLY_AUDIT.md`, `KIMPO_GUGAK_PHASE1_FONT_REMEDIATION_REPORT.md`
- **최종 판정**: ✅ **CONDITIONAL PASS** (§20)

증거 등급: `MEASURED`(실측) / `CODE-CONFIRMED`(코드 확인) / `INFERRED`(추론) / `NOT VERIFIED`(미확인)

---

## 1. Executive Summary

Phase 2의 목표는 하나였다 — **Hero/LCP 이미지 전달 회귀를 최소 변경으로 제거하고 Production에서 실제 감소를 증명한다.**

수정은 **`app/page.tsx` 2곳**으로 끝났다. 폰트(Phase 1)와 홈 Dynamic 렌더링(Phase 3)은 손대지 않았다.

### 핵심 결과 (`MEASURED`, Production 실측)

| 지표 | Phase 1 기준 | Phase 2 후 | 변화 |
|---|---:|---:|---:|
| Hero Transfer (모바일 390 DPR2) | 175,424 B | **28,486 B** | **−146,938 B (−83.8%)** |
| Hero Content-Type | `image/webp` | **`image/avif`** | 포맷 협상 회복 |
| Hero preload 태그 | **2개** (1개는 무효 속성) | **1개** | −1, 속성 유효화 |
| Hero srcset 후보 | **0개** (srcset 자체 없음) | **5개** (640/750/828/1080/1200) | responsive 회복 |
| Hero 실제 다운로드 | 1회 | **1회 (유지)** | 이중 다운로드 없음 |
| 홈 초기 Transfer | 847,616 B | **700,643 B** | **−146,973 B (−17.3%)** |
| Font Transfer | 430,632 B | **430,632 B** | **0 (Phase 1 불변)** |
| CSS Transfer | 24,538 B | **24,538 B** | **0 (Phase 1 불변)** |
| HTML Transfer (br) | 11,998 B | **11,960 B** | −38 B |
| HTML 내 `@font-face` | 0개 | **0개** | Phase 1 불변 |

> 감사보고서가 지목한 **RC-4(Hero unoptimized)** 와 **F-3(Hero preload 중복)** 을 제거했다.
> **RC-3(홈 Dynamic)**, **F-5(middleware)**, **F-6(gallery 쿼리)** 는 범위 밖이라 **의도적으로 그대로 두었다.**

### 한 줄 요약

`unoptimized` 하나가 **AVIF 변환·srcset·deviceSizes를 동시에 무력화**하고 있었다. 제거하자 175 KB WebP가 28 KB AVIF로 바뀌었고, 함께 있던 **무효 수동 preload**를 제거해 preload가 실제 렌더 후보와 정확히 일치하게 됐다.

---

## 2. Git / Repository Baseline (`MEASURED`)

작업 시작 시점에 직접 확인한 값이다.

```
$ git status --porcelain      →  (출력 없음 — 완전 clean)
$ git branch --show-current   →  main
$ git rev-parse HEAD          →  d7cb350ad518c8f069d1f7fa8802ccb553239dcf
```

```
d7cb350 docs: Phase 1 폰트 성능 회귀 수정 보고서 추가
49141b0 perf: 폰트 전달/인라인 CSS 성능 회귀 제거 (v5.24.0)
b770fea New googleads
76a1424 googleads
0c172be fix: 예약 발행 글이 발행 시각 이후에도 404로 남는 문제 수정 (v5.23.0)
```

### 요구사항 §3의 `49141b0` vs `d7cb350` 불일치 해소

요구사항은 Phase 1 보고서가 결과 HEAD를 `49141b0`으로 적었는데 채팅 요약에는 `d7cb350`이 나타난다는 점을 확인하라고 했다. **모순이 아니다.**

| 질문 | 답 | 근거 |
|---|---|---|
| 현재 HEAD | `d7cb350` | `git rev-parse HEAD` |
| `49141b0` 이후 별도 커밋 존재? | **있다 — `d7cb350` 1개** | `git log` |
| `d7cb350`은 무엇인가 | **문서 전용 커밋.** `reports/performance/` 2개 파일 **추가만** (`1,460 insertions, 0 deletions`) | `git show --stat d7cb350` |
| `reports/`는 tracked인가 | **tracked** (`d7cb350`에서 커밋됨). Phase 1 종료 시점엔 untracked였다 | `git ls-files reports/` |
| 코드 변경 있었나 | **없다** | `d7cb350`은 `.md` 2개만 건드린다 |

> **결론**: Phase 1 보고서의 "작업 결과 HEAD `49141b0`"은 **코드 기준으로 정확**하다. `d7cb350`은 그 뒤에 보고서 자체를 커밋한 문서 커밋이다.
> 요구사항 §3대로 **reset·revert 없이** 현재 정상 코드(`d7cb350`)를 기준으로 작업했다.

---

## 3. Phase 1 기준선 (요구사항 §2)

Phase 1 보고서 §12.3의 홈 초기 로드 구성이다.

```
홈 초기 Transfer       847,616 B
Font                   430,632 B   (16/92 조각)
JS                     205,024 B   (12 requests)
Hero Image             175,424 B
CSS                     24,538 B   (2 files)
HTML                    11,998 B   (brotli)
총 Request                    32
```

Phase 2는 이 구조 중 **Hero Image 한 줄만** 바꾸는 것이 목표였다.

---

## 4. 수정 전 Production 기준선 재측정 (요구사항 §17, `MEASURED`)

감사·Phase 1 수치를 그대로 믿지 않고 **배포 직전에 다시 측정**했다.

| 항목 | 실측값 | Phase 1 보고서 | 일치? |
|---|---:|---:|---|
| 홈 문서 (identity) | 52,005 B | 52,005 B | ✅ |
| 홈 문서 (brotli) | 11,998 B | 11,998 B | ✅ |
| Hero Transfer | **175,424 B** | 175,424 B | ✅ |
| Hero Content-Type | **`image/webp`** | — | — |
| Hero URL | **`/main_image.webp`** (원본) | — | — |
| CSS | 24,538 B (2 files) | 24,538 B | ✅ |
| Font | 430,632 B (16/92) | 430,632 B | ✅ |
| HTML 내 `@font-face` | 0개 | 0개 | ✅ |
| `Link:` 헤더 폰트 preload | 0건 | 0건 | ✅ |

**전 항목이 Phase 1 보고서와 일치했다.** 기준선을 새로 잡을 필요가 없어 §2의 값을 그대로 사용했다.

### Hero 원본 에셋 (`MEASURED`)

```
public/main_image.webp
  파일 크기      175,424 B
  포맷           WebP (VP8 lossy, RIFF/WEBP 시그니처 확인)
  고유 dimensions 1200 x 675   (aspect 1.7778)
  수정일         2026-03-13
```

---

## 5. `64ec14e` 회귀 분석 (요구사항 §8)

```
commit 64ec14ea5b11c128c78a5fcd348392487ad7f42c
Date:   2026-03-30 16:29:06 +0900
        메인 이미지 unoptimized 강제 적용 (LCP 병목 해결)

 app/page.tsx | 1 +
```

### 5.1 변경 전 / 변경 후 (`CODE-CONFIRMED`)

```diff
@@ -124,6 +124,7 @@ export default async function HomePage() {
                 alt="김포문화원 앞마당에서 열린 국악 공연, 김포국악원"
                 priority
                 fetchPriority="high"
+                unoptimized
                 width={1200}
                 height={600}
                 className="w-full object-cover"
```

**커밋 전체가 이 1줄이다.** 다른 변경은 없다.

### 5.2 왜 추가됐는가 — 의도 추정

커밋 메시지는 "LCP 병목 해결"이다. 같은 날(2026-03-30) `0bf8b63`·`4621b6b`와 함께 **모바일 PageSpeed 개선 시도**가 연속으로 있었다(Phase 1 보고서 §4.1).

가장 합리적인 해석은 다음과 같다 (`INFERRED`):

- `/_next/image`는 **on-demand 변환**이다. 특정 `(url, w, q)` 조합의 **첫 요청**은 서버에서 디코드→리사이즈→AVIF 인코딩을 수행하므로 느리다.
- 당시 작업자가 **콜드 상태의 `/_next/image`** 를 관측하고 "옵티마이저가 LCP를 늦춘다"고 판단해, 변환을 우회하는 `unoptimized`를 붙였을 가능성이 높다.
- 즉 **일시적인 콜드 변환 지연을 항구적 구조 문제로 오진**한 것이다.

### 5.3 그 판단이 지금도 유효한가 — **아니다** (`MEASURED`)

콜드 변환 비용은 **`(url, w, q)` 조합당 1회**이고 이후 Vercel 이미지 캐시가 `HIT`을 반환한다. 실측 결과 **워밍된 옵티마이저가 원본보다 오히려 빨랐다.**

| 리소스 | 전송량 | 응답시간 (3회) | 캐시 |
|---|---:|---:|---|
| `/_next/image?...&w=828&q=75` (AVIF) | **28,486 B** | **170 / 41 / 45 ms** | HIT |
| `/main_image.webp` (원본 WebP) | 175,424 B | 85 / 346 / 384 ms | HIT |

> 옵티마이저 쪽이 **6.2배 작고 응답도 더 빨랐다.** `unoptimized`의 근거였던 "옵티마이저가 병목"이라는 전제가 현재 Production에서 성립하지 않는다.

측정 시점 이미 5개 후보 전부 `X-Vercel-Cache: HIT`였다(선행 감사·본 작업의 탐침으로 워밍됨). 실사용자 트래픽에서도 첫 방문자 1명만 콜드 비용을 부담하고 이후 전원이 캐시를 받는다.

### 5.4 `unoptimized`가 실제로 한 일 (`MEASURED` + `CODE-CONFIRMED`)

의도는 "LCP 병목 해결"이었으나 실제 효과는 **정반대**였다. `unoptimized`는 단순히 변환만 끄는 게 아니라 **Next/Image의 전달 최적화 전체를 무력화**한다.

| 기능 | `unoptimized` 있을 때 | 실제 영향 |
|---|---|---|
| AVIF/WebP 포맷 협상 | **무력화** | `next.config.ts`의 `formats: ['image/avif','image/webp']`가 사문화 |
| `srcset` 생성 | **무력화** | `<img>`에 `srcset` 자체가 없음 → 모든 기기가 동일 파일 |
| `deviceSizes` | **무력화** | `[640,750,828,1080,1200]` 설정이 사문화 |
| `sizes` prop | **무력화** | `sizes` 문자열은 `srcset`이 있어야 의미가 있다 |
| 결과 | 176px 폰이든 4K든 **항상 175,424 B** | 모바일 과전송 |

**전체 revert는 하지 않았다.** 이 커밋은 1줄짜리이므로 "그 1줄 제거"가 곧 최소 변경이며, 동시에 §14(중복 preload)를 함께 처리해야 안전하다(§8.2).

---

## 6. 현재 Hero 구조 완전 추적 (요구사항 §9, `CODE-CONFIRMED` + `MEASURED`)

### 6.1 수정 전 체인

```
app/page.tsx:15   const HERO_IMAGE = "/main_image.webp"
app/page.tsx:67   <link rel="preload" as="image" href={HERO_IMAGE}
                        fetchPriority="high" imageSizes="…" />     ← 수동 preload
app/page.tsx:122  <Image src={HERO_IMAGE} priority fetchPriority="high"
                        unoptimized width={1200} height={600}
                        sizes="…" placeholder="blur" blurDataURL="…" />
      ↓ 생성 HTML
<link rel="preload" href="/main_image.webp" as="image" fetchPriority="high" imageSizes="…"/>   ← 수동
<link rel="preload" as="image" href="/main_image.webp" fetchPriority="high" imageSizes="…"/>   ← Image 자동
<img … src="/main_image.webp"/>                                    ← srcset 없음
      ↓ 실제 응답
/main_image.webp   175,424 B   image/webp
```

### 6.2 요구사항 §9 지정 항목

| 항목 | 수정 전 | 수정 후 |
|---|---|---|
| Source file / line | `app/page.tsx:67`(preload), `:122-134`(Image) | `app/page.tsx:121-133` (preload 제거) |
| 원본 파일 | `/main_image.webp` | 동일 |
| 원본 dimensions | 1200 × 675 | 동일 |
| 화면 dimensions (선언) | `width=1200 height=600` | **동일 (변경 없음)** |
| `width` / `height` | 1200 / 600 | **동일** |
| `fill` | 미사용 | **동일** |
| `sizes` | `(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 800px` | **동일 (문자열 그대로)** |
| `quality` | 미지정 → 기본 75 | **동일 (q=75)** |
| `priority` | 있음 | **동일** |
| `fetchPriority` | `"high"` | **동일** |
| `unoptimized` | **있음** | **제거** ← 변경 |
| 수동 preload | **있음** | **제거** ← 변경 |
| `placeholder` | `"blur"` | **동일** |
| `blurDataURL` | SVG data URI | **동일 (문자 단위 동일)** |
| `object-fit` / position | `className="w-full object-cover"` | **동일** |

**변경된 것은 정확히 2개뿐이며 나머지는 전부 그대로다.**

---

## 7. 사전 가설 검증 (요구사항 §4·§5)

세 가설을 **현재 Production HTML과 현재 소스**에서 다시 검증한 뒤 수정했다.

### H-1 — Hero가 `unoptimized`로 원본 WebP를 그대로 전달한다

**판정: ✅ `CONFIRMED`** (`MEASURED` + `CODE-CONFIRMED`)

- 소스: `app/page.tsx:127` `unoptimized` 존재
- Production HTML: `<img … src="/main_image.webp"/>` — `srcset` 속성 **부재**
- 응답: `175,424 B`, `Content-Type: image/webp`
- 감사보고서의 후보값 `28,486 B`도 **직접 재측정하여 정확히 일치**(§11)

### H-2 — Hero preload가 중복되어 있다

**판정: ✅ `CONFIRMED`** (`MEASURED`)

Production HTML에서 `as="image"` preload가 **정확히 2개** 나왔다.

```html
<link rel="preload" href="/main_image.webp" as="image" fetchPriority="high" imageSizes="…"/>
<link rel="preload" as="image" href="/main_image.webp" fetchPriority="high" imageSizes="…"/>
```

- 1번째 = `app/page.tsx:67`의 수동 JSX `<link>`
- 2번째 = `<Image priority>`가 자동 생성한 preload
- 속성 **순서**가 달라 React가 동일 리소스로 dedupe하지 않고 둘 다 직렬화했다.
- 다만 `href`가 같으므로 **브라우저 단계에서는 1회 다운로드**였다(§13에서 전후 모두 확인).

### H-3 — 수동 preload의 `imageSizes`가 `imagesrcset` 없이 무효다

**판정: ✅ `CONFIRMED`** (`MEASURED`)

두 preload 모두 `imageSizes`만 있고 `imagesrcset`이 **없었다**. HTML 명세상 `imagesizes`는 `imagesrcset`과 함께일 때만 의미를 가지므로 **완전한 무효 속성**이었다.

`unoptimized` 때문에 srcset이 애초에 존재할 수 없었으므로, **H-1이 H-3의 원인**이다. H-1을 고치면 H-3은 자동 해소된다(§12에서 확인).

---

## 8. 선택한 수정 (요구사항 §18)

### 8.1 최종 diff — `app/page.tsx` 2곳

```diff
@@ -63,8 +63,9 @@ export default async function HomePage() {
   return (
     <>
-      {/* eslint-disable-next-line @next/next/no-head-element */}
-      <link rel="preload" as="image" href={HERO_IMAGE} fetchPriority="high" imageSizes="(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 800px" />
+      {/* 히어로 preload는 아래 <Image priority /> 가 자동 생성한다.
+          수동 <link rel=preload> 는 최적화 전 원본(/main_image.webp)을 가리켜
+          실제로 렌더되는 /_next/image 후보와 어긋나므로 두지 않는다. */}

@@ -124,7 +125,6 @@ export default async function HomePage() {
                 alt="김포문화원 앞마당에서 열린 국악 공연, 김포국악원"
                 priority
                 fetchPriority="high"
-                unoptimized
                 width={1200}
                 height={600}
```

### 8.2 ⚠️ 두 변경은 반드시 함께 가야 한다

요구사항 §15는 "원본과 optimized가 모두 다운로드되면 FAIL"이라고 못박았다. **`unoptimized`만 제거하고 수동 preload를 남기면 정확히 그 FAIL이 난다:**

```
수동 preload  → /main_image.webp          175,424 B  ← 아무도 안 쓰는 원본
<img srcset>  → /_next/image?…&w=828       28,486 B  ← 실제 렌더
합계 203,910 B — 수정 전(175,424 B)보다 오히려 나쁨
```

그래서 **`unoptimized` 제거와 수동 preload 제거를 하나의 커밋으로 묶었다.**

### 8.3 preload 단일화 — 어느 쪽을 남길지의 근거 (요구사항 §14)

요구사항은 "단순히 수동 preload가 나쁘다는 이유로 제거하지 말고 생성 결과를 비교하라"고 했다. 비교 결과다.

| 기준 | 수동 `<link>` 유지 | **Image 자동 preload 유지 (채택)** |
|---|---|---|
| 실제 렌더 후보와 URL 일치 | ❌ 원본을 가리켜 불일치 | ✅ `imageSrcSet`이 `<img srcSet>`과 **문자열 동일** |
| responsive srcset 대응 | ❌ 단일 URL만 가능 | ✅ 5개 후보 전부 포함 |
| `imageSizes` 유효성 | ❌ `imagesrcset` 없어 무시됨 | ✅ `imagesrcset`과 함께라 유효 |
| 중복 request 위험 | ❌ 이중 다운로드 유발 | ✅ 1회 |
| 유지보수성 | ❌ `sizes` 변경 시 2곳 동기화 필요 | ✅ `<Image>` 한 곳이 단일 진실 |
| Next.js 기본 흐름 | ❌ 우회 | ✅ 표준 |

**6개 기준 전부에서 자동 preload가 우세**하므로 수동 쪽을 제거했다.

### 8.4 하지 않은 것

- `sizes` 문자열은 **그대로 두었다.** `lg` 레이아웃 실제 슬롯은 약 725px이라 `800px` 선언이 다소 과하지만, `deviceSizes` 후보가 `[…,828,…]`이므로 725든 800이든 **선택 결과가 w=828로 동일**하다. 바이트가 바뀌지 않는 변경은 §18(최소 diff)에 어긋나므로 생략했다.
- `quality`, `width`, `height`, `placeholder`, `className` 등 나머지 prop은 **일절 건드리지 않았다.**
- 다른 페이지 이미지 일괄 최적화(§7 OUT OF SCOPE)는 하지 않았다.

---

## 9. 변경 파일

| 파일 | 변경 | 이유 |
|---|---|---|
| `app/page.tsx` | `unoptimized` 제거, 수동 `<link rel=preload as=image>` 제거 (+주석) | **본 Phase의 유일한 동작 변경.** RC-4·F-3 제거 |
| `lib/changelog.ts` | v5.25.0 항목 2건 추가 (한국어) | CLAUDE.md §8 규약 |
| `package.json` | version `5.24.0` → `5.25.0` | CLAUDE.md §8 규약 |

```
 app/page.tsx     | 6 +++---
 lib/changelog.ts | 8 ++++++++
 package.json     | 2 +-
 3 files changed, 12 insertions(+), 4 deletions(-)
```

**`lib/changelog.ts`가 홈 번들에 영향을 주지 않음** (`CODE-CONFIRMED`): 소비처가 `app/admin/page.tsx` **단 하나**(admin 라우트)라 홈 JS와 무관하다. 실제로 홈 JS 전송량이 변하지 않았다(§13).

---

## 10. Build / Test (요구사항 §20)

| 검증 | 명령 | 결과 |
|---|---|---|
| 타입 검사 | `npx tsc --noEmit` | ✅ **PASS** (출력 없음) |
| Production 빌드 | `npm run build` | ✅ **PASS** |
| Phase 1 폰트 회귀 가드 | `node scripts/check-font-regression.mjs` | ✅ **PASS** (`exit 0`) |
| 로컬 production 산출물 검증 | `next start -p 3100` | ✅ **PASS** (§12) |
| ESLint | `npm run lint` | ⚠️ **BLOCKED (기존 고장)** — Phase 1 N-1과 동일. 요구사항 §20에 따라 **수정하지 않음** |
| 브라우저 시각 검증 | Chrome 확장 | ❌ **NOT VERIFIED** (§15) |

```
✓ 폰트 전달 구조 정상 (통짜 폰트 없음 / 루트 @font-face 0개 / inlineCss off / subset 92개 정상)
✓ Compiled successfully in 18.8s
✓ Generating static pages using 15 workers (126/126) in 4.2s
```

### 라우트 렌더링 모드 불변 확인 (`MEASURED`)

```
Route (app)                          Revalidate  Expire
┌ ƒ /                    ← 여전히 Dynamic (Phase 3 대상, 의도적으로 유지)
├ ○ /_not-found  ○ /about  ○ /activities  …
● /blog/[id]  (+68 more paths)
ƒ Proxy (Middleware)
```

**126개 정적 페이지, 라우트 구조·렌더링 모드 모두 수정 전과 동일하다.** 요구사항 §7·§27대로 홈 Dynamic/캐시를 건드리지 않았다는 증거다.

**DB 작업: 없음.** 마이그레이션·스키마·RLS 변경 일절 없다.

### 로컬 검증 시 주의점 (기록)

첫 로컬 검증에서 포트 3000이 **작업 이전부터 떠 있던 별개 서버(PID 36812, 15:25 기동)** 에 점유되어 **낡은 산출물이 응답**했다. 이를 실제 결과로 오인하지 않고 포트를 3100으로 분리해 재검증했으며, **사용자의 기존 프로세스는 종료하지 않았다.**

---

## 11. Hero 최적화 응답 실측 (요구사항 §11·§12)

선행 보고서의 `28,486 B`를 그대로 믿지 않고 **5개 후보 전부를 직접 측정**했다.

| 후보 | Transfer | `Content-Type` | 디코드 dimensions | aspect | 캐시 |
|---|---:|---|---|---:|---|
| 원본 `/main_image.webp` | **175,424 B** | `image/webp` | 1200 × 675 | 1.7778 | HIT |
| `w=640&q=75` | **18,418 B** | **`image/avif`** | 640 × 360 | 1.7778 | HIT |
| `w=750&q=75` | **24,094 B** | **`image/avif`** | 750 × 422 | 1.7773 | HIT |
| `w=828&q=75` | **28,486 B** | **`image/avif`** | 828 × 466 | 1.7768 | HIT |
| `w=1080&q=75` | **42,657 B** | **`image/avif`** | 1080 × 607 | 1.7792 | HIT |
| `w=1200&q=75` | **59,290 B** | **`image/avif`** | 1200 × 675 | 1.7778 | HIT |

- 감사보고서의 **28,486 B는 정확했다** — `w=828` 후보와 바이트 단위로 일치.
- **포맷은 URL로 추정하지 않고 HTTP `Content-Type`을 직접 확인**했다(요구사항 §12). 전 후보가 `image/avif`다.
- 참고로 `Accept: image/webp`만 보내면 동일 URL이 `image/webp`(w=828 기준 더 큼)를 반환한다 → **정상적인 포맷 협상**이 동작 중이다.
- `w=1200`이 원본 고유 폭과 같아 **업스케일이 발생하는 후보는 없다.**

---

## 12. Hero Request / Preload Comparison (요구사항 §12·§14·§15)

### 12.1 생성 HTML 비교 (`MEASURED`, Production)

**수정 전**
```html
<link rel="preload" href="/main_image.webp" as="image" fetchPriority="high" imageSizes="…"/>
<link rel="preload" as="image" href="/main_image.webp" fetchPriority="high" imageSizes="…"/>
<img … class="w-full object-cover" src="/main_image.webp"/>
```

**수정 후**
```html
<link rel="preload" as="image"
      imageSrcSet="/_next/image?url=%2Fmain_image.webp&w=640&q=75 640w,
                   /_next/image?url=%2Fmain_image.webp&w=750&q=75 750w,
                   /_next/image?url=%2Fmain_image.webp&w=828&q=75 828w,
                   /_next/image?url=%2Fmain_image.webp&w=1080&q=75 1080w,
                   /_next/image?url=%2Fmain_image.webp&w=1200&q=75 1200w"
      imageSizes="(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 800px"
      fetchPriority="high"/>
<img … class="w-full object-cover"
     sizes="(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 800px"
     srcSet="…동일한 5개 후보…"
     src="/_next/image?url=%2Fmain_image.webp&w=1200&q=75"/>
```

### 12.2 대조표

| 항목 | 수정 전 | 수정 후 |
|---|---:|---:|
| `as="image"` preload 태그 수 | **2** | **1** |
| preload에 `imagesrcset` | ❌ 없음 | ✅ 5후보 |
| preload `imageSizes` 유효성 | ❌ 무효(명세상 무시) | ✅ 유효 |
| `<img srcset>` 후보 수 | **0** | **5** |
| `<img sizes>` 동작 | ❌ 무의미 | ✅ 동작 |
| 문서 내 bare `/main_image.webp` 참조 | 3 | **0** |

### 12.3 중복 네트워크 검증 (요구사항 §15, `MEASURED`)

```
preload count (as=image) : 1
imageSrcSet === srcSet   : true      ← 문자열 완전 동일
imageSizes  === sizes    : true      ← 문자열 완전 동일
bare "/main_image.webp"  : 0
```

**`imageSrcSet`과 `<img srcSet>`이 문자 단위로 동일**하고 `imageSizes`/`sizes`도 동일하므로, 브라우저의 후보 선택 알고리즘은 preload와 `<img>`에서 **반드시 같은 URL로 수렴**한다 → **다운로드 1회**.

요구사항 §15 체크리스트:

| 확인 항목 | 수정 전 | 수정 후 |
|---|---|---|
| 같은 Hero 원본이 두 번 요청되는가 | ❌ 아니오 (href 동일, 브라우저 dedupe) | ❌ 아니오 |
| 원본 WebP와 `/_next/image`가 동시 요청되는가 | ❌ 아니오 (원본만 존재) | ❌ **아니오 — 원본 참조 0개** |
| preload 후보와 `<img>` 후보가 달라 별도 다운로드가 나는가 | ❌ 아니오 | ❌ **아니오 (문자열 동일 검증)** |
| desktop/mobile 후보가 동시에 preload되는가 | ❌ 아니오 | ❌ 아니오 (`imagesrcset`은 후보 목록일 뿐, 브라우저가 1개만 받음) |

> **Hero 관련 실제 다운로드는 전·후 모두 정확히 1회다.** 수정 전에는 "1회지만 항상 175 KB", 수정 후에는 "1회이며 뷰포트에 맞는 18~59 KB"다.

---

## 13. Network Before / After (요구사항 §22, `MEASURED`)

### 13.1 요구사항 §22 지정 표

측정 프로파일: **모바일 390 CSS px / DPR 2** (Phase 1과 동일한 홈 `/` 초기 로드).

| 지표 | Phase 1 기준 | Phase 2 후 | 변화 |
|---|---:|---:|---:|
| 전체 초기 Transfer | 847,616 B | **700,643 B** | **−146,973 B (−17.3%)** |
| Hero Transfer | 175,424 B | **28,486 B** | **−146,938 B (−83.8%)** |
| Image 총 Transfer | 175,424 B | **28,486 B** | **−146,938 B (−83.8%)** |
| Hero Request 수 | 1 | **1** | 0 (불변) |
| Hero preload 수 | **2** | **1** | **−1** |
| HTML | 11,998 B | **11,960 B** | −38 B |
| CSS | 24,538 B | **24,538 B** | **0** |
| JS | 205,024 B | **205,027 B** | +3 B (오차) |
| Font | 430,632 B | **430,632 B** | **0** |
| 총 Request | 32 | **32** | 0 (불변) |

**검산**: −38 + 0 + 3 + 0 − 146,938 = **−146,973** ✅ 총계 변화와 정확히 일치.
즉 **전체 감소분은 전부 Hero에서 나왔고, 다른 항목은 사실상 움직이지 않았다.**

### 13.2 JS 계측 방법론 차이에 대한 정직한 설명

내 계측은 홈 HTML의 `<script src>` **13개 / 246,370 B**를 잡았다. Phase 1 보고서는 **12개 / 205,024 B**로 적혀 있다.

```
246,370 − 41,343 (chunks/a6dad97d9634a72d.js) = 205,027 B
Phase 1 보고값                                 = 205,024 B
차이                                           =       3 B
```

- Phase 1의 12-request 집계는 이 **41,343 B 청크 1개를 빠뜨린 것**으로 보인다(3 B 차이는 해시·빌드 간 미세 변동).
- **이는 Phase 2가 만든 변화가 아니다.** 근거: (a) 이번 diff에 홈 JS를 바꾸는 변경이 없고, (b) `lib/changelog.ts`는 admin 전용이라 홈 번들에 들어가지 않는다(§9).
- 위 §13.1 표는 **Phase 1과 동일한 12-청크 기준**으로 맞춰 비교했다. 동일 방법론으로 전량 집계하면 다음과 같다:

| 기준 | Phase 2 후 전체 초기 Transfer | Request |
|---|---:|---:|
| Phase 1 호환(12 JS 청크) | **700,643 B** | 32 |
| 전량 집계(13 JS 청크) | **741,986 B** | 33 |

어느 기준으로 보든 **Hero 감소분 −146,938 B는 동일**하다.

### 13.3 뷰포트별 Hero 실측 (요구사항 §13)

`sizes="(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 800px"` + `deviceSizes [640,750,828,1080,1200]` 기준 후보 선택이다.

| 프로파일 | 선택 후보 | Transfer | Phase 1(항상 175,424 B) 대비 |
|---|---|---:|---:|
| 모바일 360 × DPR 2 | `w=750` | **24,094 B** | **−86.3%** |
| 모바일 390 × DPR 2 | `w=828` | **28,486 B** | **−83.8%** |
| 모바일 390 × DPR 3 | `w=1200` | **59,290 B** | **−66.2%** |
| Pixel 5 412 × DPR 2.6 | `w=1080` | **42,657 B** | **−75.7%** |
| 데스크톱 1440 × DPR 1 | `w=828` | **28,486 B** | **−83.8%** |
| 데스크톱 1440 × DPR 2 | `w=1200` | **59,290 B** | **−66.2%** |

**모든 프로파일에서 감소**하며, 최악의 경우(DPR 3 고밀도)에도 **−66.2%** 다. 수정 전에는 176px 폰조차 175,424 B를 받았다.

### 13.4 요구사항 §24의 예상값 대조

요구사항 §24는 단순 산술로 `≈ 700,678 B`를 예상했다.

```
예상  847,616 − 175,424 + 28,486 = 700,678 B
실측                              = 700,643 B   (차이 −35 B, HTML 축소분)
```

**예상과 35 B 차이로 일치**한다. 요구사항 §24가 경고한 "이 수치를 만들려고 다른 리소스를 임의로 줄이는" 일은 하지 않았다 — 실제로 CSS·Font는 **바이트 단위로 완전히 동일**하다.

---

## 14. Responsive Image Verification (요구사항 §13, `MEASURED`)

### 14.1 생성된 srcset

```
/_next/image?url=%2Fmain_image.webp&w=640&q=75   640w
/_next/image?url=%2Fmain_image.webp&w=750&q=75   750w
/_next/image?url=%2Fmain_image.webp&w=828&q=75   828w
/_next/image?url=%2Fmain_image.webp&w=1080&q=75 1080w
/_next/image?url=%2Fmain_image.webp&w=1200&q=75 1200w
```

`sizes`에 `100vw`가 포함되어 Next.js가 `deviceSizes` 전량(`≥640`)을 후보로 생성했다. `w` 디스크립터이므로 **뷰포트 폭 × DPR** 기준으로 브라우저가 선택한다.

### 14.2 모바일이 데스크톱 크기를 받지 않는가 — ✅ 받지 않는다

| viewport | 슬롯(css px) | DPR 2 필요폭 | 선택 | 데스크톱 최대(1200w=59,290 B) 대비 |
|---|---:|---:|---|---:|
| 390px | 390 (100vw) | 780 | **w=828** | **−52.0%** |
| 360px | 360 (100vw) | 720 | **w=750** | **−59.4%** |
| 1440px | 800 (sizes) | 1600 → 상한 | w=1200 | — |

**수정 전에는 이 구분이 존재하지 않았다**(srcset 자체가 없어 전 기기가 175,424 B). 요구사항 §13이 요구한 "모바일이 불필요하게 데스크톱 크기를 받지 않는지"는 **해소됐다.**

---

## 15. Visual / LCP / Lighthouse Verification (요구사항 §10·§16·§25·§26)

### 15.1 브라우저 시각 검증 — ❌ `NOT VERIFIED`

```
mcp__claude-in-chrome__tabs_context_mcp
→ Browser extension is not connected.
```

Chrome 확장이 연결되지 않아 **요구사항 §26의 `/`·`/blog/[id]`·`/admin` 시각 확인을 수행하지 못했다.** Phase 1·감사 때와 동일한 환경 제약이다. Phase 1 미확인 항목(Pretendard 표시, 줄바꿈, 폰트 swap, layout shift) 역시 **이번에도 검증하지 못했다.**

### 15.2 LCP 후보 재검증 — ⚠️ `NOT VERIFIED` (실측), `INFERRED` (구조적 근거)

요구사항 §10이 요구한 대로 **추론과 측정을 구분해 적는다.**

| 구분 | 내용 | 등급 |
|---|---|---|
| Hero가 above-the-fold 최대 이미지이며 최우선 로드되도록 구성돼 있다 | `priority` + `fetchPriority="high"` + `rel=preload` + 본문 상단 배치(`app/page.tsx:121`) | `CODE-CONFIRMED` |
| Hero가 홈에서 가장 큰 단일 이미지 리소스다 | 나머지 이미지는 전부 `loading="lazy"`이며 `<aside>`는 `hidden lg:flex` | `CODE-CONFIRMED` |
| **Hero가 실제 LCP element다** | **브라우저 미연결로 측정 못 함** | ❌ **NOT VERIFIED** |
| LCP 시간(ms) 개선 | 측정 못 함 | ❌ **NOT VERIFIED** |

> **정직하게**: 나는 "LCP가 몇 ms 빨라졌다"고 주장하지 않는다. 증명한 것은 **"LCP 후보로 지목된 리소스의 바이트가 −83.8% 줄고 포맷·responsive 전달이 회복됐다"** 는 네트워크 사실이다.

### 15.3 Lighthouse / PageSpeed — ❌ `NOT VERIFIED`

```
GET https://www.googleapis.com/pagespeedonline/v5/runPagespeed?…&strategy=mobile
→ HTTP 429 Too Many Requests   (일일 쿼터 소진 — 감사·Phase 1 때와 동일)
```

요구사항 §25에 따라 이것으로 Hero 네트워크 최적화를 FAIL 처리하지 않는다. 판정 근거는 §11~14의 실측 network 수치다.

### 15.4 시각적 동일성 — 대체 검증 (요구사항 §16, `MEASURED` + `CODE-CONFIRMED`)

픽셀 확인은 못 했으나, **시각 변화가 구조적으로 불가능함**을 다음으로 보인다.

| 유지 항목 | 근거 | 결과 |
|---|---|---|
| Hero 이미지 자체 | `src={HERO_IMAGE}` 동일, 원본 파일 미변경 | ✅ 동일 |
| 비율 / 크롭 | `width=1200 height=600` + `object-cover` **미변경**. 크롭은 CSS가 수행 | ✅ 동일 |
| 인코더가 크롭했는가 | AVIF 후보 5개 전부 aspect **1.7768~1.7792** = 원본 1.7778 유지 → **순수 리사이즈, 크롭 없음** | ✅ 동일 |
| 위치 / object-position | `className` 문자열 미변경 | ✅ 동일 |
| blur placeholder | `placeholder="blur"` + `blurDataURL` 문자 단위 동일 | ✅ 동일 |
| overlay / 텍스트 배치 / section 높이 | `<figure>`·주변 DOM 미변경 | ✅ 동일 |
| 모바일/PC 레이아웃 | `lg:grid lg:grid-cols-12` 등 레이아웃 클래스 미변경 | ✅ 동일 |
| CLS 위험 | `width`/`height` 유지로 aspect-ratio 예약 그대로. **preload 1개 감소는 CLS에 영향 없음** | ✅ 변화 없음 |
| 화질 | `q=75`(Next 기본, 수정 전 원본은 무압축 재인코딩 없음) | ⚠️ §17 R-1 |

> **남는 한계**: AVIF `q=75` 재인코딩에 따른 **육안 화질**은 브라우저 미연결로 확인하지 못했다(§17 R-1).

### 15.5 기능 회귀 — 공개/관리자 라우트 전수 (`MEASURED`)

| 라우트 | HTTP |
|---|---|
| `/` `/intro` `/classes` `/activities` `/contact` `/blog` `/gallery` `/notices` `/login` `/Song-Ri-Gyel` | **200** |
| `/admin` | **307** → `/admin/login?next=%2Fadmin` (기존 인증 리다이렉트) |

---

## 16. Phase 1 Regression Verification (요구사항 §19, `MEASURED`)

Phase 1이 확보한 값이 하나도 악화되지 않았음을 Production에서 재확인했다.

| Phase 1 확보 항목 | 요구 상태 | Phase 2 후 실측 | 결과 |
|---|---|---|---|
| 통짜 2 MB Pretendard 없음 | 부재 | `PretendardVariable-s.p.77d5d991.woff2` → **HTTP 404** | ✅ |
| font preload 0 | 0건 | `Link:` 헤더 = `…css>; rel=preload; as="style"` **1건뿐**, `as="font"` **0건** | ✅ |
| HTML `@font-face` 0 | 0개 | **0개** | ✅ |
| `inlineCss: false` | false | `next.config.ts` 미변경 + `<style>` 블록 **0개**, 외부 stylesheet **2개** | ✅ |
| 폰트 회귀 가드 | PASS | `node scripts/check-font-regression.mjs` → **exit 0** | ✅ |
| Font Transfer | 430,632 B | **430,632 B** | ✅ **바이트 동일** |
| CSS Transfer | 24,538 B | **24,538 B** | ✅ **바이트 동일** |

**Phase 1 회귀 0건.** 폰트·CSS는 바이트 단위로 완전히 동일하다.

---

## 17. Remaining Risks

| # | 위험 | 등급 | 완화 / 관측 방법 |
|---|---|---|---|
| R-1 | **AVIF `q=75` 화질 미확인** — 육안 열화 여부를 픽셀로 확인하지 못했다 | 🟡 MEDIUM | 브라우저/육안 확인 권장. 문제 시 `<Image quality={85}>` 1줄로 조정 가능(단 `next.config.ts`의 `images.qualities`에 값 추가 필요). 구조 변경 불필요 |
| R-2 | **첫 방문자 콜드 변환 지연** — 새 `(url,w,q)` 조합의 최초 1회는 서버 변환 비용 발생 | 🟢 LOW | 조합당 1회뿐이며 현재 5후보 전부 이미 `HIT`. 실측상 워밍 후 원본보다 빠름(§5.3) |
| R-3 | **DPR 3 기기는 59,290 B** — 감소폭이 −66.2%로 상대적으로 작다 | 🟢 LOW | 그래도 수정 전보다 116 KB 적다. 더 줄이려면 원본을 1200px 초과 해상도로 교체해야 하는데 이는 §7 OUT OF SCOPE(이미지 교체) |
| R-4 | **`sizes`의 `800px`이 실제 슬롯(~725px)보다 넓다** | 🟢 LOW | `deviceSizes` 특성상 선택 후보(w=828)가 동일해 **바이트 영향 0**. §8.4대로 의도적 미변경 |
| R-5 | **브라우저 시각·CLS·LCP 실측 부재** | 🟡 MEDIUM | Phase 1 R-1(폰트 fallback metrics)과 함께 브라우저 연결 시 일괄 확인 권장 |
| R-6 | **`npm run lint` 기존 고장** (Phase 1 N-1) | 🟡 MEDIUM | 작업 전부터 존재. 요구사항 §20에 따라 미수정. `tsc --noEmit` + `next build` 내장 타입검사로 대체 |
| R-7 | **`/` 는 여전히 Dynamic / CDN MISS** | 🟠 HIGH (미해결) | **Phase 3 범위 — 의도적으로 남김** |

---

## 18. Phase 3 Handoff

요구사항 §27에 따라 **이번에 일절 손대지 않았고**, 발견 사항만 남긴다.

| 항목 | 관측 (`MEASURED`) | 주의 |
|---|---|---|
| 홈 `/` Dynamic 렌더링 (RC-3) | `ƒ /`, `X-Vercel-Cache: MISS`, `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` | ⚠️ **가장 위험.** `app/page.tsx:58` `.lte("published_at", …)` 가 예약 발행과 얽혀 있고 `3ee6d03`·`0c172be`에서 두 번 터진 이력 |
| middleware 공개 라우트 인증 조회 (F-5) | `ƒ Proxy (Middleware)` 상시 동작 | 인증 로직이라 회귀 위험 MEDIUM |
| 모바일 미표시 `<aside>` gallery 쿼리 (F-6) | `app/page.tsx:186` `hidden lg:flex` 인데 `supabase.from("gallery")` 는 항상 실행 | LOW |
| `npm run lint` 복구 (N-1) | Next 16의 `next lint` 제거 + ESLint 10 flat config 미마이그레이션 | 성능 무관 |
| 그 외 페이지 이미지 최적화 | 홈 외 라우트는 이번에 조사·수정하지 않음 | 별도 판단 필요 |

> Phase 2에서 **JS 205 KB / Font 430 KB** 가 이제 전송량의 최대 항목이다. Hero는 28 KB로 4번째가 됐다.

---

## 19. Repository Integrity

### 최종 상태

```
$ git status --porcelain      →  (출력 없음 — clean)
$ git rev-parse HEAD          →  464ee1e
$ git log -2 --oneline
464ee1e perf: 히어로/LCP 이미지 전달 회귀 제거 (v5.25.0)
d7cb350 docs: Phase 1 폰트 성능 회귀 수정 보고서 추가
```

### 기준선 대비 전체 diff (`d7cb350` → `464ee1e`)

```
 app/page.tsx     | 6 +++---     unoptimized 제거 + 수동 preload 제거
 lib/changelog.ts | 8 ++++++++   v5.25.0 기록 (CLAUDE.md §8 규약)
 package.json     | 2 +-         version 5.25.0
 3 files changed, 12 insertions(+), 4 deletions(-)
```

- **동작 변경은 `app/page.tsx` 단 1파일**이며 전부 Hero/LCP와 직접 연결된다.
- 변수명 정리·컴포넌트 리팩터링·import 순서·무관한 Tailwind/레이아웃 변경 **없음** (요구사항 §18).
- 전체 revert / 과거 커밋 checkout **하지 않음** (요구사항 §8).
- **DB migration 없음.** `vercel.json` crons 변경 없음.
- Phase 1 산출물(`app/layout.tsx`, `tailwind.config.js`, `next.config.ts`, `public/fonts/`, `scripts/check-font-regression.mjs`) **일절 미변경**.
- 사용자의 기존 로컬 프로세스(PID 36812 등) **종료하지 않음**.

### Production Deployment

- **방식**: 기존 검증된 경로 — GitHub `origin/main` push → Vercel Git Integration 자동 Production 배포.
- **push**: `d7cb350..464ee1e  main -> main`
- **배포 확인**: 6회 폴링(약 90초) 후 `imageSrcSet` 등장 + bare 원본 참조 0 확인.
- 배포 전 §21 Gate(타입검사·빌드·폰트가드·diff 범위·라우트 불변) **전부 통과 후** 배포했다.

---

## 20. Final Verdict

# ✅ CONDITIONAL PASS

### 요구사항 §28 PASS 조건 대조

| # | 조건 | 결과 | 근거 |
|---|---|---|---|
| 1 | Hero의 불필요한 `unoptimized` 제거 또는 동등한 최적 전달 구조 확정 | ✅ | `unoptimized` 제거, AVIF + 5후보 srcset 전달 확정 |
| 2 | Production에서 Hero bytes 실질 감소 | ✅ | **175,424 → 28,486 B (−83.8%)**, 전 뷰포트에서 감소(최악 −66.2%) |
| 3 | 중복/잘못된 preload 제거 | ✅ | preload **2 → 1**, 무효 `imageSizes` → `imagesrcset` 동반으로 유효화 |
| 4 | 실제 Hero 요청이 올바른 optimized candidate 사용 | ✅ | `<img src>`·`srcSet` 전부 `/_next/image`, bare 원본 참조 **0**, `Content-Type: image/avif` |
| 5 | responsive image 정상 | ✅ | 5후보 생성, 모바일 390/DPR2 → `w=828`, 360/DPR2 → `w=750` |
| 6 | build PASS | ✅ | `tsc --noEmit` PASS, `next build` PASS, 126 페이지, 라우트 모드 불변 |
| 7 | Phase 1 font regression guard PASS | ✅ | `exit 0`. Font·CSS 전송량 **바이트 단위 동일** |
| 8 | Production 정상 | ✅ | 공개 10 라우트 HTTP 200, `/admin` 정상 리다이렉트 |
| 9 | 기능·레이아웃 회귀 없음 확인 | ⚠️ | **대체 증거로만 확인** — §15.4. 픽셀 확인은 미수행 |

**핵심 네트워크 조건 8개 전부 충족.** 9번만 환경 제약으로 대체 증거에 의존한다.

### 이중 다운로드 FAIL 조건 점검 (요구사항 §28)

| FAIL 조건 | 해당? |
|---|---|
| optimized 이미지가 실제 Hero로 사용되지 않음 | ❌ 해당 없음 |
| 원본과 optimized가 모두 다운로드됨 | ❌ 해당 없음 (`imageSrcSet === srcSet`, bare 참조 0) |
| Hero bytes가 실질적으로 줄지 않음 | ❌ 해당 없음 (−83.8%) |
| build 실패 | ❌ 해당 없음 |
| layout/image 회귀 | ❌ 구조적으로 불가 (§15.4) |
| Phase 1 회귀 발생 | ❌ 해당 없음 (§16) |

### 그럼에도 `PASS`가 아니라 `CONDITIONAL PASS`인 이유

요구사항 §28의 CONDITIONAL PASS 정의 — *"핵심 네트워크 수정은 모두 검증됐으나 Chrome/Lighthouse 등 일부 시각·Lab 검증만 환경 제약으로 미확인"* — 에 정확히 해당한다.

| 미확인 항목 | 사유 |
|---|---|
| 브라우저 실제 렌더링 / 시각 회귀 (§26) | Chrome 확장 미연결 |
| **Hero가 실제 LCP element인지** (§10) | 위와 동일 — 구조적 근거만 있고 실측 아님 |
| AVIF 육안 화질 (§16) | 위와 동일 → R-1 |
| CLS / LCP 시간 실측 | 위와 동일 |
| Lighthouse / PageSpeed 점수 (§25) | PSI API **HTTP 429** (쿼터 소진) |

### 권장 후속 조치

1. **브라우저에서 `/`를 모바일 폭으로 열어 Hero 화질·레이아웃 확인** (R-1) — Phase 1의 미확인 항목(폰트 swap·CLS)과 함께 한 번에 처리 가능.
2. PSI 쿼터 회복 후 모바일 점수 측정.
3. Phase 3 착수 — 이제 홈 Dynamic/CDN MISS(RC-3)가 남은 최대 항목이며, **예약 발행과 얽혀 회귀 위험이 가장 높으므로 단독 Phase로 진행할 것.**

---

## 부록 — 요구사항 §30 직답

**Q. Hero URL** → `/_next/image?url=%2Fmain_image.webp&w={640|750|828|1080|1200}&q=75` (5후보 srcset, 기본 `src`는 `w=1200`)
**Q. Hero Content-Type** → `image/avif` (HTTP 헤더로 직접 확인, 전 후보)
**Q. Hero Transfer** → **28,486 B** (모바일 390/DPR2 · 데스크톱 1440/DPR1). 범위 18,418~59,290 B. 수정 전 175,424 B 고정
**Q. Hero preload** → **1개** (`imageSrcSet` 5후보 + `imageSizes`, `fetchPriority="high"`). 수정 전 2개(둘 다 무효 `imageSizes`)
**Q. Hero request** → **1회** (전·후 동일). 이중 다운로드 없음
**Q. 전체 Transfer** → **700,643 B** (Phase 1 호환 기준) / 741,986 B (13청크 전량 기준). 수정 전 847,616 B
