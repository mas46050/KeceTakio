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
import { getLocale } from "@/lib/locale-server";
import { tFor } from "@/lib/i18n";

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
  const locale = await getLocale();
  const t = tFor(locale);
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
      <Flash sp={sp} t={t} />
      <h1>{t("Tanımlar")}</h1>

      <div className="panel-grid">
        <div className="panel">
          <h2>{t("Söküm / Değişim Nedenleri")}</h2>
          <form action={createReasonAction} className="inline-form">
            <label>{t("Neden")}<input type="text" name="name" required /></label>
            <label>{t("Tür")}
              <select name="planned">
                <option value="0">{t("Plansız")}</option>
                <option value="1">{t("Planlı")}</option>
              </select>
            </label>
            <button className="btn primary sm" type="submit">{t("Ekle")}</button>
          </form>
          <div className="table-wrap">
            <table>
              <thead><tr><th>{t("Neden")}</th><th>{t("Tür")}</th><th>{t("Kullanım")}</th><th></th></tr></thead>
              <tbody>
                {reasons.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td>{r.planned ? <span className="badge green">{t("Planlı")}</span> : <span className="badge orange">{t("Plansız")}</span>}</td>
                    <td>{r._count.installations}</td>
                    <td>
                      <form action={deleteReasonAction.bind(null, r.id)}>
                        <ConfirmButton message={`"${r.name}" — ${t("Sil")}?`} className="btn sm">{t("Sil")}</ConfirmButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <h2>{t("Üreticiler")}</h2>
          <form action={createManufacturer} className="inline-form">
            <label>{t("Üretici Adı")}<input type="text" name="name" required /></label>
            <button className="btn primary sm" type="submit">{t("Ekle")}</button>
          </form>
          <div className="table-wrap">
            <table>
              <thead><tr><th>{t("Üretici")}</th><th>{t("Ürün Sayısı")}</th><th></th></tr></thead>
              <tbody>
                {manufacturers.map((m) => (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    <td>{m._count.products}</td>
                    <td>
                      <form action={deleteNamedAction.bind(null, "manufacturer", m.id)}>
                        <ConfirmButton message={`"${m.name}" — ${t("Sil")}?`} className="btn sm">{t("Sil")}</ConfirmButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 style={{ marginTop: 18 }}>{t("Tedarikçiler")}</h2>
          <form action={createSupplier} className="inline-form">
            <label>{t("Tedarikçi Adı")}<input type="text" name="name" required /></label>
            <button className="btn primary sm" type="submit">{t("Ekle")}</button>
          </form>
          <div className="table-wrap">
            <table>
              <thead><tr><th>{t("Tedarikçi")}</th><th>{t("Ürün Sayısı")}</th><th></th></tr></thead>
              <tbody>
                {suppliers.map((m) => (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    <td>{m._count.products}</td>
                    <td>
                      <form action={deleteNamedAction.bind(null, "supplier", m.id)}>
                        <ConfirmButton message={`"${m.name}" — ${t("Sil")}?`} className="btn sm">{t("Sil")}</ConfirmButton>
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
