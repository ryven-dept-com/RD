import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "ruven_admin_session";

// Protect the /admin area. Full session validation happens server-side in each
// page/route via requireAdmin(); this is a fast first-line redirect.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public admin endpoints that must stay reachable when logged out.
  const isLogin = pathname === "/admin/login";
  const isLoginApi = pathname === "/api/admin/login";

  if (isLogin || isLoginApi) return NextResponse.next();

  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
    if (!hasSession) {
      if (pathname.startsWith("/api/admin")) {
        return NextResponse.json(
          { ok: false, error: "Unauthorized" },
          { status: 401 },
        );
      }
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
