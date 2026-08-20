import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { getPermSet } from "@/lib/perm";
import { redirect } from "next/navigation";
import { fmtDate, fmtMoney } from "@/lib/format";
import { getLocale } from "@/lib/locale-server";
import { tFor } from "@/lib/i18n";
import { trPos } from "@/lib/dynamic-i18n";
import { Flash, StatusBadge, TypeBadge } from "@/components/ui";
import { STATUS_LABELS } from "@/lib/life";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const s = await requireSession();
  const perms = await getPermSet(s.role);
  if (!perms.has("sayfa_urunler")) redirect("/?hata=Bu%20sayfa%20i%C3%A7in%20yetkiniz%20yok.");
  const locale = await getLocale();
  const t = tFor(locale);
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
      <Flash sp={sp} t={t} />
      <div className="page-head">
        <h1>{t("Elek / Keçe Kartları")}</h1>
        {perms.has("islem_urun") && (
          <Link href="/urunler/yeni" className="btn primary">{t("+ Yeni Kayıt / Stok Girişi")}</Link>
        )}
      </div>

      <form method="get" className="filters no-print">
        <label>
          {t("Ara")}
          <input type="search" name="q" defaultValue={q} placeholder={t("Kod, seri no, üretici...")} />
        </label>
        <label>
          {t("Tip")}
          <select name="tip" defaultValue={type ?? ""}>
            <option value="">{t("Tümü")}</option>
            <option value="ELEK">{t("Elek")}</option>
            <option value="KECE">{t("Keçe")}</option>
          </select>
        </label>
        <label>
          {t("Durum")}
          <select name="durum" defaultValue={status ?? ""}>
            <option value="">{t("Tümü")}</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{t(v)}</option>
            ))}
          </select>
        </label>
        <button className="btn" type="submit">{t("Filtrele")}</button>
      </form>

      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t("Sistem ID")}</th><th>{t("Tip")}</th><th>{t("Üretici / Ürün Kodu")}</th><th>{t("Seri No")}</th>
              <th>{t("Pozisyon")}</th><th>{t("Ebat (mm)")}</th><th>{t("Birim Fiyat")}</th><th>{t("Ömür (gün)")}</th>
              <th>{t("Durum")}</th><th>{t("Stok Girişi")}</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td><Link href={`/urunler/${p.id}`}><strong>{p.code}</strong></Link></td>
                <td><TypeBadge type={p.type} locale={locale} /></td>
                <td>{p.manufacturer?.name ?? "—"}<br /><small>{p.brand} {p.productCode}</small></td>
                <td>{p.serialNo || "—"}</td>
                <td>{p.position ? trPos(p.position.name, locale) : "—"}</td>
                <td>{p.widthMm ?? "—"} × {p.lengthMm ?? "—"}</td>
                <td style={{ whiteSpace: "nowrap" }}>{fmtMoney(Number(p.unitPrice), p.currency)}</td>
                <td>{p.expectedLifeDays}</td>
                <td><StatusBadge status={p.status} locale={locale} /></td>
                <td>{fmtDate(p.stockDate)}</td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr><td colSpan={10} className="muted">{t("Kayıt bulunamadı.")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
