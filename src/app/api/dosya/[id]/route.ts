import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

// Ekli dosya (fotoğraf / doküman) servis ucu
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const s = await getSession();
  if (!s) return new NextResponse("Yetkisiz", { status: 401 });
  const { id } = await params;
  const att = await prisma.attachment.findUnique({ where: { id: Number(id) } });
  if (!att) return new NextResponse("Bulunamadı", { status: 404 });
  return new NextResponse(new Uint8Array(att.data), {
    headers: {
      "Content-Type": att.mime,
      "Content-Disposition": `inline; filename="${encodeURIComponent(att.filename)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
