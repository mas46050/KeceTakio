import { prisma } from "./db";
import { calcLife } from "./life";
import { parseDateInput } from "./format";

export type ReportFilters = {
  from?: string;
  to?: string;
  tip?: "ELEK" | "KECE";
  pozisyon?: number;
  uretici?: number;
  urunKodu?: string;
  neden?: number;
  durum?: "aktif" | "sokulmus";
};

export function parseReportFilters(sp: Record<string, string | undefined>): ReportFilters {
  return {
    from: sp.from || undefined,
    to: sp.to || undefined,
    tip: sp.tip === "ELEK" || sp.tip === "KECE" ? sp.tip : undefined,
    pozisyon: sp.pozisyon ? Number(sp.pozisyon) : undefined,
    uretici: sp.uretici ? Number(sp.uretici) : undefined,
    urunKodu: sp.urunKodu || undefined,
    neden: sp.neden ? Number(sp.neden) : undefined,
    durum: sp.durum === "aktif" || sp.durum === "sokulmus" ? sp.durum : undefined,
  };
}

export async function queryReportRows(f: ReportFilters) {
  const rows = await prisma.installation.findMany({
    where: {
      ...(f.from ? { installDate: { gte: parseDateInput(f.from, "00:00") } } : {}),
      ...(f.to ? { installDate: { lte: parseDateInput(f.to, "23:59") } } : {}),
      ...(f.pozisyon ? { positionId: f.pozisyon } : {}),
      ...(f.neden ? { failureReasonId: f.neden } : {}),
      ...(f.durum === "aktif" ? { active: true } : {}),
      ...(f.durum === "sokulmus" ? { active: false } : {}),
      product: {
        ...(f.tip ? { type: f.tip } : {}),
        ...(f.uretici ? { manufacturerId: f.uretici } : {}),
        ...(f.urunKodu
          ? { productCode: { contains: f.urunKodu, mode: "insensitive" as const } }
          : {}),
      },
    },
    include: {
      product: { include: { manufacturer: true } },
      position: true,
      failureReason: true,
    },
    orderBy: { installDate: "desc" },
  });

  return rows.map((i) => {
    const life = calcLife(i.installDate, i.expectedLifeDays, i.removeDate ?? undefined);
    const price = Number(i.product.unitPrice);
    return {
      ...i,
      life,
      price,
      dailyCost: life.workingDays > 0 ? price / life.workingDays : null,
    };
  });
}

export type ReportRow = Awaited<ReturnType<typeof queryReportRows>>[number];

export function groupStats(rows: ReportRow[], keyFn: (r: ReportRow) => string) {
  const map = new Map<string, ReportRow[]>();
  for (const r of rows) {
    const k = keyFn(r) || "—";
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(r);
  }
  return [...map.entries()].map(([key, list]) => {
    const finished = list.filter((r) => r.removeDate);
    const days = finished.map((r) => r.life.workingDays);
    const totalCost = list.reduce((a, r) => a + r.price, 0);
    const totalDays = list.reduce((a, r) => a + r.life.workingDays, 0);
    const unplanned = finished.filter((r) => r.failureReason && !r.failureReason.planned).length;
    return {
      key,
      count: list.length,
      finishedCount: finished.length,
      avgDays: days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null,
      minDays: days.length ? Math.min(...days) : null,
      maxDays: days.length ? Math.max(...days) : null,
      unplannedPct: finished.length ? Math.round((unplanned / finished.length) * 100) : null,
      totalCost,
      costPerDay: totalDays > 0 ? totalCost / totalDays : null,
    };
  });
}
