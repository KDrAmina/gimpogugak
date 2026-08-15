import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * middleware 가 auth 결과를 **실제로 소비하는** 경로 집합 (Phase 3B-2, 2026-08-15).
 *
 * 아래 프리픽스는 이 파일 하단의 분기들이 검사하는 경로와 1:1로 대응한다.
 *   /admin       → role/status 검사, 비로그인 시 /admin/login?next=... redirect
 *   /notices /gallery /materials /my-lessons → memberRoutes status 검사
 *   /waiting     → 로그인 여부에 따른 양방향 redirect
 *
 * 이 목록 밖의 경로(`/`, `/intro`, `/blog`, `/classes`, 정적 에셋 …)는 기존 코드에서도
 * user 값을 읽는 분기가 하나도 없어 언제나 NextResponse.next() 로 통과했다.
 * 따라서 auth 왕복을 건너뛰어도 응답은 한 글자도 달라지지 않는다.
 *
 * ⚠️ 보호 라우트를 새로 추가할 때는 반드시 이 목록에도 추가할 것.
 *    누락 시 인증 검사가 조용히 사라진다 — scripts/check-middleware-regression.mjs 가
 *    prebuild 에서 이 불변식을 강제한다.
 */
const AUTH_ROUTE_PREFIXES = [
  "/admin",
  "/notices",
  "/gallery",
  "/materials",
  "/my-lessons",
  "/waiting",
];

/**
 * /api/* 는 각 route handler 가 쿠키 기반으로 자체 인증한다.
 * 이번 변경으로 세션 갱신 타이밍을 조금도 바꾸지 않기 위해,
 * API 는 기존과 동일하게 auth 경로를 그대로 태운다.
 */
function needsAuth(pathname: string): boolean {
  if (pathname.startsWith("/api")) return true;
  return AUTH_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 공개 라우트: Supabase 클라이언트 생성과 auth.getUser() 왕복을 모두 건너뛴다.
  // 로그인 사용자의 세션 갱신은 (a) 보호 라우트 진입 시 아래 경로가,
  // (b) 공개 라우트에서는 브라우저 Supabase 클라이언트(자동 갱신)가 담당한다.
  if (!needsAuth(pathname)) {
    return NextResponse.next();
  }

  // Create Supabase client
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Get user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Member-only routes (require status = 'active')
  const memberRoutes = ["/notices", "/gallery", "/materials", "/my-lessons"];
  const isMemberRoute = memberRoutes.some((route) => pathname.startsWith(route));

  // If user is logged in, check their status
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("status, role")
      .eq("id", user.id)
      .single();

    // If user is pending and trying to access non-waiting pages
    if (profile?.status === "pending" && pathname !== "/waiting" && !pathname.startsWith("/admin")) {
      // Redirect pending users trying to access member routes
      if (isMemberRoute) {
        return NextResponse.redirect(new URL("/waiting", request.url));
      }
    }

    // If user is trying to access member-only routes but not active
    if (isMemberRoute && profile?.status !== "active") {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // If user is active but on waiting page, redirect to home
    if (profile?.status === "active" && pathname === "/waiting") {
      return NextResponse.redirect(new URL("/", request.url));
    }

    // Admin routes protection
    if (pathname.startsWith("/admin")) {
      // Check if user is admin
      if (profile?.status !== "active" || profile?.role !== "admin") {
        // Non-admins should go to login page
        if (pathname !== "/admin/login") {
          return NextResponse.redirect(new URL("/admin/login", request.url));
        }
      }
    }
  } else {
    // Not logged in
    // Redirect to login if trying to access protected routes
    if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (pathname === "/waiting") {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder 의 정적 에셋 확장자
     *
     * 확장자 목록은 실제로 서빙되는 파일만 넣는다 (Phase 3B-2):
     *   css/woff2/woff/ttf/otf → public/fonts/pretendard-1.3.9/ (CSS 1 + woff2 92개)
     *   txt                    → robots.txt, ads.txt, 사이트 소유확인 txt
     *   ico                    → favicon.ico
     *   이미지 6종             → 기존 유지
     * js/map 은 넣지 않는다 — Next 자산은 이미 _next/static 으로 제외되고
     * TinyMCE 는 CDN 이라 public/ 에 .js 가 없다.
     * xml/json 도 넣지 않는다 — /sitemap.xml 은 실제 앱 라우트이므로 제외 대상이 아니다.
     * 보호 라우트(/admin, /notices, /gallery, /materials, /my-lessons, /waiting)는
     * 확장자가 없어 어떤 경우에도 이 예외에 걸리지 않는다.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|woff2|woff|ttf|otf|txt)$).*)",
  ],
};
