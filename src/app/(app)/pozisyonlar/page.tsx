import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { getPermSet } from "@/lib/perm";
import { redirect } from "next/navigation";
import { createPositionAction, deletePositionAction, updatePositionAction } from "@/lib/actions";
import { calcLife } from "@/lib/life";
import { Flash, LifeBar, TypeBadge } from "@/components/ui";
import ConfirmButton from "@/components/ConfirmButton";

export const dynamic = "force-dynamic";

export default async function PositionsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; hata?: string }>;
}) {
  const s = await requireSession();
  const perms = await getPermSet(s.role);
  if (!perms.has("sayfa_pozisyonlar")) redirect("/?hata=Bu%20sayfa%20i%C3%A7in%20yetkiniz%20yok.");
  const sp = await searchParams;
  const admin = perms.has("islem_tanim");

  const positions = await prisma.position.findMany({
    where: { deletedAt: null },
    orderBy: [{ machineName: "asc" }, { sortOrder: "asc" }],
    include: {
      installations: {
        where: { active: true },
        include: { product: true },
      },
      _count: { select: { installations: true } },
    },
  });

  return (
    <>
      <Flash sp={sp} />
      <h1>Pozisyonlar &amp; Geçmiş</h1>

      {admin && (
        <div className="panel">
          <h2>Yeni Pozisyon Ekle</h2>
          <form action={createPositionAction} className="inline-form">
            <label>Makine<input type="text" name="machineName" defaultValue="PM-1" /></label>
            <label>Pozisyon Adı<input type="text" name="name" required placeholder="örn. 5. Press Keçesi" /></label>
            <label>Tip
              <select name="type">
                <option value="KECE">Keçe</option>
                <option value="ELEK">Elek</option>
              </select>
            </label>
            <label>Asgari Stok<input type="text" inputMode="numeric" name="minStock" defaultValue="1" /></label>
            <button className="btn primary sm" type="submit">Ekle</button>
          </form>
        </div>
      )}

      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Makine</th><th>Pozisyon</th><th>Tip</th><th>Takılı Ürün</th><th>Ömür</th>
              <th>Toplam Kayıt</th><th>Asgari Stok</th><th>Geçmiş</th>
              {admin && <th>Yönetim</th>}
            </tr>
          </thead>
          <tbody>
            {positions.map((pos) => {
              const inst = pos.installations[0];
              const life = inst ? calcLife(inst.installDate, inst.expectedLifeDays) : null;
              return (
                <tr key={pos.id}>
                  <td>{pos.machineName}</td>
                  <td><strong>{pos.name}</strong></td>
                  <td><TypeBadge type={pos.type} /></td>
                  <td>
                    {inst ? (
                      <Link href={`/urunler/${inst.productId}`}>{inst.product.code}</Link>
                    ) : (
                      <span className="muted">Boş</span>
                    )}
                  </td>
                  <td>{life ? <LifeBar life={life} /> : "—"}</td>
                  <td>{pos._count.installations}</td>
                  <td>{pos.minStock}</td>
                  <td><Link className="btn sm" href={`/pozisyonlar/${pos.id}/gecmis`}>Geçmişi Gör</Link></td>
                  {admin && (
                    <td>
                      <details>
                        <summary className="btn sm" style={{ listStyle: "none", cursor: "pointer" }}>Düzenle</summary>
                        <form action={updatePositionAction.bind(null, pos.id)} className="inline-form" style={{ marginTop: 8 }}>
                          <input type="text" name="machineName" defaultValue={pos.machineName} title="Makine" />
                          <input type="text" name="name" defaultValue={pos.name} title="Pozisyon adı" />
                          <input type="text" inputMode="numeric" name="minStock" defaultValue={pos.minStock} title="Asgari stok" />
                          <button className="btn sm primary" type="submit">Kaydet</button>
                        </form>
                        <form action={deletePositionAction.bind(null, pos.id)} style={{ marginTop: 6 }}>
                          <ConfirmButton message={`${pos.name} pozisyonu silinecek (geçmiş kayıtlar korunur). Emin misiniz?`}>
                            Pozisyonu Sil
                          </ConfirmButton>
                        </form>
                      </details>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
