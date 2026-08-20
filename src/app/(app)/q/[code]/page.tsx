import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";

// QR kod hedefi: sistem kodundan ürün detayına yönlendirir
export default async function QrRedirectPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  await requireSession();
  const { code } = await params;
  const product = await prisma.product.findFirst({
    where: { code: decodeURIComponent(code), deletedAt: null },
    select: { id: true },
  });
  if (!product) notFound();
  redirect(`/urunler/${product.id}`);
}
