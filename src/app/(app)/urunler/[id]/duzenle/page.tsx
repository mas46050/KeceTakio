import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { getPermSet } from "@/lib/perm";
import { notFound, redirect } from "next/navigation";
import { updateProductAction } from "@/lib/actions";
import ProductForm from "@/components/ProductForm";
import { Flash } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; hata?: string }>;
}) {
  const s = await requireSession();
  const { id } = await params;
  const sp = await searchParams;
  const perms = await getPermSet(s.role);
  if (!perms.has("islem_urun")) redirect(`/urunler/${id}?hata=Bu%20i%C5%9Flem%20i%C3%A7in%20yetkiniz%20yok.`);
  const productId = Number(id);
  const product = await prisma.product.findFirst({
    where: { id: productId, deletedAt: null },
  });
  if (!product) notFound();
  const [positions, manufacturers, suppliers] = await Promise.all([
    prisma.position.findMany({
      where: { deletedAt: null },
      orderBy: [{ machineName: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.manufacturer.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
  ]);
  const action = updateProductAction.bind(null, productId);
  return (
    <>
      <Flash sp={sp} />
      <h1>Kart Düzenle — {product.code}</h1>
      <ProductForm
        action={action}
        product={product}
        positions={positions}
        manufacturers={manufacturers}
        suppliers={suppliers}
      />
    </>
  );
}
