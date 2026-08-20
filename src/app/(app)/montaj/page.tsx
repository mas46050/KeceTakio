import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { getPermSet } from "@/lib/perm";
import { redirect } from "next/navigation";
import { montajAction } from "@/lib/actions";
import { toDateInputValue } from "@/lib/format";
import { getLocale } from "@/lib/locale-server";
import { tFor } from "@/lib/i18n";

import { Flash } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MontajPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; hata?: string; urun?: string }>;
}) {
  const s = await requireSession();
  const perms = await getPermSet(s.role);
  if (!perms.has("islem_montaj")) redirect("/?hata=Montaj%20i%C3%A7in%20yetkiniz%20yok.");
  const locale = await getLocale();
  const t = tFor(locale);
  const sp = await searchParams;
  const preselect = sp.urun ? Number(sp.urun) : undefined;

  const [products, positions, activeInstalls] = await Promise.all([
    prisma.product.findMany({
      where: { deletedAt: null, status: { in: ["YENI", "STOKTA", "REZERVE", "KULLANILMIS"] } },
      include: { manufacturer: true },
      orderBy: { code: "asc" },
    }),
    prisma.position.findMany({
      where: { deletedAt: null },
      orderBy: [{ machineName: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.installation.findMany({ where: { active: true }, select: { positionId: true } }),
  ]);
  const occupied = new Set(activeInstalls.map((i) => i.positionId));

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
      <h1>{t("Montaj Yap")}</h1>
      <p className="muted">
        {t("Stoktaki bir elek/keçe makineye takılır; ürün otomatik olarak \"Stokta → Makinede\" durumuna geçer. Dolu pozisyona montaj yapılmadan önce mevcut ürünün sökümü kaydedilmelidir.")}
      </p>

      {products.length === 0 ? (
        <div className="flash err">{t("Montaja uygun (stokta) ürün yok. Önce stok girişi yapın.")}</div>
      ) : (
        <form action={montajAction} className="panel form-grid">
          <label>
            {t("Malzeme")} *
            <select name="productId" required defaultValue={preselect ?? ""}>
              <option value="">{t("— Seçiniz —")}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.manufacturer?.name ?? ""} {p.productCode}{" "}
                  {p.serialNo ? `(${p.serialNo})` : ""} [{t(p.type === "ELEK" ? "Elek" : "Keçe")}]
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("Pozisyon")} *
            <select name="positionId" required>
              <option value="">{t("— Seçiniz —")}</option>
              {positions.map((pos) => (
                <option key={pos.id} value={pos.id}>
                  {pos.machineName} / {pos.name} ({t(pos.type === "ELEK" ? "Elek" : "Keçe")})
                  {occupied.has(pos.id) ? ` — ${t("DOLU")}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("Montaj Tarihi")} *
            <input type="date" name="installDate" required defaultValue={toDateInputValue(now)} />
          </label>
          <label>
            {t("Montaj Saati")}
            <input type="time" name="installTime" defaultValue={timeNow} />
          </label>
          <label>
            {t("Makine Sayacı")}
            <input type="text" inputMode="decimal" name="machineCounter" placeholder="örn. 128450" />
          </label>
          <label>
            {t("Ömür (gün)")}
            <input type="text" inputMode="numeric" name="expectedLifeDays" placeholder={t("Boşsa karttaki değer kullanılır")} />
          </label>
          <label className="wide">
            {t("Açıklama")}
            <input type="text" name="note" placeholder={t("Montaj notu (opsiyonel)")} />
          </label>
          <div className="wide">
            <button type="submit" className="btn primary">{t("Montajı Kaydet")}</button>
          </div>
        </form>
      )}
    </>
  );
}
