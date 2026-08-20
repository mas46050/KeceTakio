import { NextRequest, NextResponse } from "next/server";
import { LANG_COOKIE, isLocale } from "@/lib/i18n";

// Bayrağa tıklanınca dil çerezini ayarlar ve geldiği sayfaya döner.
// Ters vekil (Railway/nginx) arkasında iç adres (localhost:PORT) yerine
// ziyaretçinin gördüğü adres kullanılmalı; bu yüzden x-forwarded-* okunur.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const backParam = req.nextUrl.searchParams.get("geri") || "/";
  // yalnızca site içi yollara izin ver ("//evil.com" gibi değerleri engelle)
  const back = backParam.startsWith("/") && !backParam.startsWith("//") ? backParam : "/";

  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
  const host =
    req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    req.headers.get("host") ||
    req.nextUrl.host;

  const res = NextResponse.redirect(new URL(back, `${proto}://${host}`), 303);
  if (isLocale(code)) {
    res.cookies.set(LANG_COOKIE, code, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  return res;
}
