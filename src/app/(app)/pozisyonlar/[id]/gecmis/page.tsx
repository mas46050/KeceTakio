import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { calcLife } from "@/lib/life";
import { fmtDateTime, fmtMoney, fmtNum } from "@/lib/format";
import { LifeBar, TypeBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PositionHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const pos = await prisma.position.findUnique({
    where: { id: Number(id) },
    include: {
      installations: {
        orderBy: { installDate: "desc" },
        include: {
          product: { include: { manufacturer: true } },
          failureReason: true,
          installedBy: { select: { fullName: true } },
          removedBy: { select: { fullName: true } },
        },
      },
    },
  });
  if (!pos) notFound();

  const finished = pos.installations.filter((i) => i.removeDate);
  const days = finished.map((i) =>
    calcLife(i.installDate, i.expectedLifeDays, i.removeDate!).workingDays
  );
  const avg = days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null;
  const min = days.length ? Math.min(...days) : null;
  const max = days.length ? Math.max(...days) : null;
  const unplanned = finished.filter((i) => i.failureReason && !i.failureReason.planned).length;

  return (
    <>
      <div className="page-head">
        <h1>
          Pozisyon Geçmişi — {pos.machineName} / {pos.name} <TypeBadge type={pos.type} />
        </h1>
        <Link className="btn" href="/pozisyonlar">← Pozisyonlar</Link>
      </div>

      <div className="kpi-grid">
        <div className="kpi"><div className="v">{pos.installations.length}</div><div className="l">Toplam Kullanım</div></div>
        <div className="kpi"><div className="v">{avg === null ? "—" : `${fmtNum(avg)} gün`}</div><div className="l">Ortalama Ömür</div></div>
        <div className="kpi"><div className="v">{min === null ? "—" : `${fmtNum(min)} gün`}</div><div className="l">Minimum Ömür</div></div>
        <div className="kpi"><div className="v">{max === null ? "—" : `${fmtNum(max)} gün`}</div><div className="l">Maksimum Ömür</div></div>
        <div className={`kpi ${unplanned ? "warn" : ""}`}>
          <div className="v">{finished.length ? `%${Math.round((unplanned / finished.length) * 100)}` : "—"}</div>
          <div className="l">Plansız Değişim Oranı</div>
        </div>
      </div>

      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ürün</th><th>Üretici</th><th>Seri No</th><th>Montaj</th><th>Söküm</th>
              <th>Çalışma</th><th>Ömür Kullanımı</th><th>Değişim Nedeni</th>
              <th>Maliyet</th><th>Günlük Maliyet</th>
            </tr>
          </thead>
          <tbody>
            {pos.installations.map((i) => {
              const l = calcLife(i.installDate, i.expectedLifeDays, i.removeDate ?? undefined);
              const price = Number(i.product.unitPrice);
              const dc = l.workingDays > 0 ? price / l.workingDays : null;
              return (
                <tr key={i.id}>
                  <td><Link href={`/urunler/${i.productId}`}><strong>{i.product.code}</strong></Link><br /><small>{i.product.productCode}</small></td>
                  <td>{i.product.manufacturer?.name ?? "—"}</td>
                  <td>{i.product.serialNo || "—"}</td>
                  <td>{fmtDateTime(i.installDate)}<br /><small>{i.installedBy?.fullName ?? ""}</small></td>
                  <td>{i.removeDate ? <>{fmtDateTime(i.removeDate)}<br /><small>{i.removedBy?.fullName ?? ""}</small></> : <span className="badge green">Makinede</span>}</td>
                  <td>{l.workingDays} gün</td>
                  <td><LifeBar life={l} /></td>
                  <td>{i.failureReason?.name ?? "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtMoney(price, i.product.currency)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{dc === null ? "—" : `${fmtMoney(dc, i.product.currency)}/gün`}</td>
                </tr>
              );
            })}
            {pos.installations.length === 0 && (
              <tr><td colSpan={10} className="muted">Bu pozisyonda henüz kullanım kaydı yok.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
