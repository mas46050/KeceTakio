import { NextRequest, NextResponse } from "next/server";
import { LANG_COOKIE, isLocale } from "@/lib/i18n";

// Bayrağa tıklanınca dil çerezini ayarlar ve geldiği sayfaya döner
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const back = req.nextUrl.searchParams.get("geri") || "/";
  const url = req.nextUrl.clone();
  url.pathname = back.startsWith("/") ? back : "/";
  url.search = "";
  const res = NextResponse.redirect(url);
  if (isLocale(code)) {
    res.cookies.set(LANG_COOKIE, code, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  return res;
}
