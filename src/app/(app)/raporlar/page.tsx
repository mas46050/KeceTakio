import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { getPermSet } from "@/lib/perm";
import { redirect } from "next/navigation";
import { parseReportFilters, queryReportRows, groupStats } from "@/lib/report";
import { fmtDate, fmtMoney, fmtNum } from "@/lib/format";
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
  const positionStats = groupStats(rows, (r) => `${r.position.machineName} / ${r.position.name}`);
  const productCodeStats = groupStats(rows, (r) => r.product.productCode || r.product.code);
  const reasonDist = groupStats(finished, (r) => r.failureReason?.name ?? "Belirtilmemiş").map(
    (g) => ({ neden: g.key, adet: g.finishedCount })
  );

  const qs = new URLSearchParams(
    Object.entries(sp).filter(([, v]) => v) as [string, string][]
  ).toString();

  return (
    <>
      <Flash sp={sp} />
      <div className="page-head">
        <h1>Raporlar &amp; Analiz</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <a className="btn no-print" href={`/api/rapor/csv${qs ? `?${qs}` : ""}`}>
            📊 Excel (CSV) İndir
          </a>
          <PrintButton />
        </div>
      </div>

      <form method="get" className="filters no-print">
        <label>Başlangıç<input type="date" name="from" defaultValue={f.from ?? ""} /></label>
        <label>Bitiş<input type="date" name="to" defaultValue={f.to ?? ""} /></label>
        <label>Tip
          <select name="tip" defaultValue={f.tip ?? ""}>
            <option value="">Tümü</option>
            <option value="ELEK">Elek</option>
            <option value="KECE">Keçe</option>
          </select>
        </label>
        <label>Pozisyon
          <select name="pozisyon" defaultValue={f.pozisyon ?? ""}>
            <option value="">Tümü</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>{p.machineName} / {p.name}</option>
            ))}
          </select>
        </label>
        <label>Üretici
          <select name="uretici" defaultValue={f.uretici ?? ""}>
            <option value="">Tümü</option>
            {manufacturers.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </label>
        <label>Ürün Kodu<input type="text" name="urunKodu" defaultValue={f.urunKodu ?? ""} /></label>
        <label>Değişim Nedeni
          <select name="neden" defaultValue={f.neden ?? ""}>
            <option value="">Tümü</option>
            {reasons.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </label>
        <label>Durum
          <select name="durum" defaultValue={f.durum ?? ""}>
            <option value="">Tümü</option>
            <option value="aktif">Makinede (aktif)</option>
            <option value="sokulmus">Sökülmüş</option>
          </select>
        </label>
        <button className="btn primary" type="submit">Uygula</button>
        <Link className="btn" href="/raporlar">Temizle</Link>
      </form>

      <div className="kpi-grid">
        <div className="kpi"><div className="v">{rows.length}</div><div className="l">Kullanım Kaydı</div></div>
        <div className="kpi"><div className="v">{avgLife === null ? "—" : `${fmtNum(avgLife)} gün`}</div><div className="l">Ortalama Kullanım Ömrü</div></div>
        <div className="kpi"><div className="v">{allDays.length ? `${Math.min(...allDays)} / ${Math.max(...allDays)}` : "—"}</div><div className="l">Min / Maks Ömür (gün)</div></div>
        <div className={`kpi ${unplannedPct !== null && unplannedPct > 30 ? "danger" : ""}`}>
          <div className="v">{unplannedPct === null ? "—" : `%${unplannedPct}`}</div><div className="l">Plansız Değişim Oranı</div>
        </div>
        <div className="kpi info"><div className="v" style={{ fontSize: 17 }}>{fmtMoney(totalCost)}</div><div className="l">Toplam Kullanım Maliyeti</div></div>
        <div className="kpi info">
          <div className="v" style={{ fontSize: 17 }}>{totalDays > 0 ? `${fmtMoney(totalCost / totalDays)}/gün` : "—"}</div>
          <div className="l">Günlük Kullanım Maliyeti</div>
        </div>
        <div className="kpi warn"><div className="v" style={{ fontSize: 17 }}>{fmtMoney(unplannedCost)}</div><div className="l">Plansız Değişim Maliyeti</div></div>
        <div className="kpi"><div className="v" style={{ fontSize: 17 }}>{fmtMoney(yearCost)}</div><div className="l">{thisYear} Yılı Toplam Maliyet</div></div>
      </div>

      <div className="panel-grid">
        <div className="panel">
          <h2>📈 Ortalama Ömür Trendi (söküm ayına göre)</h2>
          {monthly.length === 0 ? <p className="muted">Veri yok.</p> : (
            <LineBox data={monthly} xKey="ay" yKey="ortOmur" yLabel="Ortalama ömür (gün)" />
          )}
        </div>
        <div className="panel">
          <h2>🗓 Aylık Değişim Sayısı</h2>
          {monthly.length === 0 ? <p className="muted">Veri yok.</p> : (
            <BarBox data={monthly} xKey="ay" yKey="adet" yLabel="Değişim adedi" color="#0d6efd" />
          )}
        </div>
        <div className="panel">
          <h2>🏭 Üretici Performansı (ortalama gün)</h2>
          {manufacturerStats.filter((g) => g.avgDays !== null).length === 0 ? <p className="muted">Veri yok.</p> : (
            <BarBox
              data={manufacturerStats.filter((g) => g.avgDays !== null).map((g) => ({ uretici: g.key, gun: g.avgDays }))}
              xKey="uretici" yKey="gun" yLabel="Ortalama ömür (gün)"
            />
          )}
        </div>
        <div className="panel">
          <h2>🧩 Değişim Nedenleri Dağılımı</h2>
          {reasonDist.length === 0 ? <p className="muted">Veri yok.</p> : (
            <PieBox data={reasonDist} nameKey="neden" valueKey="adet" />
          )}
        </div>
      </div>

      <div className="panel">
        <h2>🏭 Üretici Bazında Analiz</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Üretici</th><th>Kayıt</th><th>Ort. Ömür</th><th>Min</th><th>Maks</th>
                <th>Plansız %</th><th>Toplam Maliyet</th><th>Günlük Maliyet</th>
              </tr>
            </thead>
            <tbody>
              {manufacturerStats.map((g) => (
                <tr key={g.key}>
                  <td><strong>{g.key}</strong></td>
                  <td>{g.count}</td>
                  <td>{g.avgDays === null ? "—" : `${g.avgDays} gün`}</td>
                  <td>{g.minDays ?? "—"}</td>
                  <td>{g.maxDays ?? "—"}</td>
                  <td>{g.unplannedPct === null ? "—" : `%${g.unplannedPct}`}</td>
                  <td>{fmtMoney(g.totalCost)}</td>
                  <td>{g.costPerDay === null ? "—" : `${fmtMoney(g.costPerDay)}/gün`}</td>
                </tr>
              ))}
              {manufacturerStats.length === 0 && <tr><td colSpan={8} className="muted">Veri yok.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          Günlük maliyet, kullanım günü başına en ekonomik ürünü gösterir — en uzun ömürlü ürün her
          zaman en ekonomik olan değildir.
        </p>
      </div>

      <div className="panel-grid">
        <div className="panel">
          <h2>📍 Pozisyon Bazında Analiz</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Pozisyon</th><th>Kayıt</th><th>Ort. Ömür</th><th>Plansız %</th><th>Maliyet</th></tr></thead>
              <tbody>
                {positionStats.map((g) => (
                  <tr key={g.key}>
                    <td>{g.key}</td>
                    <td>{g.count}</td>
                    <td>{g.avgDays === null ? "—" : `${g.avgDays} gün`}</td>
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
          <h2>🏷 Ürün Kodu Bazında Analiz</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Ürün Kodu</th><th>Kayıt</th><th>Ort. Ömür</th><th>Günlük Maliyet</th></tr></thead>
              <tbody>
                {productCodeStats.map((g) => (
                  <tr key={g.key}>
                    <td>{g.key}</td>
                    <td>{g.count}</td>
                    <td>{g.avgDays === null ? "—" : `${g.avgDays} gün`}</td>
                    <td>{g.costPerDay === null ? "—" : `${fmtMoney(g.costPerDay)}/gün`}</td>
                  </tr>
                ))}
                {productCodeStats.length === 0 && <tr><td colSpan={4} className="muted">Veri yok.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="panel">
        <h2>📋 Detay Liste ({rows.length} kayıt)</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ürün</th><th>Tip</th><th>Üretici</th><th>Pozisyon</th><th>Montaj</th>
                <th>Söküm</th><th>Çalışma</th><th>Ömür</th><th>Neden</th><th>Maliyet</th><th>Günlük</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 200).map((r) => (
                <tr key={r.id}>
                  <td><Link href={`/urunler/${r.productId}`}>{r.product.code}</Link></td>
                  <td><TypeBadge type={r.product.type} /></td>
                  <td>{r.product.manufacturer?.name ?? "—"}</td>
                  <td>{r.position.name}</td>
                  <td>{fmtDate(r.installDate)}</td>
                  <td>{r.removeDate ? fmtDate(r.removeDate) : <span className="badge green">Makinede</span>}</td>
                  <td>{r.life.workingDays} gün</td>
                  <td><LifeBar life={r.life} /></td>
                  <td>{r.failureReason?.name ?? "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtMoney(r.price, r.product.currency)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{r.dailyCost === null ? "—" : `${fmtMoney(r.dailyCost, r.product.currency)}/gün`}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={11} className="muted">Filtrelere uyan kayıt yok.</td></tr>}
            </tbody>
          </table>
        </div>
        {rows.length > 200 && (
          <p className="muted">İlk 200 kayıt gösteriliyor — tamamı için CSV indirin.</p>
        )}
      </div>
    </>
  );
}
