import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { getPermSet } from "@/lib/perm";
import { redirect } from "next/navigation";
import { createPositionAction } from "@/lib/actions";
import { calcLife } from "@/lib/life";
import { getLocale } from "@/lib/locale-server";
import { tFor } from "@/lib/i18n";

import { Flash } from "@/components/ui";
import PositionManager, { type PosRow } from "@/components/PositionManager";

export const dynamic = "force-dynamic";

export default async function PositionsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; hata?: string }>;
}) {
  const s = await requireSession();
  const perms = await getPermSet(s.role);
  if (!perms.has("sayfa_pozisyonlar")) redirect("/?hata=Bu%20sayfa%20i%C3%A7in%20yetkiniz%20yok.");
  const locale = await getLocale();
  const t = tFor(locale);
  const sp = await searchParams;
  const canManage = perms.has("islem_tanim");

  const positions = await prisma.position.findMany({
    where: { deletedAt: null },
    orderBy: [{ machineName: "asc" }, { sortOrder: "asc" }],
    include: {
      installations: {
        where: { active: true },
        include: { product: { select: { id: true, code: true } } },
      },
      _count: { select: { installations: true } },
    },
  });

  const machines = [...new Set(positions.map((p) => p.machineName))];
  const groups = machines.map((machine) => ({
    machine,
    rows: positions
      .filter((p) => p.machineName === machine)
      .map((p): PosRow => {
        const inst = p.installations[0];
        return {
          id: p.id,
          name: p.name,
          machineName: p.machineName,
          type: p.type,
          minStock: p.minStock,
          count: p._count.installations,
          product: inst ? { id: inst.product.id, code: inst.product.code } : null,
          life: inst ? calcLife(inst.installDate, inst.expectedLifeDays) : null,
        };
      }),
  }));

  return (
    <>
      <Flash sp={sp} t={t} />
      <h1>{t("Pozisyonlar & Geçmiş")}</h1>
      {canManage && (
        <p className="muted">
          {t("Sıralamayı değiştirmek için satırın solundaki")} <strong>⠿</strong>{" "}
          {t("tutma yerinden sürükleyip bırakın.")}{" "}
          {t("\"Düzenle\" ile alanları yerinde değiştirebilir, soldaki çöp kutusu ile pozisyonu silebilirsiniz.")}
        </p>
      )}

      {canManage && (
        <div className="panel">
          <h2>{t("Yeni Pozisyon Ekle")}</h2>
          <form action={createPositionAction} className="inline-form">
            <label>{t("Makine")}<input type="text" name="machineName" defaultValue="PM-1" /></label>
            <label>{t("Pozisyon Adı")}<input type="text" name="name" required placeholder={t("örn. 5. Press Keçesi")} /></label>
            <label>{t("Tip")}
              <select name="type">
                <option value="KECE">{t("Keçe")}</option>
                <option value="ELEK">{t("Elek")}</option>
              </select>
            </label>
            <label>{t("Asgari Stok")}<input type="text" inputMode="numeric" name="minStock" defaultValue="1" /></label>
            <button className="btn primary sm" type="submit">{t("Ekle")}</button>
          </form>
          <p className="muted" style={{ marginBottom: 0 }}>
            {t("Yeni pozisyon listenin sonuna eklenir; yerini sürükleyerek değiştirebilirsiniz.")}
          </p>
        </div>
      )}

      <PositionManager groups={groups} canManage={canManage} locale={locale} />
    </>
  );
}
