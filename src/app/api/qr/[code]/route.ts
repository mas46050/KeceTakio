import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { getSession } from "@/lib/auth";

// Ürün QR kodu — içerik: /q/<kod> adresi; okutulunca ürün detayına yönlenir
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const s = await getSession();
  if (!s) return new NextResponse("Yetkisiz", { status: 401 });
  const { code } = await params;
  const url = `${req.nextUrl.origin}/q/${encodeURIComponent(code)}`;
  const png = await QRCode.toBuffer(url, { width: 300, margin: 1 });
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
