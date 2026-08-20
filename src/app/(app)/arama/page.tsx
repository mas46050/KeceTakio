import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { StatusBadge, TypeBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireSession();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();

  const products = q
    ? await prisma.product.findMany({
        where: {
          deletedAt: null,
          OR: [
            { code: { contains: q, mode: "insensitive" } },
            { serialNo: { contains: q, mode: "insensitive" } },
            { productCode: { contains: q, mode: "insensitive" } },
            { orderNo: { contains: q, mode: "insensitive" } },
            { brand: { contains: q, mode: "insensitive" } },
            { manufacturer: { name: { contains: q, mode: "insensitive" } } },
            { position: { name: { contains: q, mode: "insensitive" } } },
          ],
        },
        include: { manufacturer: true, position: true },
        orderBy: { id: "desc" },
        take: 100,
      })
    : [];

  return (
    <>
      <h1>Arama</h1>
      <form method="get" className="filters">
        <label style={{ maxWidth: 420 }}>
          Arama (seri no, ürün kodu, üretici, pozisyon, barkod/QR)
          <input type="search" name="q" defaultValue={q} autoFocus />
        </label>
        <button className="btn primary" type="submit">Ara</button>
      </form>

      {q && (
        <div className="panel table-wrap">
          <p className="muted">&quot;{q}&quot; için {products.length} sonuç bulundu.</p>
          <table>
            <thead>
              <tr>
                <th>Sistem ID</th><th>Tip</th><th>Üretici</th><th>Ürün Kodu</th>
                <th>Seri No</th><th>Pozisyon</th><th>Durum</th><th>Stok Girişi</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td><Link href={`/urunler/${p.id}`}><strong>{p.code}</strong></Link></td>
                  <td><TypeBadge type={p.type} /></td>
                  <td>{p.manufacturer?.name ?? "—"}</td>
                  <td>{p.productCode || "—"}</td>
                  <td>{p.serialNo || "—"}</td>
                  <td>{p.position?.name ?? "—"}</td>
                  <td><StatusBadge status={p.status} /></td>
                  <td>{fmtDate(p.stockDate)}</td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr><td colSpan={8} className="muted">Sonuç bulunamadı.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
