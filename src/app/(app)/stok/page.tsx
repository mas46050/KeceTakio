import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { getPermSet } from "@/lib/perm";
import { redirect } from "next/navigation";
import { fmtDate, fmtMoney } from "@/lib/format";
import { Flash, StatusBadge, TypeBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

const STOCK_STATUSES = ["YENI", "STOKTA", "REZERVE", "KULLANILMIS", "TAMIRDE"] as const;

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const s = await requireSession();
  const perms = await getPermSet(s.role);
  if (!perms.has("sayfa_stok")) redirect("/?hata=Bu%20sayfa%20i%C3%A7in%20yetkiniz%20yok.");
  const sp = await searchParams;
  const type = sp.tip === "ELEK" || sp.tip === "KECE" ? sp.tip : undefined;

  const [items, positions] = await Promise.all([
    prisma.product.findMany({
      where: {
        deletedAt: null,
        status: { in: [...STOCK_STATUSES] },
        ...(type ? { type } : {}),
      },
      include: { manufacturer: true, position: true },
      orderBy: [{ type: "asc" }, { id: "desc" }],
    }),
    prisma.position.findMany({
      where: { deletedAt: null },
      orderBy: [{ machineName: "asc" }, { sortOrder: "asc" }],
    }),
  ]);

  // Pozisyon başına kullanılabilir stok (YENI + STOKTA)
  const availByPos = new Map<number, number>();
  for (const p of items) {
    if (p.positionId && (p.status === "YENI" || p.status === "STOKTA")) {
      availByPos.set(p.positionId, (availByPos.get(p.positionId) ?? 0) + 1);
    }
  }
  const critical = positions.filter((pos) => (availByPos.get(pos.id) ?? 0) < pos.minStock);

  const totalByCurrency = new Map<string, number>();
  for (const p of items) {
    if (p.status === "YENI" || p.status === "STOKTA" || p.status === "REZERVE") {
      totalByCurrency.set(p.currency, (totalByCurrency.get(p.currency) ?? 0) + Number(p.unitPrice));
    }
  }

  return (
    <>
      <Flash sp={sp} />
      <div className="page-head">
        <h1>Stok Yönetimi</h1>
        {perms.has("islem_urun") && (
          <Link href="/urunler/yeni" className="btn primary">+ Stok Girişi</Link>
        )}
      </div>

      <div className="kpi-grid">
        <div className="kpi info">
          <div className="v">{items.filter((i) => i.type === "ELEK" && (i.status === "YENI" || i.status === "STOKTA")).length}</div>
          <div className="l">Stoktaki Elek</div>
        </div>
        <div className="kpi info">
          <div className="v">{items.filter((i) => i.type === "KECE" && (i.status === "YENI" || i.status === "STOKTA")).length}</div>
          <div className="l">Stoktaki Keçe</div>
        </div>
        <div className={`kpi ${critical.length ? "danger" : ""}`}>
          <div className="v">{critical.length}</div>
          <div className="l">Kritik Stok (Pozisyon)</div>
        </div>
        <div className="kpi">
          <div className="v" style={{ fontSize: 17 }}>
            {[...totalByCurrency.entries()].map(([c, v]) => fmtMoney(v, c)).join(" + ") || fmtMoney(0)}
          </div>
          <div className="l">Toplam Stok Değeri</div>
        </div>
      </div>

      {critical.length > 0 && (
        <div className="panel" style={{ borderLeft: "4px solid var(--danger)" }}>
          <h2>⚠️ Kritik Stok</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Pozisyon</th><th>Tip</th><th>Stoktaki Yedek</th><th>Asgari</th></tr></thead>
              <tbody>
                {critical.map((pos) => (
                  <tr key={pos.id}>
                    <td>{pos.machineName} / {pos.name}</td>
                    <td><TypeBadge type={pos.type} /></td>
                    <td style={{ color: "var(--danger)", fontWeight: 700 }}>{availByPos.get(pos.id) ?? 0}</td>
                    <td>{pos.minStock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <form method="get" className="filters no-print">
        <label>
          Tip
          <select name="tip" defaultValue={type ?? ""}>
            <option value="">Tümü</option>
            <option value="ELEK">Elek</option>
            <option value="KECE">Keçe</option>
          </select>
        </label>
        <button className="btn" type="submit">Filtrele</button>
      </form>

      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ürün</th><th>Tip</th><th>Pozisyon</th><th>Üretici</th><th>Seri No</th>
              <th>Stok Girişi</th><th>Miktar</th><th>Birim Fiyat</th><th>Toplam Değer</th>
              <th>Depo</th><th>Raf</th><th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td><Link href={`/urunler/${p.id}`}><strong>{p.code}</strong></Link><br /><small>{p.brand} {p.productCode}</small></td>
                <td><TypeBadge type={p.type} /></td>
                <td>{p.position?.name ?? "—"}</td>
                <td>{p.manufacturer?.name ?? "—"}</td>
                <td>{p.serialNo || "—"}</td>
                <td>{fmtDate(p.stockDate)}</td>
                <td>1</td>
                <td style={{ whiteSpace: "nowrap" }}>{fmtMoney(Number(p.unitPrice), p.currency)}</td>
                <td style={{ whiteSpace: "nowrap" }}>{fmtMoney(Number(p.unitPrice), p.currency)}</td>
                <td>{p.warehouseLocation || "—"}</td>
                <td>{p.shelfLocation || "—"}</td>
                <td><StatusBadge status={p.status} /></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={12} className="muted">Stokta ürün yok.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
