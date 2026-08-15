# 김포국악원 Phase 1 — Pretendard 폰트 전달 + 인라인 CSS 성능 회귀 수정 보고서

- **대상**: `https://gimpogugak.com` (Production)
- **저장소**: `C:\Users\JUN\gimpo-gugak` — branch `main`
- **작업 시작 HEAD**: `b770fea`
- **작업 결과 HEAD**: `49141b0` (`perf: 폰트 전달/인라인 CSS 성능 회귀 제거 (v5.24.0)`)
- **작업 일시**: 2026-08-15
- **선행 문서**: `reports/performance/KIMPO_GUGAK_PERFORMANCE_READONLY_AUDIT.md`
- **최종 판정**: ✅ **CONDITIONAL PASS** (§19)

증거 등급: `MEASURED`(실측) / `CODE-CONFIRMED`(코드 확인) / `INFERRED`(추론) / `NOT VERIFIED`(미확인)

---

## 1. Executive Summary

Phase 1의 목표는 하나였다 — **2026-03-30에 들어온 폰트 전달/인라인 CSS 회귀를 최소 변경으로 제거하고 Production에서 실제 네트워크 절감을 증명한다.**

수정은 소스 7개 파일 + 폰트 에셋 교체로 끝났다. Hero 이미지(Phase 2)와 홈 Dynamic 렌더링(Phase 3)은 손대지 않았다.

### 핵심 결과 (`MEASURED`, Production 실측)

| 지표 | 수정 전 | 수정 후 | 변화 |
|---|---:|---:|---:|
| 홈 `/` 초기 전송량 합계 | 2,639,972 B | **847,616 B** | **−67.9%** |
| 홈 `/` Resource Size 합계 | 4,690,142 B | **1,469,699 B** | **−68.7%** |
| 홈 `/` 문서 (압축 해제) | 1,593,123 B | **52,005 B** | **−96.7%** |
| 홈 `/` 문서 (brotli) | 100,046 B | **11,998 B** | **−88.0%** |
| HTML 내 `@font-face` | **2,428개** (1,214 × 2중) | **0개** | **−100%** |
| 초기 강제 preload 폰트 | 3개 / 2,118,504 B | **0개 / 0 B** | **완전 제거** |
| 홈 폰트 실제 전송량 | 2,118,504 B | **430,632 B** | **−79.7%** |
| 폰트가 전송량에서 차지하는 비중 | **80.2%** | **50.8%** | −29.4%p |
| 외부 stylesheet | **0개** | **2개 (전부 immutable)** | 캐시 재사용 회복 |
| `PretendardVariable.woff2` (2.0 MB) | 존재·preload됨 | **HTTP 404 (소멸)** | — |

> 감사보고서가 지목한 4대 Root Cause 중 **RC-1(2 MB 통짜 폰트 preload)**, **RC-2(미사용 폰트 5종 683 KB CSS)**, **F-1(RSC flight 2중 직렬화)**, **F-2(외부 stylesheet 0개)**, **F-4(미사용 폰트 preload 60,816 B)** 를 제거했다.
> **RC-3(홈 Dynamic)**, **RC-4(Hero unoptimized)**, **F-3(Hero preload 중복)**, **F-5**, **F-6**, **F-7** 은 범위 밖이라 **의도적으로 그대로 두었다.**

---

## 2. 수정 전 기준선

### 2.1 Git 기준선 (`MEASURED`)

작업 시작 시점에 직접 확인한 값이다.

```
$ git branch --show-current   →  main
$ git rev-parse HEAD          →  b770feae145f29ec066d5e18749fd225dc1c78e1
$ git status --porcelain      →  ?? reports/
```

- tracked 파일 변경: **0개** (완전 clean)
- untracked: `reports/` 디렉터리 1개 — 선행 감사보고서. **작업 중 일체 수정·삭제하지 않았다.**
- 작업 중 `.claude/settings.local.json` 이 하네스에 의해 자동 변경되었으나(내가 실행한 일회성 명령의 권한 캐시), 코드와 무관하므로 **커밋 전 `git checkout` 으로 원복**했다.

### 2.2 Production 기준선 (`MEASURED`, 2026-08-15 배포 직전 재실측)

감사보고서 수치를 **그대로 믿지 않고 배포 직전에 다시 측정**했으며, 전부 일치했다.

| 라우트 | identity (Resource) | brotli (Transfer) |
|---|---:|---:|
| `/` | **1,593,123 B** | 100,046 B |
| `/intro` | **1,569,762 B** | 93,989 B |
| `/classes` | **1,586,985 B** | 97,740 B |

```
Link: </_next/static/media/7fc9c92292d32c4a-s.p.c199330c.woff2>; rel=preload; as="font"
      </_next/static/media/PretendardVariable-s.p.77d5d991.woff2>; rel=preload; as="font"   ← 2,057,688 B
      </_next/static/media/fca78c2ee6cec166-s.p.11a55858.woff2>; rel=preload; as="font"

홈 HTML 내 @font-face 문자열 출현 = 2,428개
홈 HTML 내 <link rel="stylesheet"> = 0개
```

> **감사보고서보다 한 걸음 더 확인한 것**: 감사는 `<style>` 블록 1,214개와 RSC flight 1,214개를 각각 셌다. 배포 직전 실측에서 **원문 HTML 전체의 `@font-face` 출현이 정확히 2,428개**임을 확인해, 2중 직렬화(F-1)를 단일 카운트로 재확인했다.

---

## 3. 감사보고서 재검증 결과

수정 착수 전, 감사 결론을 현재 코드·Git·Production과 다시 대조했다.

| 감사 주장 | 재검증 | 결과 |
|---|---|---|
| `PretendardVariable.woff2` = 2,057,688 B, `unicode-range` 없음 | `ls -l public/fonts/` + CDN 원본 대조 | ✅ 일치 (`MEASURED`) |
| next/font가 HTTP `Link:` 로 preload | Production 응답 헤더 | ✅ 일치 (`MEASURED`) |
| 미사용 CSS 변수 4개 (`--font-noto-serif`, `--font-noto-sans`, `--font-gowun-dodum`, `--font-nanum-gothic`) | 저장소 전수 grep | ✅ 일치 — 선언부 `app/layout.tsx` 외 참조 0건 (`CODE-CONFIRMED`) |
| `Nanum Myeongjo` 는 실사용 | `globals.css:56,64,72` `.blog-content h1~h3` | ✅ 일치. **단, 사용처는 `/blog/[id]` 단 하나** (`components/BlogContent.tsx` 가 유일한 `.blog-content` 소비자) (`CODE-CONFIRMED`) |
| `inlineCss:true` 가 2중 직렬화 유발 | 로컬 빌드에서 `inlineCss` true/false 양쪽 산출물 비교 | ✅ 일치 — §10.2에 실측 대조표 (`MEASURED`) |
| `font-serif`(`app/page.tsx:91`)는 Georgia로 폴백 | `tailwind.config.js` 에 `serif` 확장 없음 | ✅ 일치 → Noto Serif KR 제거해도 외형 변화 없음 (`CODE-CONFIRMED`) |
| TinyMCE 에디터가 layout.tsx 폰트에 의존할 위험 | `PostEditor.tsx:37-40`, `PostModal.tsx:31-34` | ❌ **의존하지 않는다.** 에디터는 `content_css` 로 자체 CDN(jsDelivr Pretendard dynamic subset + Google Fonts Nanum) 을 iframe 내부에 주입한다 → layout.tsx 폰트 제거는 **에디터에 무영향** (`CODE-CONFIRMED`) |

### 감사보고서 대비 새로 확인한 사실

1. **에디터는 이미 dynamic subset을 쓰고 있었다.** `PostEditor.tsx:38` / `PostModal.tsx:32` 가 `pretendard-dynamic-subset.css` 를 그대로 사용 중이다. 즉 **저장소 안에 정답 구조가 이미 살아 있었고**, 공개 페이지만 통짜 폰트로 퇴행해 있었다.
2. **`4621b6b^` 를 그대로 복원하면 오히려 타이포그래피 회귀가 난다** — §4.3 참조. 감사보고서의 "선택지 A(과거 코드 복원)"는 그대로 적용하면 안 되는 안이었다.

---

## 4. 3개 회귀 커밋 분석

전체 revert는 하지 않았다. 세 커밋 각각의 diff를 읽고 **폰트 관련 변경만** 선별 복원했다.

### 4.1 커밋별 요약

| Commit | 의도 | 폰트 관련 변경 | 실제 성능 영향 | 현재 코드에 남아 있던 부분 | Phase 1 처리 |
|---|---|---|---|---|---|
| `0bf8b63`<br>03-30 15:08 | "모바일 PageSpeed 최적화: LCP/FCP 개선" | Pretendard CDN stylesheet를 `rel=preload as=style` + `afterInteractive` 스크립트 주입으로 변경 | 폰트 CSS가 hydration 이후에야 적용 → **장시간 FOUT**. 이 커밋 자체는 통짜 폰트와 무관 | 없음 (`4621b6b`가 이 블록을 통째로 삭제) | 복원하지 않음 — 이 비동기 주입 방식 자체가 나쁜 패턴 |
| `64ec14e`<br>03-30 16:29 | "메인 이미지 unoptimized 강제 적용 (LCP 병목 해결)" | **폰트 변경 없음** (`app/page.tsx` 1줄) | LCP 이미지 28 KB → 175 KB | `app/page.tsx:128` `unoptimized` | **범위 밖 — 손대지 않음 (Phase 2)** |
| `4621b6b`<br>03-30 16:06 | "블로그 최적화" | **결정타.** Pretendard Dynamic Subset CDN 삭제 → `next/font/local` + 통짜 2,057,688 B woff2 추가. `tailwind.config.sans` 를 `var(--font-pretendard)` 로, `globals.css` 를 `'Pretendard'` → `var(--font-pretendard)` 로 변경 | 초기 전송량의 **77.9%** 를 차지하는 단일 파일 + 최고 우선순위 preload | `app/layout.tsx:10-15`, `public/fonts/PretendardVariable.woff2`, `tailwind.config.js:14`, `globals.css:31,41` | **폰트 전달 방식만 surgical restore** |

### 4.2 `4621b6b` 가 지운 것 (`CODE-CONFIRMED`)

```diff
-        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
-        <link rel="preload" as="style"
-          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.css" />
-        <Script id="pretendard-async" strategy="afterInteractive"> … </Script>
-      <body className="font-sans …">
+      <body className={`${pretendard.className} …`}>
```

### 4.3 ⚠️ `4621b6b^` 를 그대로 복원하면 안 되는 이유 (`CODE-CONFIRMED`)

감사보고서는 `4621b6b` 직전 상태를 "이미 검증된 구성"으로 지목했으나, **직접 확인해보니 그대로 복원하면 타이포그래피가 바뀐다.**

`4621b6b^` 시점의 `tailwind.config.js` 는 `theme.extend = {}` 였다. 즉 `<body className="font-sans">` 의 `font-sans` 는 **Tailwind 기본 스택**(`ui-sans-serif, system-ui, -apple-system, "Segoe UI", …`)으로 해석되었고, Pretendard는 어디에도 지정되지 않았다.

> **결론: 회귀 이전의 공개 페이지 본문은 Pretendard가 아니라 시스템 폰트로 그려지고 있었다.** Pretendard는 `.blog-detail-article` / `.blog-content`(블로그 본문)에만 적용됐다.

현재 사이트는 전역 Pretendard다. 요구사항 §11(디자인 회귀 금지)·§9 목표 E(Pretendard 외형 유지)에 따라 **"과거 구조 복원"이 아니라 "과거의 전달 방식 + 현재의 적용 범위"** 를 결합했다.

| 항목 | `4621b6b^` (과거) | `b770fea` (회귀 후) | Phase 1 (현재) |
|---|---|---|---|
| 전달 방식 | dynamic subset (jsDelivr CDN) | 통짜 2 MB 자체 호스팅 + preload | **dynamic subset 자체 호스팅** |
| 적용 범위 | 블로그 본문만 | 사이트 전역 | **사이트 전역 (유지)** |
| 폰트 종류 | static (weight별 파일) | variable 100–900 | **variable 45–920 (유지)** |
| 서드파티 의존 | 있음 (jsDelivr) | 없음 | **없음 (유지)** |

---

## 5. 실제 Root Cause

세 갈래이며, 서로 곱해져서 문제를 키웠다.

```
① 폰트 파일 — PretendardVariable.woff2 2,057,688 B
   unicode-range 없음 → "가" 한 글자에 2 MB 전체 필요
   next/font/local 이 자동으로 HTTP Link: rel=preload as=font 생성
   → 최고 우선순위. LCP 히어로 이미지와 대역폭 정면 경쟁
                    ↓
② 폰트 CSS — 루트 레이아웃 한글 웹폰트 5종
   Noto Serif KR 372 + Noto Sans KR 372 + Nanum Myeongjo 184
   + Nanum Gothic 184 + Gowun Dodum 95 = @font-face 1,214개 / 683 KB
   그중 4종(1,023개)은 CSS 변수 소비처가 저장소 전체에 0건
   Noto 2종은 preload:true → 60,816 B 순수 낭비
                    ↓
③ 증폭기 — experimental.inlineCss: true
   위 683 KB를 <style> 블록에 인라인       …… 699,922 B
   + RSC flight payload(self.__next_f.push)에 재직렬화 …… ~702,000 B
   + 외부 <link rel="stylesheet"> 0개
   → 문서 1,593,123 B 중 1,401,922 B(88.0%)가 폰트 CSS
   → 페이지 이동·재방문마다 1.5 MB 재전송·재파싱
```

**핵심 통찰**: ③ 때문에 ②의 절감 효과가 **2배로 돌아온다.** 폰트 CSS 1 KB를 줄이면 문서는 2 KB 줄어든다. 그래서 ②와 ③을 함께 고쳤다.

---

## 6. 선택한 수정 구조와 이유

### 6.1 Pretendard — 자체 호스팅 variable dynamic subset

**채택**: Pretendard 공식 v1.3.9 배포본의 `pretendardvariable-dynamic-subset.css` + woff2 92조각을 `public/fonts/pretendard-1.3.9/` 에 자체 호스팅하고, `app/layout.tsx` 가 `<link rel="stylesheet">` 로 로드.

**후보 비교 (`MEASURED` — 홈 텍스트 285자 기준 실측)**

| 후보 | 초기 폰트 전송 | 폰트 CSS | 서드파티 | 판정 |
|---|---:|---:|---|---|
| 현행 통짜 variable + preload | 2,057,688 B | 154 B | 없음 | ✗ 기준선 |
| **variable dynamic subset (채택)** | **430,632 B** (16/92 조각) | 54,380 B 외부 | **없음** | ✅ |
| static dynamic subset (`4621b6b^` 방식) | 749,244 B (16조각 × 4 weight) | 613,611 B 외부 | jsDelivr | ✗ 더 큼 |
| 공식 static subset 단일 파일 | ~1,070,000 B (267 KB × 4 weight) | 소 | 없음 | ✗ 더 큼 |
| 공식 variable subset 단일 파일 | — | — | — | ✗ **존재하지 않음** (HTTP 404 확인) |

**채택 이유**

1. **가장 작다.** 실측 4개 후보 중 최소(430,632 B). 사용 글자가 적은 페이지는 더 줄어든다 — `/classes` 는 233,292 B (9조각).
2. **variable이 static보다 유리하다.** 이 사이트는 weight 400/500/600/700 **4종**을 쓴다(`font-medium` 384회, `font-bold` 226회, `font-semibold` 98회, `font-normal` 23회 — `CODE-CONFIRMED`). static dynamic subset은 (조각 × weight)만큼 파일이 늘지만, variable은 조각당 1개로 4 weight를 모두 커버한다.
3. **자체 호스팅이 현재의 불변식을 지킨다.** 지금 사이트는 서드파티 폰트 의존이 0이다. jsDelivr 복원은 성능은 개선해도 **critical path에 서드파티 origin(DNS+TLS)을 새로 들이는 별개의 회귀**다. 자체 호스팅이 오히려 변화가 작다.
4. **외부 stylesheet이므로 `inlineCss` 의 2중 직렬화 대상이 아니다.** HTML·RSC 어디에도 폰트 CSS가 실리지 않는다(목표 C·D 동시 달성).
5. **타이포그래피가 정확히 보존된다.** 같은 Pretendard, 같은 variable 축(45–920 ⊇ 사용 400–700), 같은 `font-display: swap`.
6. **발명이 아니다.** Pretendard 공식 배포 산출물 그대로이며, 이 저장소의 TinyMCE 에디터가 이미 같은 dynamic subset 방식을 쓰고 있다.

**적용 CSS 체인** (`MEASURED`, 빌드 산출물에서 확인)

```
public/fonts/pretendard-1.3.9/pretendard-variable-dynamic-subset.css
  → @font-face { font-family: 'Pretendard Variable'; font-weight: 45 920;
                 font-display: swap; unicode-range: … }  × 92
tailwind.config.js  fontFamily.sans = ['"Pretendard Variable"', 'Pretendard', 'system-ui', 'sans-serif']
  → Tailwind preflight: html { font-family: Pretendard Variable,Pretendard,system-ui,sans-serif }
  → .font-sans      { font-family: Pretendard Variable,Pretendard,system-ui,sans-serif }
```

### 6.2 미사용 폰트 4종 제거

`Noto Serif KR`, `Noto Sans KR`, `Gowun Dodum`, `Nanum Gothic` 선언 삭제. 전수 grep 결과 CSS 변수 소비처가 **0건**이었다.

`globals.css:31,41` 의 `'Noto Sans KR'` 는 **문자열 리터럴 폴백**이라 next/font가 생성하던 해시 패밀리명과 애초에 매칭되지 않았다. 즉 제거해도 렌더링은 변하지 않는다. (감사 §12 2순위의 판단과 일치, `CODE-CONFIRMED`)

### 6.3 Nanum Myeongjo — 라우트 국소화

삭제하지 않고 **유일한 사용처인 `app/blog/[id]/page.tsx` 로 이동**했다. `globals.css` 의 `.blog-content h1~h3` 가 실제로 쓰기 때문이다.

빌드 산출물에서 확인한 결과(`MEASURED`):
- 루트 CSS 청크(`5d89a06cf5a54f50.css`, 66,766 B): `@font-face` **0개**
- 블로그 전용 CSS 청크(`fb9e98a0e51801e6.css`, 90,732 B): `@font-face` 185개 → **`/blog/[id]` 에서만 로드**
- `.blog-content h1` 이 참조하는 `--font-nanum-myeongjo` 는 `<article className="nanum_myeongjo_…__variable …">` 에서 정의됨 → **블로그 제목 서체 유지 확인**

### 6.4 `inlineCss: true` → `false`

요구사항 §13에 따라 **감사보고서를 근거로 바로 끄지 않고**, 실제 빌드 산출물을 양쪽으로 만들어 비교한 뒤 결정했다. 결과는 §10.2.

---

## 7. 실제 변경 파일

| 파일 | 변경 내용 | 이유 |
|---|---|---|
| `app/layout.tsx` | `next/font/local` + `next/font/google` 선언 6개(59줄) 삭제. `<head>` 에 `<link rel="stylesheet" href="/fonts/pretendard-1.3.9/…css">` 추가. `<html>` 의 폰트 변수 className 제거. `<body>` 를 `pretendard.className` → `font-sans` 로 | RC-1·RC-2·F-1·F-2·F-4 제거. 루트 레이아웃이 회귀의 단일 진원지였다 |
| `public/fonts/PretendardVariable.woff2` | **삭제** (2,057,688 B) | `unicode-range` 없는 통짜 폰트. 존재하는 한 preload 회귀가 재발할 수 있다 |
| `public/fonts/pretendard-1.3.9/` | **신규 93개** — `pretendard-variable-dynamic-subset.css`(54,380 B) + `woff2/PretendardVariable.subset.0~91.woff2`(92개, 2,957,724 B) | Pretendard 공식 v1.3.9 배포본. URL만 `./woff2/` 상대경로로 재작성. 92조각 전부 존재·woff2 시그니처 검증 완료 |
| `tailwind.config.js` | `fontFamily.sans` 를 `var(--font-pretendard)` → `'"Pretendard Variable"', 'Pretendard'` | next/font 변수가 없어졌으므로 실제 패밀리명으로 교체. 전역 Pretendard 유지 |
| `app/globals.css` | `.blog-detail-article` / `.blog-content` 의 `var(--font-pretendard)` → `'Pretendard Variable', 'Pretendard'` (2줄) | 위와 동일 |
| `app/blog/[id]/page.tsx` | `Nanum_Myeongjo` 선언을 이 파일로 이동, `<article>` 에 `nanumMyeongjo.variable` 적용 | 92 KB 폰트 CSS를 유일한 사용 라우트로 국소화 |
| `next.config.ts` | `experimental.inlineCss: true` → `false` | F-1(RSC 2중 직렬화)·F-2(외부 stylesheet 0개) 제거 |
| `scripts/check-font-regression.mjs` | **신규** — 회귀 가드 5종 | §18 회귀 방지 |
| `package.json` | `prebuild` 스크립트 추가, version `5.20.0` → `5.24.0` | 가드를 빌드에 연결 |
| `lib/changelog.ts` | v5.24.0 항목 추가 (한국어) | CLAUDE.md §8 규약 |
| `lib/fonts.ts` | 주석 갱신 (Gowun Dodum·Nanum Myeongjo가 layout.tsx에 전역 로드된다는 설명이 사실과 달라짐) | 이 커밋이 만든 사실 불일치 해소. 코드 영향 없음(주석 전용 파일) |
| `CLAUDE.md` | §2 Fonts / CSS Inlining 규칙 갱신 | **기존 문서가 회귀를 지시하고 있었다** — "ONLY use `next/font/google` for global fonts (Noto Sans KR, Noto Serif KR)", "`inlineCss: true` 여야 한다". 고치지 않으면 다음 작업자가 같은 회귀를 재도입한다 |

**총 diff**: 소스 7파일 + 문서 3파일 + 가드 1파일, `+64 / -67` 줄 (에셋 제외).

---

## 8. 하지 않은 변경 (범위 밖)

요구사항 §4·§25·§26에 따라 **발견했더라도 손대지 않았다.**

| 항목 | 감사 근거 | 상태 | 이관 |
|---|---|---|---|
| Hero 이미지 `unoptimized` (`app/page.tsx:128`) | 175,424 B vs AVIF 28,486 B | **그대로 둠** | Phase 2 |
| Hero preload 태그 2개 중복 + 무효 `imageSizes` (F-3) | Lighthouse 경고 | **그대로 둠** | Phase 2 |
| 홈 `/` Dynamic 렌더링 / `X-Vercel-Cache: MISS` (RC-3) | TTFB 0.42~2.59 s | **그대로 둠** | Phase 3 |
| middleware가 공개 홈에서 인증 조회 (F-5) | TTFB 기여 | **그대로 둠** | Phase 3 |
| 모바일 미표시 `<aside>` 용 gallery 쿼리 (F-6) | ≈1.5 KB + 왕복 1회 | **그대로 둠** | Phase 3 |
| `public/` 대용량 원본 이미지 (F-7) | 런타임 무해 | **그대로 둠** | — |
| Supabase 쿼리 / DB / RLS / CMS / 관리자 기능 / API / analytics | 감사에서 "이미 최적" | **그대로 둠** | — |
| JS 번들 / 일반 CSS 리팩터링 / 디자인 | 범위 밖 | **그대로 둠** | — |

### Phase 1에서 새로 발견했으나 처리하지 않은 것

| # | 발견 | 등급 | 사유 |
|---|---|---|---|
| N-1 | `npm run lint` 가 동작하지 않는다. Next.js 16이 `next lint` 를 제거해 `Invalid project directory provided, no such directory: …\lint` 로 실패한다. 추가로 ESLint 10이 설치돼 있으나 설정은 레거시 `.eslintrc.json` 이라 `npx eslint` 도 실행 불가 | 🟡 MEDIUM | **작업 전부터 존재하던 고장**이며 폰트와 무관. 고치면 §14(무관한 변경 금지) 위반 |
| N-2 | 에디터가 저장한 본문의 인라인 `font-family: Pretendard` 는 공개 블로그에서 해석되지 않는다(패밀리명이 `Pretendard Variable`) | 🟢 LOW | **수정 전에도 동일**했다(next/font가 해시 패밀리명 `__pretendard_…` 을 만들었으므로). 회귀 아님. 오히려 `'Pretendard'` 를 폴백 목록에 넣어 두어 향후 별칭 추가가 쉬워졌다 |

---

## 9. 테스트

`package.json` 에 존재하는 스크립트만 실행했다 (`dev` / `build` / `start` / `lint`, 그리고 이번에 추가한 `prebuild`).

| 검증 | 명령 | 결과 |
|---|---|---|
| 타입 검사 | `npx tsc --noEmit` | ✅ **PASS** (출력 없음) |
| Production 빌드 | `npm run build` | ✅ **PASS** (§10) |
| 회귀 가드 (정상 케이스) | `node scripts/check-font-regression.mjs` | ✅ **PASS** — `✓ 폰트 전달 구조 정상` |
| 회귀 가드 (음성 테스트) | `inlineCss: true` 로 되돌린 뒤 실행 | ✅ **exit 1 로 정확히 차단**. 이후 원복 확인 |
| ESLint | `npm run lint` | ⚠️ **BLOCKED (기존 고장)** — N-1 참조. 내 변경과 무관하게 실패 |
| 브라우저 시각 검증 | Chrome 확장 | ❌ **NOT VERIFIED** — `Browser extension is not connected` (감사 때와 동일한 환경 제약). §15에 대체 검증 기재 |

### 추가한 회귀 테스트 (§18)

`scripts/check-font-regression.mjs` — `prebuild` 에 연결되어 **로컬·Vercel 빌드 양쪽에서 자동 실행**되고, 위반 시 빌드를 중단한다.

| # | 차단 대상 | 대응 회귀 |
|---|---|---|
| 1 | `public/fonts/PretendardVariable.woff2` 재등장 | RC-1 (`4621b6b`) |
| 2 | `app/layout.tsx` 의 `next/font/local` import | RC-1 |
| 3 | `app/layout.tsx` 의 `next/font/google` import | RC-2 / F-4 |
| 4 | `next.config.ts` 의 `inlineCss: true` | F-1 / F-2 |
| 5 | dynamic subset 에셋 무결성 (CSS 92참조 + woff2 92개 + layout 링크) | 폰트 유실로 인한 무성(無聲) 장애 |

주석 처리된 코드는 오탐하지 않도록 검사 전에 주석을 제거한다. Jest/Vitest 등 테스트 프레임워크는 저장소에 존재하지 않아 도입하지 않았다(§18의 "억지 테스트 금지").

---

## 10. Production Build

### 10.1 빌드 결과

```
✓ 폰트 전달 구조 정상 (통짜 폰트 없음 / 루트 @font-face 0개 / inlineCss off / subset 92개 정상)
✓ Compiled successfully in 14.2s
✓ Generating static pages using 15 workers (126/126) in 3.1s
```

**라우트 렌더링 모드는 수정 전과 완전히 동일하다** (`MEASURED`) — 의도한 대로 렌더링 전략을 건드리지 않았다는 증거다.

```
ƒ /                          ← 여전히 Dynamic (Phase 3 대상, 의도적으로 유지)
○ /intro  ○ /classes  ○ /contact  ○ /activities  ○ /Song-Ri-Gyel  …
○ /blog                1m   1y
● /blog/[id]           1m   1y   (+71 paths)
ƒ /admin/*  ƒ /api/*  ƒ /notices/[slug]  ƒ /sitemap.xml
ƒ Proxy (Middleware)
```

- 공개 라우트 구조: 정상
- 관리자 라우트 구조: 정상
- 빌드 경고: 폰트/CSS 관련 신규 경고 없음
- DB migration: **없음** (이번 작업에 DB 변경 자체가 존재하지 않는다)

### 10.2 `inlineCss` 판단 근거 (`MEASURED`) — 요구사항 §13

동일 커밋에서 `inlineCss` 만 바꿔 두 번 빌드하고 산출물을 직접 비교했다.

| 산출물 | `inlineCss: true` | `inlineCss: false` |
|---|---:|---:|
| `/intro` 문서 (raw) | 162,451 B | **28,216 B** |
| `/intro` 문서 (brotli) | 15,217 B | **5,175 B** |
| `/blog/[id]` 문서 (raw) | 394,470 B | **74,261 B** |
| `/blog/[id]` 문서 (brotli) | 32,749 B | **10,994 B** |
| `/blog/[id]` HTML 내 `@font-face` | **370개** | **0개** |
| 문서 내 `<style>` 블록 | 66,766 B | **0 B** |
| 외부 stylesheet | 1개 (Pretendard만) | **2~3개 (전부 immutable)** |

**콜드 1페이지 방문 전송량 비교** (brotli): `true` = 15,217 + 8,333 = 23,550 B / `false` = 5,175 + 9,273 + 8,333 = 22,781 B → **거의 동일**.

**그 이후가 갈린다**:
- `false` 는 CSS가 `immutable` 로 캐시되어 **두 번째 페이지부터 문서 5,175 B만** 전송된다.
- `true` 는 페이지마다 15,217 B를 다시 받고, **문서 파싱량이 162 KB vs 28 KB** 로 6배 차이난다(CSSOM 구축·메인스레드 비용).

→ **`false` 채택.** 콜드 비용은 동등, 재방문·페이지이동·파싱 비용은 압도적으로 유리하다.

### 10.3 빌드 산출물 폰트/CSS 대조 (`MEASURED`)

| 항목 | 수정 전 | 수정 후 |
|---|---|---|
| `PretendardVariable.woff2` 통짜 | **존재** (2,057,688 B) | **없음** |
| next/font 생성 woff2 (`.next/static/media`) | Pretendard 1 + Noto/Nanum/Gowun 다수 | **184개 (Nanum Myeongjo 전용, `/blog/[id]` 에서만 참조)** |
| 자체 호스팅 subset woff2 | 0 | **92개 / 2,957,724 B (필요한 조각만 전송됨)** |
| CSS 청크 | (인라인, 외부 0개) | 루트 66,766 B(`@font-face` **0**) + 블로그 90,732 B(`@font-face` 185) |
| 폰트 CSS 위치 | HTML `<style>` + RSC flight | **외부 파일, `Cache-Control: public, max-age=31536000, immutable`** |

### 10.4 로컬 production 서버 검증 (`npm run start`, `MEASURED`)

```
$ curl -sI http://localhost:3000/ | grep -i ^link
link: </_next/static/chunks/5d89a06cf5a54f50.css>; rel=preload; as="style"
      ← 폰트 preload 0개. 2 MB Pretendard preload 완전 소멸

$ curl -s http://localhost:3000/ | grep -c '@font-face'      →  0
$ curl -s http://localhost:3000/ | wc -c                     →  52,005   (기준선 1,593,123)

$ curl -sI .../fonts/pretendard-1.3.9/pretendard-variable-dynamic-subset.css
Cache-Control: public, max-age=31536000, immutable      ← next.config headers 규칙 적용 확인
Content-Type: text/css; charset=UTF-8      Content-Length: 54380

$ curl -sI .../fonts/pretendard-1.3.9/woff2/PretendardVariable.subset.50.woff2
Cache-Control: public, max-age=31536000, immutable
Content-Type: font/woff2                   Content-Length: 33228
```

### 10.5 페이지별 실제 폰트 전송량 (`MEASURED`)

로컬 production 서버가 실제로 내려준 HTML의 문자 집합을 92개 `unicode-range` 와 대조해 **실제로 요청되는 조각만** 합산했다.

| 라우트 | 고유 문자 수 | 필요 조각 | Pretendard 전송량 | 기준선 대비 |
|---|---:|---:|---:|---:|
| `/` | 285 | 16 / 92 | **430,632 B** | **−79.1%** |
| `/classes` | 208 | 9 / 92 | **233,292 B** | **−88.7%** |
| `/blog/[id]` | 347 | 17 / 92 | **449,780 B** | **−78.1%** |

기준선은 라우트와 무관하게 항상 2,057,688 B였다(+ 미사용 Noto 2종 60,816 B).

---

## 11. Production Deployment

- **방식**: 기존 프로젝트의 검증된 배포 경로 — GitHub `origin/main` push → Vercel Git Integration 자동 Production 배포. (`.vercel/` + `vercel.json` 존재, 새 배포 방법을 만들지 않았다)
- **커밋**: `49141b0` `perf: 폰트 전달/인라인 CSS 성능 회귀 제거 (v5.24.0)`
- **push**: `b770fea..49141b0  main -> main`
- **DB migration**: 없음
- **`vercel.json` crons**: 변경 없음

배포 전 확인한 항목: 현재 branch(`main`), HEAD, 전체 diff, 타입검사·빌드·가드 결과 — 전부 §19 PASS Gate 통과 후 배포했다.

### 배포 검증 (`MEASURED`)

```
$ curl -s https://gimpogugak.com/ | grep -c "pretendard-1.3.9"   →  배포 반영 확인
$ curl -sI https://gimpogugak.com/ | grep -i ^link
Link: </_next/static/chunks/5d89a06cf5a54f50.css>; rel=preload; as="style"
      ← as="font" preload 0개
```

**공개/관리자 라우트 전수 확인** (`MEASURED`)

| 라우트 | HTTP | 비고 |
|---|---|---|
| `/` `/intro` `/classes` `/activities` `/contact` `/blog` `/gallery` `/notices` `/login` `/Song-Ri-Gyel` | **200** | 정상 |
| `/admin` | 307 → `/admin/login?next=%2Fadmin` | 인증 리다이렉트 (기존 동작) |
| `/intro/director` | 307 → `/director` | 정규화 리다이렉트 (기존 동작) |

두 307은 폰트 변경과 무관한 기존 라우팅 동작이다.

---

## 12. 수정 전후 Network Comparison

### 12.1 요구사항 §22 지정 표 (`MEASURED`, Production)

| 지표 | 수정 전 | 수정 후 | 변화 |
|---|---:|---:|---:|
| 전체 초기 Transfer | 2,639,972 B (2.64 MB) | **847,616 B (0.85 MB)** | **−1,792,356 B (−67.9%)** |
| 전체 Resource Size | 4,690,142 B (4.69 MB) | **1,469,699 B (1.47 MB)** | **−3,220,443 B (−68.7%)** |
| Font Transfer | 2,118,504 B | **430,632 B** | **−1,687,872 B (−79.7%)** |
| Font 비율 | 80.2% | **50.8%** | −29.4%p |
| PretendardVariable 전체 파일 | 2,057,688 B (preload) | **0 B — HTTP 404** | **−2,057,688 B (−100%)** |
| HTML Resource Size | 1,593,123 B | **52,005 B** | **−1,541,118 B (−96.7%)** |
| HTML Transfer Size | 100,046 B (br) | **11,998 B (br)** | **−88,048 B (−88.0%)** |
| `@font-face` 개수 (HTML 내) | 2,428 (=1,214 × 2) | **0** | **−100%** |
| 폰트 inline CSS | 699,922 B (`<style>` 내) | **0 B** | **−100%** |
| RSC font CSS 중복 | 1,214개 대응 (~702,000 B) | **0개 / 0 B** | **−100%** |
| 총 Request 수 (초기) | 18 | **32** | +14 (§12.3 해설) |

### 12.2 라우트별 문서 크기 (`MEASURED`)

| 라우트 | 전 identity | 후 identity | 변화 | 전 brotli | 후 brotli | 변화 |
|---|---:|---:|---:|---:|---:|---:|
| `/` | 1,593,123 | **52,005** | **−96.7%** | 100,046 | **11,998** | **−88.0%** |
| `/intro` | 1,569,762 | **28,216** | **−98.2%** | 93,989 | **6,610** | **−93.0%** |
| `/classes` | 1,586,985 | **45,441** | **−97.1%** | 97,740 | **9,408** | **−90.4%** |
| `/contact` | 1,573,498 | **31,955** | **−98.0%** | 95,486 | **7,877** | **−91.7%** |
| `/blog` | 1,604,479 | **62,964** | **−96.1%** | 104,018 | **16,154** | **−84.5%** |
| `/activities` | 1,960,743 | **419,200** | **−78.6%** | 120,278 | **20,155** | **−83.2%** |
| `/blog/[id]` (예시글) | ~1,600,000 (추정) | **74,304** | — | — | **14,300** | — |

> 감사가 지적한 **"콘텐츠가 거의 없는 `/intro` 조차 1.57 MB"** 라는 폰트 CSS 바닥값이 사라졌다. 이제 문서 크기가 실제 콘텐츠량에 비례한다(`/intro` 28 KB < `/classes` 45 KB < `/blog` 63 KB < `/activities` 419 KB).

### 12.3 홈 `/` 초기 로드 구성 (`MEASURED`)

| Type | Requests | Transfer (br) | 비중 | 수정 전 Transfer | 수정 전 비중 |
|---|---:|---:|---:|---:|---:|
| Document/HTML | 1 | **11,998** | 1.4% | 99,713~100,046 | 3.8% |
| CSS (외부, immutable) | 2 | **24,538** | 2.9% | 0 (인라인) | 0% |
| JS | 12 | **205,024** | 24.2% | 246,331 | 9.3% |
| **Fonts** | 16 | **430,632** | **50.8%** | 2,118,504 | **80.2%** |
| Images (히어로) | 1 | **175,424** | 20.7% | 175,424 | 6.6% |
| **TOTAL** | **32** | **847,616** | | **2,639,972** | |

**Request 수가 18 → 32로 늘어난 이유** — 이것은 의도된 트레이드다.
- 폰트: 3 → 16 (통짜 1개 대신 필요한 조각만). **바이트는 −79.7%**
- CSS: 0 → 2 (인라인 대신 외부 캐시 가능 파일). **문서 −96.7%**
- JS: 13 → 12

HTTP/2 다중화 환경에서 **같은 origin의 소형 요청 14개 추가 비용 < 1.69 MB 절감 이익**이며, 폰트 조각은 `font-display: swap` 하에 렌더 차단이 아니고 CSS는 `immutable` 로 1회만 받는다.

### 12.4 TTFB (`MEASURED`)

| 라우트 | 수정 전 | 수정 후 | Vercel-Cache |
|---|---:|---:|---|
| `/` | 0.420~2.588 s | **0.310~0.321 s** | MISS (변화 없음 — Phase 3) |
| `/intro` | 0.234 s | 0.226 s | HIT |
| `/classes` | 0.252 s | 0.221 s | HIT |
| `/blog` | 0.245 s | 0.204 s | HIT |

홈은 여전히 `X-Vercel-Cache: MISS` / `Cache-Control: private, no-cache, no-store` 다 — **RC-3은 Phase 3 범위이므로 의도적으로 남겨두었다.** 다만 SSR이 1.5 MB를 직렬화하지 않게 되면서 TTFB 자체는 개선됐다.

---

## 13. Font Delivery Comparison

| 항목 | 수정 전 | 수정 후 |
|---|---|---|
| 전달 방식 | `next/font/local` + 통짜 woff2 1개 | 자체 호스팅 dynamic subset 92조각 |
| 패밀리 | `__pretendard_…` (해시명) | `'Pretendard Variable'` |
| weight 축 | variable 100–900 | variable **45–920** (동일 파일 계열) |
| `unicode-range` | **없음** | **있음 (92분할)** |
| `font-display` | `swap` | `swap` (동일) |
| 초기 preload | **`Link: rel=preload as=font` 3건 / 2,118,504 B** | **0건** |
| 홈 실제 폰트 전송 | 2,118,504 B (항상 고정) | **430,632 B** (16/92 조각, 페이지별 가변) |
| `/classes` 폰트 전송 | 2,118,504 B | **233,292 B** (9/92 조각) |
| 미사용 폰트 preload | Noto Serif KR 34,732 + Noto Sans KR 26,084 = **60,816 B** | **0 B** |
| 폰트 파일 캐시 | `immutable` | `immutable` (`public, max-age=31536000`) |
| 서드파티 의존 | 없음 | **없음 (유지)** |
| 폰트 CSS 위치 | HTML `<style>` + RSC flight (2중) | **외부 파일 54,380 B / br 12,940 B, immutable** |

**구 폰트 파일 소멸 확인** (`MEASURED`)
```
$ curl -o /dev/null -w "%{http_code} %{size_download}" \
    https://gimpogugak.com/_next/static/media/PretendardVariable-s.p.77d5d991.woff2
404 9
```

**폰트 조각 응답 확인** (`MEASURED`)
```
HTTP/1.1 200 OK
Cache-Control: public, max-age=31536000, immutable
Content-Type: font/woff2
Content-Length: 35424
```

---

## 14. HTML / RSC Comparison

| 항목 | 수정 전 | 수정 후 |
|---|---:|---:|
| 홈 문서 Resource Size | 1,593,123 B | **52,005 B** |
| `<style>` 인라인 CSS | 767,984 B (그중 `@font-face` 699,922 B) | **0 B** |
| RSC flight payload | 799,659 B (대부분 폰트 CSS 중복) | **CSS 텍스트 미포함 — stylesheet URL만 참조** |
| HTML 내 `@font-face` 총 출현 | **2,428개** | **0개** |
| `<link rel="stylesheet">` | **0개** | **2개** (`/_next/static/chunks/…css`, `/fonts/pretendard-1.3.9/…css`) |
| 문서 중 폰트 CSS 비중 | **88.0%** | **0%** |
| 블로그 상세 문서 | ~1.6 MB, `@font-face` 다수 | **74,304 B, `@font-face` 0개**, stylesheet 3개 |

**F-1(RSC 2중 직렬화) 해소 근거**: 인라인 CSS가 flight에 재직렬화되던 것은 `inlineCss:true` 때문이었다. `false` 로 바꾸면 flight에는 stylesheet **URL**만 실린다. 원문 HTML 전체(= `<style>` + flight + DOM)에서 `@font-face` 출현이 **2,428 → 0** 이라는 사실이 두 경로 모두에서 사라졌음을 단일 지표로 증명한다.

**F-2(외부 stylesheet 0개) 해소 근거**: 모든 CSS가 `public, max-age=31536000, immutable` 외부 자산이 되었다. 두 번째 페이지부터는 CSS 재전송이 0이고 문서만 6~16 KB 받는다.

---

## 15. Visual / Functional Regression

### 15.1 브라우저 시각 검증 — ❌ `NOT VERIFIED`

Chrome 확장이 연결되지 않아(`Browser extension is not connected`) 요구사항 §24의 실제 렌더링 확인은 **수행하지 못했다.** 감사 때와 동일한 환경 제약이다. 아래는 그 대체 검증이며, **"픽셀을 눈으로 확인했다"는 주장이 아니다.**

### 15.2 대체 검증 — CSS 캐스케이드 실측 (`MEASURED`, 빌드 산출물·Production HTML)

| 확인 항목 | 근거 | 결과 |
|---|---|---|
| 사이트 전역 본문 폰트 | 루트 CSS 청크에서 `html,:host{…font-family:Pretendard Variable,Pretendard,system-ui,sans-serif}` 확인 | ✅ Pretendard 유지 |
| `font-sans` 유틸리티 | `.font-sans{font-family:Pretendard Variable,Pretendard,system-ui,sans-serif}` | ✅ |
| `<body>` 클래스 | Production HTML에 `class="font-sans min-h-screen …"` | ✅ |
| 사용 weight 400/500/600/700 | dynamic subset `font-weight: 45 920` 이 전 구간 포함 | ✅ 전부 커버 |
| 블로그 본문 서체 | `.blog-content{font-family:'Pretendard Variable','Pretendard',…}` | ✅ |
| 블로그 h1~h3 서체 | `.blog-content h1{font-family:"Nanum Myeongjo",var(--font-nanum-myeongjo),…}` + `<article class="nanum_myeongjo_…__variable …">` 가 `--font-nanum-myeongjo:"Nanum Myeongjo","Nanum Myeongjo Fallback"` 정의 | ✅ 유지 |
| `app/page.tsx:91` `font-serif` (h1) | `tailwind.config.js` 에 `serif` 확장 없음 → 수정 전에도 Georgia 폴백 | ✅ **변화 없음** |
| 한글/영문/숫자 표시 | Production HTML에 한글 콘텐츠 정상 직렬화 확인 | ✅ |
| TinyMCE 에디터 폰트 UI | `content_css`(jsDelivr + Google Fonts)로 iframe에 별도 주입 — layout.tsx와 무관 | ✅ 영향 없음 |
| 공개 라우트 10종 | 전부 HTTP 200 | ✅ |
| 관리자 라우트 | `/admin` → `/admin/login` 정상 리다이렉트 | ✅ |

### 15.3 폰트 fallback / CLS 검토 (요구사항 §12)

| 항목 | 판단 | 근거 |
|---|---|---|
| FOIT | 없음 | `font-display: swap` 유지 (dynamic subset CSS에 내장) |
| FOUT | **개선** | 수정 전에는 2 MB **전량 도착**까지 스왑이 안 됐다. 이제 조각(평균 ~27 KB)이 개별 도착하는 즉시 해당 글자가 스왑된다 |
| fallback metrics | ⚠️ **약화** | `next/font/local` 이 자동 생성하던 `pretendard Fallback`(size-adjust) @font-face가 사라졌다. 폴백은 `system-ui` → 브라우저 한글 대체(Apple SD Gothic Neo / Malgun Gothic 등) |
| CLS 실측 | ❌ `NOT VERIFIED` | 브라우저 미연결 |
| CLS 위험 평가 | **낮음~중간** (`INFERRED`) | ① Pretendard는 Apple SD Gothic Neo 계열 메트릭에 맞춰 설계된 폰트라 폴백과의 편차가 작다 ② 감사(§6)가 확인한 CLS 억제 요소(히어로 `width/height`+`placeholder=blur`, 뱃지 `min-h-[52px]`)는 그대로다 ③ 스왑 대기 시간이 극적으로 짧아져 노출 창 자체가 줄었다 |

**정직하게 남기는 한계**: 폰트 메트릭 폴백이 약해진 것은 사실이며, 실제 CLS 수치는 측정하지 못했다. §16에 잔여 위험으로 기록한다.

### 15.4 PageSpeed / Lighthouse — ❌ `NOT VERIFIED`

```
$ curl "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=…&strategy=mobile"
HTTP 429   (일일 쿼터 소진 — 감사 때와 동일)
```

요구사항 §27에 따라 이것으로 Phase 1을 FAIL 처리하지 않는다. 판정 근거는 §12~14의 실측 network/resource 수치다.

---

## 16. 남은 위험

| # | 위험 | 등급 | 완화 / 관측 방법 |
|---|---|---|---|
| R-1 | **폰트 fallback metrics 약화** — next/font의 자동 size-adjust 폴백이 사라져 스왑 시 미세한 레이아웃 이동 가능 | 🟡 MEDIUM | 브라우저 연결 후 CLS 실측 권장. 문제가 확인되면 `globals.css` 에 size-adjust 폴백 `@font-face` 1개 추가로 해소 가능(구조 변경 불필요) |
| R-2 | **요청 수 18 → 32** — 폰트 조각 16개 + CSS 2개. HTTP/2 미지원 환경이나 고지연 네트워크에서 이론상 불리 | 🟢 LOW | Vercel은 HTTP/2·HTTP/3 제공. 전부 same-origin·`immutable`. 바이트 절감(−1.69 MB)이 압도적 |
| R-3 | **저장소/배포 크기 +0.9 MB** (woff2 92개 2,957,724 B 추가 − 통짜 2,057,688 B 삭제) | 🟢 LOW | 미사용 조각은 절대 전송되지 않는다. Vercel 배포 한도와 무관한 수준 |
| R-4 | **`prebuild` 가드가 빌드를 중단시킬 수 있다** — 오탐 시 Vercel 배포 실패 | 🟢 LOW | 검사 5종 모두 정확한 문자열/파일 존재 기반이며 주석은 제외 처리. 정상·음성 양방향 테스트 완료(§9) |
| R-5 | **희귀 문자 조각 누락 없음 확인** — dynamic subset은 92조각이 원본 전체 커버리지를 분할한 것이라 글자 깨짐이 없어야 한다 | 🟢 LOW | 92조각 전부 존재·woff2 시그니처 검증, CSS 참조 92/92 일치 확인. 가드 #5가 상시 검사 |
| R-6 | **`/` 는 여전히 Dynamic / CDN MISS** | 🟠 HIGH (미해결) | **Phase 3 범위 — 의도적으로 남김.** Phase 1의 판정 대상이 아니다 |
| R-7 | **히어로 이미지 175,424 B** 가 이제 전송량의 20.7%로 상대 비중 상승 | 🟠 HIGH (미해결) | **Phase 2 범위 — 의도적으로 남김** |
| R-8 | `npm run lint` 기존 고장(N-1) | 🟡 MEDIUM | 작업 전부터 존재. 정적 검증은 `tsc --noEmit` + `next build` 내장 타입검사로 대체 |

---

## 17. 후속 Phase

### Phase 2 — Hero / LCP (이번에 의도적으로 제외)

| 항목 | 근거 | 예상 효과 |
|---|---|---|
| `app/page.tsx:128` `unoptimized` 제거 | `MEASURED` 175,424 B vs `/_next/image` AVIF 28,486 B | LCP 리소스 −83.8%, `sizes`/srcset이 비로소 동작 |
| Hero preload 태그 2개 중복 정리 (F-3) | `app/page.tsx:67` 수동 `<link>` + `:124` `priority` 자동생성 | Lighthouse `unused preload` 경고 해소 |
| `imageSizes` 무효 속성 | `imagesrcset` 없이는 명세상 무시됨 | 정확성 |

> **Phase 1 이후 Hero의 상대 비중이 커졌다.** 폰트가 줄어든 만큼 이제 히어로 이미지가 초기 전송량의 최대 항목 후보다. Phase 2의 투자 대비 효과가 이전보다 높아졌다.

### Phase 3 — Dynamic rendering / cache

| 항목 | 근거 | 주의 |
|---|---|---|
| 홈 `/` 정적화 (RC-3) | `ƒ /`, `X-Vercel-Cache: MISS` 100%, `Cache-Control: private, no-cache, no-store` | ⚠️ **가장 위험**. `app/page.tsx:58` `.lte("published_at", new Date())` 가 예약 발행과 얽혀 있고 `3ee6d03`·`0c172be` 에서 두 번 터진 이력. `revalidate = 60` 유지 필수, Hobby 크론 1일 1회 제약 고려 |
| middleware 공개 라우트 우회 (F-5) | `/` 는 `publicRoutes` 인데 매 요청 `auth.getUser()` | 인증 로직이라 회귀 위험 MEDIUM |
| 모바일 미표시 `<aside>` gallery 쿼리 (F-6) | `hidden lg:flex` | LOW |

### 그 외 (선택)

- N-1: `npm run lint` 복구 (Next 16 `next lint` 제거 대응 + ESLint 10 flat config 마이그레이션)
- 폰트 추가 절감: Pretendard 조각은 코드포인트 순 분할이라 빈도 기반이 아니다. 상용 빈도 기반 커스텀 서브셋을 만들면 430 KB를 더 줄일 여지가 있으나, 커스텀 파이프라인 도입 비용과 희귀 글자 누락 위험을 저울질해야 한다.

---

## 18. Repository Integrity

### 최종 `git status`

```
$ git status --porcelain
?? reports/          ← 감사보고서 + 본 보고서 (작업 시작 시점부터 untracked)
```

작업 종료 시점 working tree에 **의도하지 않은 변경은 0건**이다.

### 기준선 대비 전체 diff (`b770fea` → `49141b0`)

```
 CLAUDE.md                             |  24 ++++--     문서 규칙 갱신(회귀 재도입 방지)
 app/blog/[id]/page.tsx                |  14 ++++      Nanum Myeongjo 라우트 국소화
 app/globals.css                       |   4 +-        패밀리명 교체 2줄
 app/layout.tsx                        |  69 +++-----   폰트 선언 6개 제거 + subset stylesheet
 lib/changelog.ts                      |  11 ++++      v5.24.0 기록 (CLAUDE.md §8 규약)
 lib/fonts.ts                          |  10 ++-       주석 갱신(사실 불일치 해소)
 next.config.ts                        |   6 +-        inlineCss false
 package.json                          |   3 +-        prebuild 가드 + version 5.24.0
 public/fonts/PretendardVariable.woff2 | Bin 2057688 -> 0    통짜 폰트 삭제
 scripts/check-font-regression.mjs     | 105 +++++++   회귀 가드 신규
 tailwind.config.js                    |   3 +-        패밀리명 교체
 11 files changed, 181 insertions(+), 68 deletions(-)
 + public/fonts/pretendard-1.3.9/  (93개 신규 에셋: CSS 1 + woff2 92)
```

**모든 변경이 폰트 전달 또는 인라인 CSS와 직접 연결된다.** 변수명 정리·컴포넌트 리팩터링·import 순서·무관한 Tailwind/레이아웃 변경은 포함하지 않았다(요구사항 §14).

### 기존 사용자 변경사항 보존

- 작업 시작 시점 tracked 변경: **0건** → 훼손할 대상 자체가 없었다.
- untracked `reports/`(선행 감사보고서): **읽기만 하고 수정·삭제하지 않았다.**
- 작업 중 하네스가 자동 수정한 `.claude/settings.local.json`(일회성 명령 권한 캐시)은 코드와 무관하므로 커밋 전 원복했다.
- 전체 revert / 과거 커밋 checkout: **하지 않았다** (요구사항 §5).
- DB migration: **없음**.

---

## 19. Final Verdict

# ✅ CONDITIONAL PASS

### 요구사항 §28 PASS 조건 대조

| # | 조건 | 결과 | 근거 |
|---|---|---|---|
| 1 | 전체 2 MB PretendardVariable 강제 preload 제거 | ✅ | `Link:` 헤더 폰트 preload **3 → 0건**. 구 파일 **HTTP 404** |
| 2 | 과도한 font-face / inline CSS 구조 실질적 제거 | ✅ | HTML 내 `@font-face` **2,428 → 0**, 인라인 폰트 CSS **699,922 B → 0 B** |
| 3 | RSC 중복 payload 제거 또는 극적 감소 | ✅ | flight 내 폰트 CSS **~702,000 B → 0 B** (`inlineCss:false`) |
| 4 | production build PASS | ✅ | `✓ Compiled successfully`, 126개 정적 페이지 생성, 라우트 모드 불변 |
| 5 | 기존 주요 기능 회귀 없음 | ✅ | 공개 10 라우트 HTTP 200, 관리자 리다이렉트 정상, 라우트 렌더링 모드 동일 |
| 6 | Production 실제 배포 정상 | ✅ | `b770fea..49141b0` push → Vercel 자동 배포 반영 확인 |
| 7 | Production에서 네트워크 감소 실측 확인 | ✅ | 초기 전송 **2,639,972 → 847,616 B (−67.9%)** |
| 8 | Pretendard typography 유지 | ✅ | 전역 `Pretendard Variable` 적용 확인, weight 400–700 전 구간 커버, 블로그 h1~h3 Nanum Myeongjo 유지 |

**8개 핵심 조건 전부 충족.**

### 그럼에도 `PASS` 가 아니라 `CONDITIONAL PASS` 인 이유

요구사항 §28의 CONDITIONAL PASS 정의 — *"핵심 수정은 성공했으나 브라우저 visual 또는 Lighthouse 등 일부 비핵심 검증만 환경 제약으로 미확인"* — 에 정확히 해당한다.

| 미확인 항목 | 사유 | 영향 |
|---|---|---|
| 브라우저 실제 렌더링 / 시각 회귀 (§24) | Chrome 확장 미연결 | CSS 캐스케이드를 빌드 산출물·Production HTML에서 실측 대조했으나(§15.2), **픽셀 확인은 아니다** |
| CLS 실측 | 위와 동일 | fallback metrics가 약화된 것은 사실 → R-1 |
| Lighthouse / PageSpeed 점수 | PSI API **HTTP 429** (쿼터 소진) | §27에 따라 자동 FAIL 아님 |

### 권장 후속 조치

1. **브라우저에서 `/`, `/blog/[id]`, `/admin` 을 모바일 폭으로 직접 확인** — 특히 스왑 구간의 레이아웃 이동(R-1).
2. PSI 쿼터 회복 후 모바일 점수 재측정 (수정 전 점수가 없으므로 절대 비교는 불가, 참고값).
3. Phase 2(Hero/LCP) 착수 — 폰트가 빠진 지금 히어로가 전송량 20.7%로 최대 단일 개선 여지다.

---

## 부록 — 요구사항 §23 직답

**Q1. Production 최초 요청에서 `PretendardVariable.woff2` 약 2 MB 전체 파일이 여전히 다운로드되는가?**
→ **No.** 파일 자체가 소멸했다(`HTTP 404`). 대신 해당 페이지가 실제로 쓰는 조각만 받는다.

**Q2. HTTP `Link` 헤더 또는 HTML preload에 해당 전체 font가 남아 있는가?**
→ **No.** `Link:` 헤더의 `as="font"` preload는 **0건**이다. 남은 preload는 CSS 1건(`as="style"`)뿐이다.

**Q3. HTML 내부 `@font-face` 개수는 몇 개인가?**
→ **0개.** (수정 전 2,428개 = `<style>` 1,214 + RSC flight 1,214). 블로그 상세 페이지 포함 전 라우트에서 0개다. 폰트 CSS는 전부 외부 immutable 파일로 이동했다.

**Q4. Font CSS가 RSC payload에도 반복 직렬화되는가?**
→ **No.** `inlineCss: false` 로 flight에는 stylesheet URL만 실린다. 원문 HTML 전체의 `@font-face` 출현이 0이라는 사실이 `<style>`·flight 양쪽 소멸을 함께 증명한다.

**Q5. 초기 Font Transfer Size는 몇 byte인가?**
→ **430,632 B** (홈 `/`, 16/92 조각). 수정 전 2,118,504 B → **−1,687,872 B (−79.7%)**. `/classes` 는 233,292 B(9조각)로 페이지별로 더 줄어든다.

**Q6. 전체 initial Transfer Size는 몇 byte인가?**
→ **847,616 B.** 수정 전 2,639,972 B → **−1,792,356 B (−67.9%)**.
내역: Font 430,632 / JS 205,024 / Image 175,424 / CSS 24,538 / HTML 11,998.
