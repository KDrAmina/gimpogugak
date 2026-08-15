/**
 * Middleware 인증 경계 · 정적 에셋 회귀 가드 (Phase 3B-2, 2026-08-15)
 *
 * Phase 3B-2 는 공개 라우트에서 `auth.getUser()` 왕복을 건너뛰도록 middleware 에
 * "auth 게이트"(needsAuth / AUTH_ROUTE_PREFIXES)를 도입했다.
 * 이 최적화의 유일한 실패 모드는 다음 하나다:
 *
 *   보호 라우트를 새로 추가하면서 분기만 작성하고 AUTH_ROUTE_PREFIXES 에 넣지 않으면
 *   그 분기는 영원히 실행되지 않는다 → 인증 검사가 "조용히" 사라진다.
 *
 * 그래서 이 가드는 성능이 아니라 **보안 불변식**을 강제한다.
 * package.json 의 `prebuild` 에 연결되어 로컬·Vercel 빌드 모두에서 실행된다.
 *
 * 검사 항목:
 *   1. 공개 라우트 조기 종료(auth skip)가 존재하고 auth.getUser() 보다 앞선다
 *   2. middleware 가 검사하는 모든 pathname 리터럴이 auth 게이트에 포함된다
 *   3. memberRoutes 전체가 AUTH_ROUTE_PREFIXES 에 포함된다
 *   4. matcher 가 보호 라우트를 여전히 매칭한다 (인증 우회 금지)
 *   5. matcher 가 Pretendard 정적 에셋을 제외한다 (Phase 3B-2 성능 목표)
 *
 * 참고: reports/performance/KIMPO_GUGAK_PHASE3B2_MIDDLEWARE_REMEDIATION_REPORT.md
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const errors = [];
const SRC_PATH = "middleware.ts";
const full = join(root, SRC_PATH);

if (!existsSync(full)) {
  console.error(`\n✗ ${SRC_PATH} 를 찾을 수 없다. middleware 인증 경계를 검증할 수 없다.\n`);
  process.exit(1);
}

const raw = readFileSync(full, "utf8");
// 주석 안의 예시 경로가 검사에 섞이지 않도록 제거한 사본으로 코드 분석한다.
const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// ── 게이트 프리픽스 추출 ─────────────────────────────────────────────
const prefixBlock = src.match(/const\s+AUTH_ROUTE_PREFIXES\s*=\s*\[([\s\S]*?)\]/);
let authPrefixes = [];
if (!prefixBlock) {
  errors.push(
    "AUTH_ROUTE_PREFIXES 배열을 찾을 수 없다. 공개 라우트 auth skip 의 인증 경계 정의가 사라졌다."
  );
} else {
  authPrefixes = [...prefixBlock[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  if (authPrefixes.length === 0) {
    errors.push("AUTH_ROUTE_PREFIXES 가 비어 있다. 모든 보호 라우트의 인증 검사가 사라진다.");
  }
}

/** 해당 경로 리터럴이 auth 게이트를 통과해 인증 경로를 타는가 */
const isGated = (p) => p.startsWith("/api") || authPrefixes.some((prefix) => p.startsWith(prefix));

// ── 1. auth skip 조기 종료 존재 + getUser 보다 앞섬 ──────────────────
const skipIdx = src.search(/if\s*\(\s*!\s*needsAuth\s*\(\s*pathname\s*\)\s*\)/);
const getUserIdx = src.search(/auth\s*\.\s*getUser\s*\(/);
if (skipIdx === -1) {
  errors.push(
    "공개 라우트 조기 종료(`if (!needsAuth(pathname)) return NextResponse.next();`)가 없다. " +
      "Phase 3B-2 성능 수정이 되돌아갔거나 게이트 함수명이 바뀌었다."
  );
} else if (getUserIdx !== -1 && skipIdx > getUserIdx) {
  errors.push(
    "auth skip 이 auth.getUser() 보다 뒤에 있다. 공개 라우트에서 인증 왕복이 그대로 발생한다."
  );
}
if (!/function\s+needsAuth\s*\(/.test(src)) {
  errors.push("needsAuth() 게이트 함수가 없다.");
}
if (!/pathname\.startsWith\(\s*"\/api"\s*\)/.test(src)) {
  errors.push(
    "needsAuth() 가 /api 를 인증 경로에 포함하지 않는다. " +
      "API route handler 의 세션 갱신 타이밍이 바뀔 수 있다."
  );
}

// ── 2. 검사되는 모든 pathname 리터럴이 게이트에 포함되는가 ───────────
const checked = new Set();
for (const m of src.matchAll(/pathname\s*\.\s*startsWith\(\s*"([^"]+)"\s*\)/g)) checked.add(m[1]);
for (const m of src.matchAll(/pathname\s*[!=]==\s*"([^"]+)"/g)) checked.add(m[1]);

for (const p of [...checked].sort()) {
  if (!isGated(p)) {
    errors.push(
      `middleware 가 경로 "${p}" 를 검사하지만 auth 게이트(AUTH_ROUTE_PREFIXES)에 없다. ` +
        `그 분기는 절대 실행되지 않는다 — 인증 검사가 조용히 사라진 상태다. ` +
        `AUTH_ROUTE_PREFIXES 에 해당 프리픽스를 추가할 것.`
    );
  }
}

// ── 3. memberRoutes ⊆ AUTH_ROUTE_PREFIXES ───────────────────────────
const memberBlock = src.match(/const\s+memberRoutes\s*=\s*\[([\s\S]*?)\]/);
if (!memberBlock) {
  errors.push("memberRoutes 배열을 찾을 수 없다.");
} else {
  const memberRoutes = [...memberBlock[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const uncovered = memberRoutes.filter((r) => !authPrefixes.includes(r));
  if (uncovered.length > 0) {
    errors.push(
      `memberRoutes 중 ${uncovered.join(", ")} 가 AUTH_ROUTE_PREFIXES 에 없다. ` +
        `해당 회원 전용 라우트의 status 검사가 실행되지 않는다.`
    );
  }
}

// ── 4~5. matcher 검증 ───────────────────────────────────────────────
const matcherMatch = src.match(/matcher\s*:\s*\[\s*"((?:[^"\\]|\\.)*)"/);
if (!matcherMatch) {
  errors.push("config.matcher 패턴을 찾을 수 없다.");
} else {
  // 소스의 JS 문자열 리터럴 → 실제 패턴 문자열 (\\. → \.)
  const pattern = matcherMatch[1].replace(/\\\\/g, "\\");
  let re;
  try {
    re = new RegExp(`^${pattern}$`);
  } catch (e) {
    errors.push(`config.matcher 가 유효한 정규식이 아니다: ${e.message}`);
  }

  if (re) {
    // 4. 보호 라우트는 반드시 middleware 를 타야 한다 (인증 우회 금지)
    const MUST_MATCH = [
      "/admin",
      "/admin/login",
      "/admin/students",
      "/admin/students/123",
      "/admin/posts/manage/edit/1",
      "/notices",
      "/notices/some-slug",
      "/gallery",
      "/materials",
      "/my-lessons",
      "/waiting",
      "/api/admin/settings",
      "/api/cron/blog-publish",
      "/", // 공개지만 매칭 자체는 유지 (분류/동작 확인용)
      "/blog",
      "/sitemap.xml", // 실제 앱 라우트 — 확장자 예외에 걸리면 안 된다
    ];
    for (const p of MUST_MATCH) {
      if (!re.test(p)) {
        errors.push(
          `matcher 가 "${p}" 를 제외한다. 보호/실제 라우트가 middleware 를 우회하면 ` +
            `인증 경계가 무너진다. 확장자 예외 목록을 좁힐 것.`
        );
      }
    }

    // 5. 정적 에셋은 middleware 를 타면 안 된다 (Phase 3B-2 성능 목표)
    const MUST_SKIP = [
      "/fonts/pretendard-1.3.9/pretendard-variable-dynamic-subset.css",
      "/fonts/pretendard-1.3.9/woff2/PretendardVariable.subset.0.woff2",
      "/fonts/pretendard-1.3.9/woff2/PretendardVariable.subset.91.woff2",
      "/_next/static/chunks/main-app.js",
      "/favicon.ico",
      "/robots.txt",
      "/ads.txt",
      "/main_image.webp",
      "/logo.png",
    ];
    for (const p of MUST_SKIP) {
      if (re.test(p)) {
        errors.push(
          `matcher 가 정적 에셋 "${p}" 를 여전히 매칭한다. ` +
            `Phase 3B-2 의 정적 에셋 우회가 회귀했다.`
        );
      }
    }
  }
}

if (errors.length > 0) {
  console.error("\n✗ Middleware 인증 경계/정적 에셋 회귀 감지 — 빌드를 중단한다.\n");
  errors.forEach((e, i) => console.error(`  ${i + 1}. ${e}\n`));
  console.error(
    "  자세한 배경: reports/performance/KIMPO_GUGAK_PHASE3B2_MIDDLEWARE_REMEDIATION_REPORT.md\n"
  );
  process.exit(1);
}

console.log(
  `✓ Middleware 인증 경계 정상 (게이트 ${authPrefixes.length}개 + /api / 보호 라우트 매칭 유지 / 정적 에셋 제외)`
);
