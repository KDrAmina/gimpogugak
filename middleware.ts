import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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

  // Public routes that don't need authentication
  const publicRoutes = ["/", "/classes", "/activities", "/contact", "/Song-Ri-Gyel", "/Park-Jun-Yeol", "/login"];
  
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
      return NextResponse.redirect(new URL("/admin/login", request.url));
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
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
