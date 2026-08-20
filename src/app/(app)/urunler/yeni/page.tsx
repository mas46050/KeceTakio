import { prisma } from "@/lib/db";
import { requireSession, canOperate } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createProductAction } from "@/lib/actions";
import ProductForm from "@/components/ProductForm";
import { Flash } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; hata?: string }>;
}) {
  const s = await requireSession();
  if (!canOperate(s)) redirect("/urunler?hata=Bu%20i%C5%9Flem%20i%C3%A7in%20yetkiniz%20yok.");
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
      <Flash sp={sp} />
      <h1>Yeni Elek / Keçe Kaydı</h1>
      <p className="muted">
        Kayıt oluşturulduğunda sistem benzersiz bir Sistem ID (QR/barkod) üretir ve ürün
        &quot;Stokta&quot; durumuyla stoğa alınır.
      </p>
      <ProductForm
        action={createProductAction}
        positions={positions}
        manufacturers={manufacturers}
        suppliers={suppliers}
      />
    </>
  );
}
