import Link from "next/link";
import { prisma } from "@/lib/db";
import { calcLife } from "@/lib/life";
import { fmtDate, fmtDateTime, fmtMoney, fmtNum } from "@/lib/format";
import { Flash, LifeBar, LifeBadge, StatusBadge, TypeBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; hata?: string }>;
}) {
  const sp = await searchParams;

  const IN_STOCK = ["YENI", "STOKTA", "REZERVE"] as const;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    aktifElek,
    aktifKece,
    stokElek,
    stokKece,
    buAyDegisen,
    stockProducts,
    positions,
    activeInstalls,
    removedInstalls,
    recentLogs,
  ] = await Promise.all([
    prisma.product.count({ where: { type: "ELEK", status: "MAKINEDE", deletedAt: null } }),
    prisma.product.count({ where: { type: "KECE", status: "MAKINEDE", deletedAt: null } }),
    prisma.product.count({
      where: { type: "ELEK", status: { in: [...IN_STOCK] }, deletedAt: null },
    }),
    prisma.product.count({
      where: { type: "KECE", status: { in: [...IN_STOCK] }, deletedAt: null },
    }),
    prisma.installation.count({ where: { removeDate: { gte: monthStart } } }),
    prisma.product.findMany({
      where: { status: { in: [...IN_STOCK] }, deletedAt: null },
      select: { unitPrice: true, currency: true, positionId: true, status: true },
    }),
    prisma.position.findMany({
      where: { deletedAt: null },
      orderBy: [{ machineName: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.installation.findMany({
      where: { active: true },
      include: { product: { include: { manufacturer: true } }, position: true },
    }),
    prisma.installation.findMany({
      where: { active: false, removeDate: { not: null } },
      include: { product: { select: { type: true } } },
    }),
    prisma.auditLog.findMany({
      orderBy: { id: "desc" },
      take: 10,
      include: { user: { select: { fullName: true } } },
    }),
  ]);

  // Ortalama ömürler (sökülmüş kayıtlardan)
  const lifeDays = (type: "ELEK" | "KECE") => {
    const list = removedInstalls.filter((i) => i.product.type === type);
    if (list.length === 0) return null;
    const total = list.reduce(
      (a, i) => a + calcLife(i.installDate, i.expectedLifeDays, i.removeDate).workingDays,
      0
    );
    return Math.round(total / list.length);
  };
  const ortElek = lifeDays("ELEK");
  const ortKece = lifeDays("KECE");

  // Stok değeri (para birimine göre)
  const valueByCurrency = new Map<string, number>();
  for (const p of stockProducts) {
    valueByCurrency.set(
      p.currency,
      (valueByCurrency.get(p.currency) ?? 0) + Number(p.unitPrice)
    );
  }
  const stockValueText =
    [...valueByCurrency.entries()].map(([c, v]) => fmtMoney(v, c)).join(" + ") || fmtMoney(0);

  // Kritik stok: pozisyon başına stoktaki yedek < minStock
  const availByPos = new Map<number, number>();
  for (const p of stockProducts) {
    if (p.positionId) availByPos.set(p.positionId, (availByPos.get(p.positionId) ?? 0) + 1);
  }
  const criticalStock = positions
    .map((pos) => ({ pos, avail: availByPos.get(pos.id) ?? 0 }))
    .filter(({ pos, avail }) => avail < pos.minStock);

  // Aktif montajların ömür bilgileri
  const activesWithLife = activeInstalls.map((i) => ({
    ...i,
    life: calcLife(i.installDate, i.expectedLifeDays),
  }));
  const upcoming = activesWithLife
    .filter((i) => i.life.usedPct >= 80)
    .sort((a, b) => b.life.usedPct - a.life.usedPct);
  const totalActiveDays = activesWithLife.reduce((a, i) => a + i.life.workingDays, 0);
  const totalActiveHours = activesWithLife.reduce((a, i) => a + i.life.workingHours, 0);

  // Makine durumu kartları
  const activeByPos = new Map(activesWithLife.map((i) => [i.positionId, i]));
  const machines = [...new Set(positions.map((p) => p.machineName))];

  return (
    <>
      <Flash sp={sp} />
      <h1>Ana Sayfa</h1>

      <div className="kpi-grid">
        <div className="kpi"><div className="v">{aktifElek}</div><div className="l">Aktif Elek</div></div>
        <div className="kpi"><div className="v">{aktifKece}</div><div className="l">Aktif Keçe</div></div>
        <div className="kpi info"><div className="v">{stokElek}</div><div className="l">Stoktaki Elek</div></div>
        <div className="kpi info"><div className="v">{stokKece}</div><div className="l">Stoktaki Keçe</div></div>
        <div className={`kpi ${criticalStock.length ? "danger" : ""}`}>
          <div className="v">{criticalStock.length}</div><div className="l">Kritik Stok (Pozisyon)</div>
        </div>
        <div className="kpi"><div className="v">{buAyDegisen}</div><div className="l">Bu Ay Değiştirilen</div></div>
        <div className="kpi"><div className="v">{ortElek === null ? "—" : `${fmtNum(ortElek)} gün`}</div><div className="l">Ortalama Elek Ömrü</div></div>
        <div className="kpi"><div className="v">{ortKece === null ? "—" : `${fmtNum(ortKece)} gün`}</div><div className="l">Ortalama Keçe Ömrü</div></div>
        <div className="kpi info"><div className="v" style={{ fontSize: 17 }}>{stockValueText}</div><div className="l">Toplam Stok Değeri</div></div>
        <div className="kpi">
          <div className="v">{fmtNum(totalActiveDays)} gün</div>
          <div className="l">Aktif Toplam Çalışma ({fmtNum(totalActiveHours)} saat)</div>
        </div>
      </div>

      {(criticalStock.length > 0 || upcoming.length > 0) && (
        <div className="panel" style={{ borderLeft: "4px solid var(--warn)" }}>
          <h2>🔔 Akıllı Uyarılar</h2>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {criticalStock.map(({ pos, avail }) => (
              <li key={`s${pos.id}`}>
                <strong>Stok kritik seviyede:</strong> {pos.machineName} / {pos.name} —
                stokta {avail} adet var, asgari {pos.minStock} olmalı.{" "}
                <Link href="/stok">Stoğa git</Link>
              </li>
            ))}
            {upcoming.map((i) => (
              <li key={`l${i.id}`}>
                <strong>
                  {i.life.usedPct >= 100
                    ? "Tahmini ömür aşıldı:"
                    : i.life.usedPct >= 90
                      ? "Ömrünün %90'ına ulaştı:"
                      : "Ömrünün %80'ine ulaştı:"}
                </strong>{" "}
                {i.product.code} — {i.position.machineName} / {i.position.name} (%{i.life.usedPct}).{" "}
                {i.life.remainingDays > 0 && i.life.remainingDays <= 7 && (
                  <em>Yaklaşan planlı değişim: ~{i.life.remainingDays} gün. </em>
                )}
                <Link href={`/urunler/${i.productId}`}>Karta git</Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="panel-grid">
        <div className="panel">
          <h2>⏳ Yaklaşan Değişimler</h2>
          {upcoming.length === 0 ? (
            <p className="muted">Ömrünün %80'ine yaklaşan malzeme yok.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Pozisyon</th><th>Ürün</th><th>Ömür</th><th>Durum</th></tr>
                </thead>
                <tbody>
                  {upcoming.map((i) => (
                    <tr key={i.id}>
                      <td>{i.position.machineName} / {i.position.name}</td>
                      <td>
                        <Link href={`/urunler/${i.productId}`}>{i.product.code}</Link>
                        <br /><small>{i.product.manufacturer?.name ?? ""} {i.product.productCode}</small>
                      </td>
                      <td><LifeBar life={i.life} /></td>
                      <td><LifeBadge life={i.life} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="panel">
          <h2>🔄 Son Hareketler</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Tarih</th><th>Kullanıcı</th><th>İşlem</th></tr>
              </thead>
              <tbody>
                {recentLogs.map((l) => (
                  <tr key={l.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{fmtDateTime(l.createdAt)}</td>
                    <td>{l.user?.fullName ?? "—"}</td>
                    <td>{l.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ marginBottom: 0 }}>
            <Link href="/hareketler">Tüm işlem geçmişi →</Link>
          </p>
        </div>
      </div>

      {machines.map((m) => (
        <div className="panel" key={m}>
          <h2>🏭 Makine Durumu — {m}</h2>
          <div className="machine-grid">
            {positions
              .filter((p) => p.machineName === m)
              .map((pos) => {
                const inst = activeByPos.get(pos.id);
                return (
                  <div key={pos.id} className={`pos-card ${inst ? inst.life.status : "empty"}`}>
                    <div className="pos-name">
                      {pos.name} <TypeBadge type={pos.type} />
                    </div>
                    {inst ? (
                      <>
                        <div className="prod">
                          <Link href={`/urunler/${inst.productId}`}>
                            <strong>{inst.product.code}</strong>
                          </Link>{" "}
                          {inst.product.manufacturer?.name ?? ""}
                          <br />
                          <small>Montaj: {fmtDate(inst.installDate)}</small>
                        </div>
                        <LifeBar life={inst.life} />
                        <div style={{ marginTop: 6 }}>
                          <LifeBadge life={inst.life} />
                        </div>
                      </>
                    ) : (
                      <div className="prod muted">
                        Boş — takılı ürün yok
                        <div style={{ marginTop: 6 }}>
                          <StatusBadge status="STOKTA" />{" "}
                          <small>{availByPos.get(pos.id) ?? 0} yedek stokta</small>
                        </div>
                      </div>
                    )}
                    <div style={{ marginTop: 8 }}>
                      <Link className="btn sm" href={`/pozisyonlar/${pos.id}/gecmis`}>
                        Geçmiş
                      </Link>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ))}
    </>
  );
}
