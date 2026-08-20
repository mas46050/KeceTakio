import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { parseReportFilters, queryReportRows } from "@/lib/report";
import { fmtDate } from "@/lib/format";

// Rapor dışa aktarımı — UTF-8 BOM'lu, noktalı virgül ayraçlı CSV (Excel ile doğrudan açılır)
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return new NextResponse("Yetkisiz", { status: 401 });

  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const rows = await queryReportRows(parseReportFilters(sp));

  const esc = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const header = [
    "Sistem ID", "Tip", "Üretici", "Ürün Kodu", "Seri No", "Pozisyon", "Montaj Tarihi",
    "Söküm Tarihi", "Çalışma (gün)", "Tahmini Ömür (gün)", "Ömür Kullanımı (%)",
    "Değişim Nedeni", "Planlı mı", "Karar", "Birim Fiyat", "Para Birimi", "Günlük Maliyet",
  ];
  const lines = rows.map((r) =>
    [
      r.product.code,
      r.product.type === "ELEK" ? "Elek" : "Keçe",
      r.product.manufacturer?.name ?? "",
      r.product.productCode,
      r.product.serialNo,
      `${r.position.machineName} / ${r.position.name}`,
      fmtDate(r.installDate),
      r.removeDate ? fmtDate(r.removeDate) : "Makinede",
      r.life.workingDays,
      r.life.expectedDays,
      r.life.usedPct,
      r.failureReason?.name ?? "",
      r.failureReason ? (r.failureReason.planned ? "Planlı" : "Plansız") : "",
      r.removalDecision === "HURDA" ? "Hurda" : r.removalDecision === "KULLANILABILIR" ? "Kullanılabilir" : "",
      String(r.price).replace(".", ","),
      r.product.currency,
      r.dailyCost === null ? "" : r.dailyCost.toFixed(2).replace(".", ","),
    ]
      .map(esc)
      .join(";")
  );
  const csv = "\uFEFF" + [header.map(esc).join(";"), ...lines].join("\r\n");
  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kecetakip-rapor-${today}.csv"`,
    },
  });
}
