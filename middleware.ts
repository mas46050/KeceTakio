import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_PATHS = ["/login"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }
  const token = req.cookies.get("kt_session")?.value;
  if (token) {
    try {
      await jwtVerify(
        token,
        new TextEncoder().encode(process.env.SESSION_SECRET || "kecetakip-dev-secret")
      );
      return NextResponse.next();
    } catch {
      // geçersiz / süresi dolmuş oturum
    }
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
