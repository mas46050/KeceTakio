import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { getPermSet } from "@/lib/perm";
import { sokumAction } from "@/lib/actions";
import { calcLife } from "@/lib/life";
import { fmtDateTime, toDateInputValue } from "@/lib/format";
import { getLocale } from "@/lib/locale-server";
import { tFor } from "@/lib/i18n";

import { Flash, LifeBar } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SokumPage({
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
  if (!perms.has("islem_montaj")) redirect("/?hata=S%C3%B6k%C3%BCm%20i%C3%A7in%20yetkiniz%20yok.");

  const inst = await prisma.installation.findFirst({
    where: { id: Number(id), active: true },
    include: { product: { include: { manufacturer: true } }, position: true },
  });
  if (!inst) notFound();

  const reasons = await prisma.failureReason.findMany({
    where: { deletedAt: null },
    orderBy: { sortOrder: "asc" },
  });
  const locale = await getLocale();
  const t = tFor(locale);
  const life = calcLife(inst.installDate, inst.expectedLifeDays);
  const now = new Date();
  const timeNow = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);

  return (
    <>
      <Flash sp={sp} t={t} />
      <h1>{t("Söküm Yap")} — {inst.product.code}</h1>
      <div className="panel">
        <div className="detail-grid">
          <div><small className="muted">{t("Pozisyon")}</small><br /><strong>{inst.position.machineName} / {inst.position.name}</strong></div>
          <div><small className="muted">{t("Ürün")}</small><br />{inst.product.code} — {inst.product.manufacturer?.name ?? ""} {inst.product.productCode}</div>
          <div><small className="muted">{t("Montaj")}</small><br />{fmtDateTime(inst.installDate)}</div>
          <div><small className="muted">{t("Ömür Durumu")}</small><br /><LifeBar life={life} locale={locale} /></div>
        </div>
      </div>

      <form action={sokumAction.bind(null, inst.id)} className="panel form-grid" encType="multipart/form-data">
        <label>
          {t("Söküm Tarihi")} *
          <input type="date" name="removeDate" required defaultValue={toDateInputValue(now)} />
        </label>
        <label>
          {t("Söküm Saati")}
          <input type="time" name="removeTime" defaultValue={timeNow} />
        </label>
        <label>
          {t("Makine Sayacı")}
          <input type="text" inputMode="decimal" name="machineCounter" />
        </label>
        <label>
          {t("Söküm Nedeni")} *
          <select name="failureReasonId" required>
            <option value="">{t("— Seçiniz —")}</option>
            {reasons.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} {r.planned ? t("(planlı)") : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("Kullanılabilir / Hurda Kararı")} *
          <select name="decision" required defaultValue="KULLANILABILIR">
            <option value="KULLANILABILIR">{t("Kullanılabilir (stoğa döner)")}</option>
            <option value="HURDA">{t("Hurda")}</option>
          </select>
        </label>
        <label>
          {t("Hasar Fotoğrafı")}
          <input type="file" name="damagePhoto" accept="image/*" />
        </label>
        <label className="wide">
          {t("Açıklama")}
          <textarea name="note" rows={2} placeholder={t("Söküm notu (opsiyonel)")} />
        </label>
        <div className="wide">
          <button type="submit" className="btn warn">{t("Sökümü Kaydet")}</button>
        </div>
      </form>
    </>
  );
}
