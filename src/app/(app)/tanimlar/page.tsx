import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { getPermSet } from "@/lib/perm";
import { redirect } from "next/navigation";
import {
  createNamedAction,
  createReasonAction,
  deleteNamedAction,
  deleteReasonAction,
} from "@/lib/actions";
import { Flash } from "@/components/ui";
import ConfirmButton from "@/components/ConfirmButton";

export const dynamic = "force-dynamic";

export default async function DefinitionsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; hata?: string }>;
}) {
  const s = await requireSession();
  const perms = await getPermSet(s.role);
  if (!perms.has("islem_tanim")) redirect("/?hata=Bu%20sayfa%20i%C3%A7in%20yetkiniz%20yok.");
  const sp = await searchParams;

  const [reasons, manufacturers, suppliers] = await Promise.all([
    prisma.failureReason.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { installations: true } } },
    }),
    prisma.manufacturer.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
    }),
    prisma.supplier.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
    }),
  ]);

  const createManufacturer = createNamedAction.bind(null, "manufacturer");
  const createSupplier = createNamedAction.bind(null, "supplier");

  return (
    <>
      <Flash sp={sp} />
      <h1>Tanımlar</h1>

      <div className="panel-grid">
        <div className="panel">
          <h2>Söküm / Değişim Nedenleri</h2>
          <form action={createReasonAction} className="inline-form">
            <label>Neden<input type="text" name="name" required placeholder="örn. Vakum hasarı" /></label>
            <label>Tür
              <select name="planned">
                <option value="0">Plansız</option>
                <option value="1">Planlı</option>
              </select>
            </label>
            <button className="btn primary sm" type="submit">Ekle</button>
          </form>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Neden</th><th>Tür</th><th>Kullanım</th><th></th></tr></thead>
              <tbody>
                {reasons.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td>{r.planned ? <span className="badge green">Planlı</span> : <span className="badge orange">Plansız</span>}</td>
                    <td>{r._count.installations}</td>
                    <td>
                      <form action={deleteReasonAction.bind(null, r.id)}>
                        <ConfirmButton message={`"${r.name}" nedeni silinecek. Emin misiniz?`} className="btn sm">Sil</ConfirmButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <h2>Üreticiler</h2>
          <form action={createManufacturer} className="inline-form">
            <label>Üretici Adı<input type="text" name="name" required /></label>
            <button className="btn primary sm" type="submit">Ekle</button>
          </form>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Üretici</th><th>Ürün Sayısı</th><th></th></tr></thead>
              <tbody>
                {manufacturers.map((m) => (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    <td>{m._count.products}</td>
                    <td>
                      <form action={deleteNamedAction.bind(null, "manufacturer", m.id)}>
                        <ConfirmButton message={`"${m.name}" silinecek. Emin misiniz?`} className="btn sm">Sil</ConfirmButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 style={{ marginTop: 18 }}>Tedarikçiler</h2>
          <form action={createSupplier} className="inline-form">
            <label>Tedarikçi Adı<input type="text" name="name" required /></label>
            <button className="btn primary sm" type="submit">Ekle</button>
          </form>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Tedarikçi</th><th>Ürün Sayısı</th><th></th></tr></thead>
              <tbody>
                {suppliers.map((m) => (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    <td>{m._count.products}</td>
                    <td>
                      <form action={deleteNamedAction.bind(null, "supplier", m.id)}>
                        <ConfirmButton message={`"${m.name}" silinecek. Emin misiniz?`} className="btn sm">Sil</ConfirmButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
