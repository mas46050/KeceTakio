import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { getPermSet } from "@/lib/perm";
import { redirect } from "next/navigation";
import { createProductAction } from "@/lib/actions";
import { getLocale } from "@/lib/locale-server";
import { tFor } from "@/lib/i18n";
import ProductForm from "@/components/ProductForm";
import { Flash } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; hata?: string }>;
}) {
  const s = await requireSession();
  const perms = await getPermSet(s.role);
  if (!perms.has("islem_urun")) redirect("/urunler?hata=Bu%20i%C5%9Flem%20i%C3%A7in%20yetkiniz%20yok.");
  const locale = await getLocale();
  const t = tFor(locale);
  const sp = await searchParams;
  const [positions, manufacturers, suppliers] = await Promise.all([
    prisma.position.findMany({
      where: { deletedAt: null },
      orderBy: [{ machineName: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.manufacturer.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
  ]);
  return (
    <>
      <Flash sp={sp} t={t} />
      <h1>{t("Yeni Elek / Keçe Kaydı")}</h1>
      <p className="muted">
        {t("Kayıt oluşturulduğunda sistem benzersiz bir Sistem ID (QR/barkod) üretir ve ürün \"Stokta\" durumuyla stoğa alınır.")}
      </p>
      <ProductForm
        action={createProductAction}
        positions={positions}
        manufacturers={manufacturers}
        suppliers={suppliers}
        locale={locale}
      />
    </>
  );
}
