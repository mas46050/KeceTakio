import Link from "next/link";
import { prisma } from "@/lib/db";
import { calcLife } from "@/lib/life";
import { fmtDate, fmtDateTime, fmtMoney, fmtNum } from "@/lib/format";
import { getLocale } from "@/lib/locale-server";
import { tFor } from "@/lib/i18n";
import { Flash, LifeBar, LifeBadge, StatusBadge, TypeBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; hata?: string }>;
}) {
  const sp = await searchParams;
  const locale = await getLocale();
  const t = tFor(locale);

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

  const valueByCurrency = new Map<string, number>();
  for (const p of stockProducts) {
    valueByCurrency.set(
      p.currency,
      (valueByCurrency.get(p.currency) ?? 0) + Number(p.unitPrice)
    );
  }
  const stockValueText =
    [...valueByCurrency.entries()].map(([c, v]) => fmtMoney(v, c)).join(" + ") || fmtMoney(0);

  const availByPos = new Map<number, number>();
  for (const p of stockProducts) {
    if (p.positionId) availByPos.set(p.positionId, (availByPos.get(p.positionId) ?? 0) + 1);
  }
  const criticalStock = positions
    .map((pos) => ({ pos, avail: availByPos.get(pos.id) ?? 0 }))
    .filter(({ pos, avail }) => avail < pos.minStock);

  const activesWithLife = activeInstalls.map((i) => ({
    ...i,
    life: calcLife(i.installDate, i.expectedLifeDays),
  }));
  const upcoming = activesWithLife
    .filter((i) => i.life.usedPct >= 80)
    .sort((a, b) => b.life.usedPct - a.life.usedPct);
  const totalActiveDays = activesWithLife.reduce((a, i) => a + i.life.workingDays, 0);
  const totalActiveHours = activesWithLife.reduce((a, i) => a + i.life.workingHours, 0);

  const activeByPos = new Map(activesWithLife.map((i) => [i.positionId, i]));
  const machines = [...new Set(positions.map((p) => p.machineName))];

  return (
    <>
      <Flash sp={sp} t={t} />
      <h1>{t("Ana Sayfa")}</h1>

      <div className="kpi-grid">
        <div className="kpi"><div className="v">{aktifElek}</div><div className="l">{t("Aktif Elek")}</div></div>
        <div className="kpi"><div className="v">{aktifKece}</div><div className="l">{t("Aktif Keçe")}</div></div>
        <div className="kpi info"><div className="v">{stokElek}</div><div className="l">{t("Stoktaki Elek")}</div></div>
        <div className="kpi info"><div className="v">{stokKece}</div><div className="l">{t("Stoktaki Keçe")}</div></div>
        <div className={`kpi ${criticalStock.length ? "danger" : ""}`}>
          <div className="v">{criticalStock.length}</div><div className="l">{t("Kritik Stok (Pozisyon)")}</div>
        </div>
        <div className="kpi"><div className="v">{buAyDegisen}</div><div className="l">{t("Bu Ay Değiştirilen")}</div></div>
        <div className="kpi"><div className="v">{ortElek === null ? "—" : `${fmtNum(ortElek)} ${t("gün")}`}</div><div className="l">{t("Ortalama Elek Ömrü")}</div></div>
        <div className="kpi"><div className="v">{ortKece === null ? "—" : `${fmtNum(ortKece)} ${t("gün")}`}</div><div className="l">{t("Ortalama Keçe Ömrü")}</div></div>
        <div className="kpi info"><div className="v" style={{ fontSize: 17 }}>{stockValueText}</div><div className="l">{t("Toplam Stok Değeri")}</div></div>
        <div className="kpi">
          <div className="v">{fmtNum(totalActiveDays)} {t("gün")}</div>
          <div className="l">{t("Aktif Toplam Çalışma")} ({fmtNum(totalActiveHours)} {t("saat")})</div>
        </div>
      </div>

      {(criticalStock.length > 0 || upcoming.length > 0) && (
        <div className="panel" style={{ borderLeft: "4px solid var(--warn)" }}>
          <h2>🔔 {t("Akıllı Uyarılar")}</h2>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {criticalStock.map(({ pos, avail }) => (
              <li key={`s${pos.id}`}>
                <strong>{t("Stok kritik seviyede")}:</strong> {pos.machineName} / {pos.name} —{" "}
                {avail} {t("adet var, asgari")} {pos.minStock}.{" "}
                <Link href="/stok">{t("Stoğa git")}</Link>
              </li>
            ))}
            {upcoming.map((i) => (
              <li key={`l${i.id}`}>
                <strong>
                  {i.life.usedPct >= 100
                    ? t("Tahmini ömür aşıldı")
                    : i.life.usedPct >= 90
                      ? t("Ömrünün %90'ına ulaştı")
                      : t("Ömrünün %80'ine ulaştı")}
                  :
                </strong>{" "}
                {i.product.code} — {i.position.machineName} / {i.position.name} (%{i.life.usedPct}).{" "}
                {i.life.remainingDays > 0 && i.life.remainingDays <= 7 && (
                  <em>{t("Yaklaşan planlı değişim")}: ~{i.life.remainingDays} {t("gün")}. </em>
                )}
                <Link href={`/urunler/${i.productId}`}>{t("Karta git")}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="panel-grid">
        <div className="panel">
          <h2>⏳ {t("Yaklaşan Değişimler")}</h2>
          {upcoming.length === 0 ? (
            <p className="muted">{t("Ömrünün %80'ine yaklaşan malzeme yok.")}</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>{t("Pozisyon")}</th><th>{t("Ürün")}</th><th>{t("Ömür")}</th><th>{t("Durum")}</th></tr>
                </thead>
                <tbody>
                  {upcoming.map((i) => (
                    <tr key={i.id}>
                      <td>{i.position.machineName} / {i.position.name}</td>
                      <td>
                        <Link href={`/urunler/${i.productId}`}>{i.product.code}</Link>
                        <br /><small>{i.product.manufacturer?.name ?? ""} {i.product.productCode}</small>
                      </td>
                      <td><LifeBar life={i.life} locale={locale} /></td>
                      <td><LifeBadge life={i.life} locale={locale} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="panel">
          <h2>🔄 {t("Son Hareketler")}</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>{t("Tarih")}</th><th>{t("Kullanıcı")}</th><th>{t("İşlem")}</th></tr>
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
            <Link href="/hareketler">{t("Tüm işlem geçmişi →")}</Link>
          </p>
        </div>
      </div>

      {machines.map((m) => (
        <div className="panel" key={m}>
          <h2>🏭 {t("Makine Durumu")} — {m}</h2>
          <div className="machine-grid">
            {positions
              .filter((p) => p.machineName === m)
              .map((pos) => {
                const inst = activeByPos.get(pos.id);
                return (
                  <div key={pos.id} className={`pos-card ${inst ? inst.life.status : "empty"}`}>
                    <div className="pos-name">
                      {pos.name} <TypeBadge type={pos.type} locale={locale} />
                    </div>
                    {inst ? (
                      <>
                        <div className="prod">
                          <Link href={`/urunler/${inst.productId}`}>
                            <strong>{inst.product.code}</strong>
                          </Link>{" "}
                          {inst.product.manufacturer?.name ?? ""}
                          <br />
                          <small>{t("Montaj")}: {fmtDate(inst.installDate)}</small>
                        </div>
                        <LifeBar life={inst.life} locale={locale} />
                        <div style={{ marginTop: 6 }}>
                          <LifeBadge life={inst.life} locale={locale} />
                        </div>
                      </>
                    ) : (
                      <div className="prod muted">
                        {t("Boş — takılı ürün yok")}
                        <div style={{ marginTop: 6 }}>
                          <StatusBadge status="STOKTA" locale={locale} />{" "}
                          <small>{availByPos.get(pos.id) ?? 0} {t("yedek stokta")}</small>
                        </div>
                      </div>
                    )}
                    <div style={{ marginTop: 8 }}>
                      <Link className="btn sm" href={`/pozisyonlar/${pos.id}/gecmis`}>
                        {t("Geçmiş")}
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
