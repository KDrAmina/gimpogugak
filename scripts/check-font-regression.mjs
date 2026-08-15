/**
 * 폰트 전달 성능 회귀 가드 (Phase 1, 2026-08-15)
 *
 * 2026-03-30 커밋 3개(0bf8b63 / 64ec14e / 4621b6b)로 들어온 회귀를 되돌린 뒤,
 * 같은 회귀가 다시 들어오는 것을 빌드 단계에서 막는다.
 * package.json의 `prebuild`에 연결되어 있으므로 로컬·Vercel 빌드 모두에서 실행된다.
 *
 * 검사 항목 (전부 실측 근거가 있는 것만):
 *   1. 통짜 PretendardVariable.woff2(2,057,688 B) 재도입 금지
 *   2. next/font/local 로 통짜 Pretendard 를 다시 선언하는 것 금지
 *   3. 루트 레이아웃(app/layout.tsx)에서 next/font/google 사용 금지
 *      → 한글 웹폰트 1종당 @font-face 92~372개가 전 라우트 CSS에 실린다
 *   4. experimental.inlineCss: true 재도입 금지
 *      → CSS가 <style> + RSC flight 양쪽에 2중 직렬화되고 외부 stylesheet가 0개가 된다
 *   5. 자체 호스팅 Pretendard dynamic subset 에셋 무결성 (CSS + 92개 woff2)
 *
 * 참고: reports/performance/KIMPO_GUGAK_PHASE1_FONT_REMEDIATION_REPORT.md
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const errors = [];

const read = (p) => (existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : null);

// ── 1. 통짜 폰트 파일 ────────────────────────────────────────────────
const WHOLE_FONT = "public/fonts/PretendardVariable.woff2";
if (existsSync(join(root, WHOLE_FONT))) {
  errors.push(
    `${WHOLE_FONT} 가 존재한다. 이 파일은 unicode-range가 없는 2.0 MB 통짜 폰트로, ` +
      `next/font가 최고 우선순위 preload를 걸어 LCP를 지연시킨다. ` +
      `public/fonts/pretendard-1.3.9/ dynamic subset 을 사용할 것.`
  );
}

// ── 2~3. 루트 레이아웃 폰트 선언 ─────────────────────────────────────
const layout = read("app/layout.tsx");
if (layout === null) {
  errors.push("app/layout.tsx 를 찾을 수 없다.");
} else {
  const code = layout.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  if (/from\s+["']next\/font\/local["']/.test(code)) {
    errors.push(
      "app/layout.tsx 가 next/font/local 을 import 한다. " +
        "Pretendard 는 public/fonts/pretendard-1.3.9/ 의 dynamic subset stylesheet 로 제공한다."
    );
  }
  if (/from\s+["']next\/font\/google["']/.test(code)) {
    errors.push(
      "app/layout.tsx 가 next/font/google 을 import 한다. 한글 웹폰트 1종이 @font-face 92~372개를 " +
        "모든 라우트의 CSS에 싣는다. 실제 사용하는 라우트에서만 선언할 것 " +
        "(예: Nanum Myeongjo → app/blog/[id]/page.tsx)."
    );
  }
}

// ── 4. inlineCss ────────────────────────────────────────────────────
const nextConfig = read("next.config.ts");
if (nextConfig === null) {
  errors.push("next.config.ts 를 찾을 수 없다.");
} else {
  const code = nextConfig.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  if (/inlineCss\s*:\s*true/.test(code)) {
    errors.push(
      "next.config.ts 에 experimental.inlineCss: true 가 있다. 인라인 CSS는 <style> 블록과 " +
        "RSC flight payload에 2중 직렬화되고 외부 stylesheet를 0개로 만들어 페이지 이동·재방문마다 " +
        "전량 재전송된다. (실측: /intro 문서 162,451 B → 28,216 B)"
    );
  }
}

// ── 5. dynamic subset 에셋 무결성 ────────────────────────────────────
const FONT_DIR = "public/fonts/pretendard-1.3.9";
const CSS_PATH = `${FONT_DIR}/pretendard-variable-dynamic-subset.css`;
const WOFF2_DIR = `${FONT_DIR}/woff2`;
const css = read(CSS_PATH);

if (css === null) {
  errors.push(`${CSS_PATH} 가 없다. Pretendard 가 전혀 로드되지 않는다.`);
} else {
  const referenced = [...css.matchAll(/url\(\.\/woff2\/(PretendardVariable\.subset\.\d+\.woff2)\)/g)].map(
    (m) => m[1]
  );
  if (referenced.length !== 92) {
    errors.push(`${CSS_PATH} 의 subset 참조가 92개가 아니라 ${referenced.length}개다.`);
  }
  const present = new Set(existsSync(join(root, WOFF2_DIR)) ? readdirSync(join(root, WOFF2_DIR)) : []);
  const missing = referenced.filter((f) => !present.has(f));
  if (missing.length > 0) {
    errors.push(`${WOFF2_DIR} 에 woff2 ${missing.length}개 누락: ${missing.slice(0, 5).join(", ")}...`);
  }
  if (!layout?.includes("/fonts/pretendard-1.3.9/pretendard-variable-dynamic-subset.css")) {
    errors.push("app/layout.tsx 가 Pretendard dynamic subset stylesheet 를 로드하지 않는다.");
  }
}

if (errors.length > 0) {
  console.error("\n✗ 폰트 성능 회귀 감지 — 빌드를 중단한다.\n");
  errors.forEach((e, i) => console.error(`  ${i + 1}. ${e}\n`));
  console.error("  자세한 배경: reports/performance/KIMPO_GUGAK_PHASE1_FONT_REMEDIATION_REPORT.md\n");
  process.exit(1);
}

console.log("✓ 폰트 전달 구조 정상 (통짜 폰트 없음 / 루트 @font-face 0개 / inlineCss off / subset 92개 정상)");
