import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { getPermSet } from "@/lib/perm";
import { redirect } from "next/navigation";
import { fmtDate } from "@/lib/format";
import { getLocale } from "@/lib/locale-server";
import { tFor } from "@/lib/i18n";

import { StatusBadge, TypeBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const s = await requireSession();
  const perms = await getPermSet(s.role);
  if (!perms.has("sayfa_urunler")) redirect("/?hata=Bu%20sayfa%20i%C3%A7in%20yetkiniz%20yok.");
  const locale = await getLocale();
  const t = tFor(locale);
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
      <h1>{t("Arama")}</h1>
      <form method="get" className="filters">
        <label style={{ maxWidth: 420 }}>
          {t("Arama (seri no, ürün kodu, üretici, pozisyon, barkod/QR)")}
          <input type="search" name="q" defaultValue={q} autoFocus />
        </label>
        <button className="btn primary" type="submit">{t("Ara")}</button>
      </form>

      {q && (
        <div className="panel table-wrap">
          <p className="muted">&quot;{q}&quot; için {products.length} {t("sonuç bulundu.")}</p>
          <table>
            <thead>
              <tr>
                <th>{t("Sistem ID")}</th><th>{t("Tip")}</th><th>{t("Üretici")}</th><th>{t("Ürün Kodu")}</th>
                <th>{t("Seri No")}</th><th>{t("Pozisyon")}</th><th>{t("Durum")}</th><th>{t("Stok Girişi")}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td><Link href={`/urunler/${p.id}`}><strong>{p.code}</strong></Link></td>
                  <td><TypeBadge type={p.type} locale={locale} /></td>
                  <td>{p.manufacturer?.name ?? "—"}</td>
                  <td>{p.productCode || "—"}</td>
                  <td>{p.serialNo || "—"}</td>
                  <td>{p.position?.name ?? "—"}</td>
                  <td><StatusBadge status={p.status} locale={locale} /></td>
                  <td>{fmtDate(p.stockDate)}</td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr><td colSpan={8} className="muted">{t("Sonuç bulunamadı.")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
