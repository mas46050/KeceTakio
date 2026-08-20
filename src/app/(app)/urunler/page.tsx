import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession, canOperate } from "@/lib/auth";
import { fmtDate, fmtMoney } from "@/lib/format";
import { Flash, StatusBadge, TypeBadge } from "@/components/ui";
import { STATUS_LABELS } from "@/lib/life";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const s = await requireSession();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const type = sp.tip === "ELEK" || sp.tip === "KECE" ? sp.tip : undefined;
  const status = sp.durum && STATUS_LABELS[sp.durum] ? sp.durum : undefined;

  const products = await prisma.product.findMany({
    where: {
      deletedAt: null,
      ...(type ? { type } : {}),
      ...(status ? { status: status as never } : {}),
      ...(q
        ? {
            OR: [
              { code: { contains: q, mode: "insensitive" } },
              { serialNo: { contains: q, mode: "insensitive" } },
              { productCode: { contains: q, mode: "insensitive" } },
              { brand: { contains: q, mode: "insensitive" } },
              { manufacturer: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: { manufacturer: true, position: true },
    orderBy: { id: "desc" },
    take: 300,
  });

  return (
    <>
      <Flash sp={sp} />
      <div className="page-head">
        <h1>Elek / Keçe Kartları</h1>
        {canOperate(s) && (
          <Link href="/urunler/yeni" className="btn primary">+ Yeni Kayıt / Stok Girişi</Link>
        )}
      </div>

      <form method="get" className="filters no-print">
        <label>
          Ara
          <input type="search" name="q" defaultValue={q} placeholder="Kod, seri no, üretici..." />
        </label>
        <label>
          Tip
          <select name="tip" defaultValue={type ?? ""}>
            <option value="">Tümü</option>
            <option value="ELEK">Elek</option>
            <option value="KECE">Keçe</option>
          </select>
        </label>
        <label>
          Durum
          <select name="durum" defaultValue={status ?? ""}>
            <option value="">Tümü</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <button className="btn" type="submit">Filtrele</button>
      </form>

      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Sistem ID</th><th>Tip</th><th>Üretici / Ürün Kodu</th><th>Seri No</th>
              <th>Pozisyon</th><th>Ebat (mm)</th><th>Birim Fiyat</th><th>Ömür (gün)</th>
              <th>Durum</th><th>Stok Girişi</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td><Link href={`/urunler/${p.id}`}><strong>{p.code}</strong></Link></td>
                <td><TypeBadge type={p.type} /></td>
                <td>{p.manufacturer?.name ?? "—"}<br /><small>{p.brand} {p.productCode}</small></td>
                <td>{p.serialNo || "—"}</td>
                <td>{p.position ? p.position.name : "—"}</td>
                <td>{p.widthMm ?? "—"} × {p.lengthMm ?? "—"}</td>
                <td style={{ whiteSpace: "nowrap" }}>{fmtMoney(Number(p.unitPrice), p.currency)}</td>
                <td>{p.expectedLifeDays}</td>
                <td><StatusBadge status={p.status} /></td>
                <td>{fmtDate(p.stockDate)}</td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr><td colSpan={10} className="muted">Kayıt bulunamadı.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
