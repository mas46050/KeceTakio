import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { getPermSet } from "@/lib/perm";
import { redirect } from "next/navigation";
import { parseReportFilters, queryReportRows, groupStats } from "@/lib/report";
import { fmtDate, fmtMoney, fmtNum } from "@/lib/format";
import { getLocale } from "@/lib/locale-server";
import { tFor } from "@/lib/i18n";
import { trAudit, trPos } from "@/lib/dynamic-i18n";

import { Flash, LifeBar, TypeBadge } from "@/components/ui";
import { BarBox, LineBox, PieBox } from "@/components/charts";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const s = await requireSession();
  const perms = await getPermSet(s.role);
  if (!perms.has("sayfa_raporlar")) redirect("/?hata=Bu%20sayfa%20i%C3%A7in%20yetkiniz%20yok.");
  const locale = await getLocale();
  const t = tFor(locale);
  const sp = await searchParams;
  const f = parseReportFilters(sp);

  const [rows, positions, manufacturers, reasons] = await Promise.all([
    queryReportRows(f),
    prisma.position.findMany({ where: { deletedAt: null }, orderBy: [{ machineName: "asc" }, { sortOrder: "asc" }] }),
    prisma.manufacturer.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.failureReason.findMany({ where: { deletedAt: null }, orderBy: { sortOrder: "asc" } }),
  ]);

  const finished = rows.filter((r) => r.removeDate);
  const allDays = finished.map((r) => r.life.workingDays);
  const avgLife = allDays.length ? Math.round(allDays.reduce((a, b) => a + b, 0) / allDays.length) : null;
  const unplannedCount = finished.filter((r) => r.failureReason && !r.failureReason.planned).length;
  const unplannedPct = finished.length ? Math.round((unplannedCount / finished.length) * 100) : null;
  const unplannedCost = finished
    .filter((r) => r.failureReason && !r.failureReason.planned)
    .reduce((a, r) => a + r.price, 0);
  const totalCost = rows.reduce((a, r) => a + r.price, 0);
  const totalDays = rows.reduce((a, r) => a + r.life.workingDays, 0);

  // Yıllık toplam maliyet (montaj tarihine göre içinde bulunulan yıl)
  const thisYear = new Date().getFullYear();
  const yearCost = rows
    .filter((r) => new Date(r.installDate).getFullYear() === thisYear)
    .reduce((a, r) => a + r.price, 0);

  // Aylık gruplar (söküm ayına göre)
  const byMonth = new Map<string, { count: number; days: number[]; cost: number }>();
  for (const r of finished) {
    const d = new Date(r.removeDate!);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth.has(key)) byMonth.set(key, { count: 0, days: [], cost: 0 });
    const m = byMonth.get(key)!;
    m.count += 1;
    m.days.push(r.life.workingDays);
    m.cost += r.price;
  }
  const monthly = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ay, m]) => ({
      ay,
      adet: m.count,
      ortOmur: Math.round(m.days.reduce((a, b) => a + b, 0) / m.days.length),
      maliyet: Math.round(m.cost),
    }));

  const manufacturerStats = groupStats(rows, (r) => r.product.manufacturer?.name ?? "—");
  const positionStats = groupStats(rows, (r) => `${r.position.machineName} / ${trPos(r.position.name, locale)}`);
  const productCodeStats = groupStats(rows, (r) => r.product.productCode || r.product.code);
  const reasonDist = groupStats(finished, (r) => (r.failureReason ? t(r.failureReason.name) : "—")).map(
    (g) => ({ neden: g.key, adet: g.finishedCount })
  );

  const qs = new URLSearchParams(
    Object.entries(sp).filter(([, v]) => v) as [string, string][]
  ).toString();

  return (
    <>
      <Flash sp={sp} t={t} />
      <div className="page-head">
        <h1>{t("Raporlar & Analiz")}</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <a className="btn no-print" href={`/api/rapor/csv${qs ? `?${qs}` : ""}`}>
            📊 {t("Excel (CSV) İndir")}
          </a>
          <PrintButton label={t("PDF / Yazdır")} />
        </div>
      </div>

      <form method="get" className="filters no-print">
        <label>{t("Başlangıç")}<input type="date" name="from" defaultValue={f.from ?? ""} /></label>
        <label>{t("Bitiş")}<input type="date" name="to" defaultValue={f.to ?? ""} /></label>
        <label>{t("Tip")}
          <select name="tip" defaultValue={f.tip ?? ""}>
            <option value="">{t("Tümü")}</option>
            <option value="ELEK">{t("Elek")}</option>
            <option value="KECE">{t("Keçe")}</option>
          </select>
        </label>
        <label>{t("Pozisyon")}
          <select name="pozisyon" defaultValue={f.pozisyon ?? ""}>
            <option value="">{t("Tümü")}</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>{p.machineName} / {trPos(p.name, locale)}</option>
            ))}
          </select>
        </label>
        <label>{t("Üretici")}
          <select name="uretici" defaultValue={f.uretici ?? ""}>
            <option value="">{t("Tümü")}</option>
            {manufacturers.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </label>
        <label>{t("Ürün Kodu")}<input type="text" name="urunKodu" defaultValue={f.urunKodu ?? ""} /></label>
        <label>{t("Değişim Nedeni")}
          <select name="neden" defaultValue={f.neden ?? ""}>
            <option value="">{t("Tümü")}</option>
            {reasons.map((r) => (
              <option key={r.id} value={r.id}>{t(r.name)}</option>
            ))}
          </select>
        </label>
        <label>{t("Durum")}
          <select name="durum" defaultValue={f.durum ?? ""}>
            <option value="">{t("Tümü")}</option>
            <option value="aktif">{t("Makinede (aktif)")}</option>
            <option value="sokulmus">{t("Sökülmüş")}</option>
          </select>
        </label>
        <button className="btn primary" type="submit">{t("Uygula")}</button>
        <Link className="btn" href="/raporlar">{t("Temizle")}</Link>
      </form>

      <div className="kpi-grid">
        <div className="kpi"><div className="v">{rows.length}</div><div className="l">{t("Kullanım Kaydı")}</div></div>
        <div className="kpi"><div className="v">{avgLife === null ? "—" : `${fmtNum(avgLife)} ${t("gün")}`}</div><div className="l">{t("Ortalama Kullanım Ömrü")}</div></div>
        <div className="kpi"><div className="v">{allDays.length ? `${Math.min(...allDays)} / ${Math.max(...allDays)}` : "—"}</div><div className="l">{t("Min / Maks Ömür (gün)")}</div></div>
        <div className={`kpi ${unplannedPct !== null && unplannedPct > 30 ? "danger" : ""}`}>
          <div className="v">{unplannedPct === null ? "—" : `%${unplannedPct}`}</div><div className="l">{t("Plansız Değişim Oranı")}</div>
        </div>
        <div className="kpi info"><div className="v" style={{ fontSize: 17 }}>{fmtMoney(totalCost)}</div><div className="l">{t("Toplam Kullanım Maliyeti")}</div></div>
        <div className="kpi info">
          <div className="v" style={{ fontSize: 17 }}>{totalDays > 0 ? `${fmtMoney(totalCost / totalDays)}/${t("gün")}` : "—"}</div>
          <div className="l">{t("Günlük Kullanım Maliyeti")}</div>
        </div>
        <div className="kpi warn"><div className="v" style={{ fontSize: 17 }}>{fmtMoney(unplannedCost)}</div><div className="l">{t("Plansız Değişim Maliyeti")}</div></div>
        <div className="kpi"><div className="v" style={{ fontSize: 17 }}>{fmtMoney(yearCost)}</div><div className="l">{thisYear} — {t("Yılı Toplam Maliyet")}</div></div>
      </div>

      <div className="panel-grid">
        <div className="panel">
          <h2>📈 {t("Ortalama Ömür Trendi (söküm ayına göre)")}</h2>
          {monthly.length === 0 ? <p className="muted">{t("Veri yok.")}</p> : (
            <LineBox data={monthly} xKey="ay" yKey="ortOmur" yLabel={t("Ortalama ömür (gün)")} />
          )}
        </div>
        <div className="panel">
          <h2>🗓 {t("Aylık Değişim Sayısı")}</h2>
          {monthly.length === 0 ? <p className="muted">{t("Veri yok.")}</p> : (
            <BarBox data={monthly} xKey="ay" yKey="adet" yLabel={t("Değişim adedi")} color="#0d6efd" />
          )}
        </div>
        <div className="panel">
          <h2>🏭 {t("Üretici Performansı (ortalama gün)")}</h2>
          {manufacturerStats.filter((g) => g.avgDays !== null).length === 0 ? <p className="muted">{t("Veri yok.")}</p> : (
            <BarBox
              data={manufacturerStats.filter((g) => g.avgDays !== null).map((g) => ({ uretici: g.key, gun: g.avgDays }))}
              xKey="uretici" yKey="gun" yLabel={t("Ortalama ömür (gün)")}
            />
          )}
        </div>
        <div className="panel">
          <h2>🧩 {t("Değişim Nedenleri Dağılımı")}</h2>
          {reasonDist.length === 0 ? <p className="muted">{t("Veri yok.")}</p> : (
            <PieBox data={reasonDist} nameKey="neden" valueKey="adet" />
          )}
        </div>
      </div>

      <div className="panel">
        <h2>🏭 {t("Üretici Bazında Analiz")}</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("Üretici")}</th><th>{t("Kayıt")}</th><th>{t("Ort. Ömür")}</th><th>{t("Min")}</th><th>{t("Maks")}</th>
                <th>{t("Plansız %")}</th><th>{t("Toplam Maliyet")}</th><th>{t("Günlük Maliyet")}</th>
              </tr>
            </thead>
            <tbody>
              {manufacturerStats.map((g) => (
                <tr key={g.key}>
                  <td><strong>{g.key}</strong></td>
                  <td>{g.count}</td>
                  <td>{g.avgDays === null ? "—" : `${g.avgDays} ${t("gün")}`}</td>
                  <td>{g.minDays ?? "—"}</td>
                  <td>{g.maxDays ?? "—"}</td>
                  <td>{g.unplannedPct === null ? "—" : `%${g.unplannedPct}`}</td>
                  <td>{fmtMoney(g.totalCost)}</td>
                  <td>{g.costPerDay === null ? "—" : `${fmtMoney(g.costPerDay)}/${t("gün")}`}</td>
                </tr>
              ))}
              {manufacturerStats.length === 0 && <tr><td colSpan={8} className="muted">Veri yok.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          {t("Günlük maliyet, kullanım günü başına en ekonomik ürünü gösterir — en uzun ömürlü ürün her zaman en ekonomik olan değildir.")}
        </p>
      </div>

      <div className="panel-grid">
        <div className="panel">
          <h2>📍 {t("Pozisyon Bazında Analiz")}</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>{t("Pozisyon")}</th><th>{t("Kayıt")}</th><th>{t("Ort. Ömür")}</th><th>{t("Plansız %")}</th><th>{t("Maliyet")}</th></tr></thead>
              <tbody>
                {positionStats.map((g) => (
                  <tr key={g.key}>
                    <td>{g.key}</td>
                    <td>{g.count}</td>
                    <td>{g.avgDays === null ? "—" : `${g.avgDays} ${t("gün")}`}</td>
                    <td>{g.unplannedPct === null ? "—" : `%${g.unplannedPct}`}</td>
                    <td>{fmtMoney(g.totalCost)}</td>
                  </tr>
                ))}
                {positionStats.length === 0 && <tr><td colSpan={5} className="muted">Veri yok.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="panel">
          <h2>🏷 {t("Ürün Kodu Bazında Analiz")}</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>{t("Ürün Kodu")}</th><th>{t("Kayıt")}</th><th>{t("Ort. Ömür")}</th><th>{t("Günlük Maliyet")}</th></tr></thead>
              <tbody>
                {productCodeStats.map((g) => (
                  <tr key={g.key}>
                    <td>{g.key}</td>
                    <td>{g.count}</td>
                    <td>{g.avgDays === null ? "—" : `${g.avgDays} ${t("gün")}`}</td>
                    <td>{g.costPerDay === null ? "—" : `${fmtMoney(g.costPerDay)}/${t("gün")}`}</td>
                  </tr>
                ))}
                {productCodeStats.length === 0 && <tr><td colSpan={4} className="muted">Veri yok.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="panel">
        <h2>📋 {t("Detay Liste")} ({rows.length} {t("kayıt")})</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("Ürün")}</th><th>{t("Tip")}</th><th>{t("Üretici")}</th><th>{t("Pozisyon")}</th><th>{t("Montaj")}</th>
                <th>{t("Söküm")}</th><th>{t("Çalışma")}</th><th>{t("Ömür")}</th><th>{t("Neden")}</th><th>{t("Maliyet")}</th><th>{t("Günlük Maliyet")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 200).map((r) => (
                <tr key={r.id}>
                  <td><Link href={`/urunler/${r.productId}`}>{r.product.code}</Link></td>
                  <td><TypeBadge type={r.product.type} locale={locale} /></td>
                  <td>{r.product.manufacturer?.name ?? "—"}</td>
                  <td>{trPos(r.position.name, locale)}</td>
                  <td>{fmtDate(r.installDate)}</td>
                  <td>{r.removeDate ? fmtDate(r.removeDate) : <span className="badge green">{t("Makinede")}</span>}</td>
                  <td>{r.life.workingDays} {t("gün")}</td>
                  <td><LifeBar life={r.life} locale={locale} /></td>
                  <td>{r.failureReason ? t(r.failureReason.name) : "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtMoney(r.price, r.product.currency)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{r.dailyCost === null ? "—" : `${fmtMoney(r.dailyCost, r.product.currency)}/${t("gün")}`}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={11} className="muted">{t("Filtrelere uyan kayıt yok.")}</td></tr>}
            </tbody>
          </table>
        </div>
        {rows.length > 200 && (
          <p className="muted">{t("İlk 200 kayıt gösteriliyor — tamamı için CSV indirin.")}</p>
        )}
      </div>
    </>
  );
}
