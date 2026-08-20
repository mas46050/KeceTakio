import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { getPermSet } from "@/lib/perm";
import { redirect } from "next/navigation";
import { calcLife } from "@/lib/life";
import { fmtDateTime, fmtMoney, fmtNum } from "@/lib/format";
import { getLocale } from "@/lib/locale-server";
import { tFor } from "@/lib/i18n";
import { trPos } from "@/lib/dynamic-i18n";

import { LifeBar, TypeBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PositionHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const s = await requireSession();
  const perms = await getPermSet(s.role);
  if (!perms.has("sayfa_pozisyonlar")) redirect("/?hata=Bu%20sayfa%20i%C3%A7in%20yetkiniz%20yok.");
  const locale = await getLocale();
  const t = tFor(locale);
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
          {t("Pozisyon Geçmişi")} — {pos.machineName} / {trPos(pos.name, locale)} <TypeBadge type={pos.type} locale={locale} />
        </h1>
        <Link className="btn" href="/pozisyonlar">{t("← Pozisyonlar")}</Link>
      </div>

      <div className="kpi-grid">
        <div className="kpi"><div className="v">{pos.installations.length}</div><div className="l">{t("Toplam Kullanım")}</div></div>
        <div className="kpi"><div className="v">{avg === null ? "—" : `${fmtNum(avg)} ${t("gün")}`}</div><div className="l">{t("Ortalama Ömür")}</div></div>
        <div className="kpi"><div className="v">{min === null ? "—" : `${fmtNum(min)} ${t("gün")}`}</div><div className="l">{t("Minimum Ömür")}</div></div>
        <div className="kpi"><div className="v">{max === null ? "—" : `${fmtNum(max)} ${t("gün")}`}</div><div className="l">{t("Maksimum Ömür")}</div></div>
        <div className={`kpi ${unplanned ? "warn" : ""}`}>
          <div className="v">{finished.length ? `%${Math.round((unplanned / finished.length) * 100)}` : "—"}</div>
          <div className="l">{t("Plansız Değişim Oranı")}</div>
        </div>
      </div>

      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t("Ürün")}</th><th>{t("Üretici")}</th><th>{t("Seri No")}</th><th>{t("Montaj")}</th><th>{t("Söküm")}</th>
              <th>{t("Çalışma")}</th><th>{t("Ömür Kullanımı")}</th><th>{t("Değişim Nedeni")}</th>
              <th>{t("Maliyet")}</th><th>{t("Günlük Maliyet")}</th>
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
                  <td>{i.removeDate ? <>{fmtDateTime(i.removeDate)}<br /><small>{i.removedBy?.fullName ?? ""}</small></> : <span className="badge green">{t("Makinede")}</span>}</td>
                  <td>{l.workingDays} {t("gün")}</td>
                  <td><LifeBar life={l} locale={locale} /></td>
                  <td>{i.failureReason ? t(i.failureReason.name) : "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtMoney(price, i.product.currency)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{dc === null ? "—" : `${fmtMoney(dc, i.product.currency)}/${t("gün")}`}</td>
                </tr>
              );
            })}
            {pos.installations.length === 0 && (
              <tr><td colSpan={10} className="muted">{t("Bu pozisyonda henüz kullanım kaydı yok.")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
