import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { getPermSet } from "@/lib/perm";
import { redirect } from "next/navigation";
import { fmtDateTime } from "@/lib/format";
import { getLocale } from "@/lib/locale-server";
import { tFor } from "@/lib/i18n";

import { Flash } from "@/components/ui";

export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  GIRIS: "Stok Girişi",
  MONTAJ: "Montaj",
  SOKUM: "Söküm",
  YIKAMA: "Yıkama",
  OLCUM: "Ölçüm",
  DURUM: "Durum Değişikliği",
  TANIM: "Tanım / Kart",
  SISTEM: "Sistem",
};

const ACTION_COLORS: Record<string, string> = {
  GIRIS: "green",
  MONTAJ: "blue",
  SOKUM: "red",
  YIKAMA: "cyan",
  OLCUM: "purple",
  DURUM: "yellow",
  TANIM: "gray",
  SISTEM: "gray",
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const s = await requireSession();
  const perms = await getPermSet(s.role);
  if (!perms.has("sayfa_hareketler")) redirect("/?hata=Bu%20sayfa%20i%C3%A7in%20yetkiniz%20yok.");
  const locale = await getLocale();
  const t = tFor(locale);
  const sp = await searchParams;
  const action = sp.tip && ACTION_LABELS[sp.tip] ? sp.tip : undefined;
  const q = (sp.q ?? "").trim();

  const logs = await prisma.auditLog.findMany({
    where: {
      ...(action ? { action } : {}),
      ...(q
        ? {
            OR: [
              { description: { contains: q, mode: "insensitive" } },
              { user: { fullName: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: { id: "desc" },
    take: 500,
    include: { user: { select: { fullName: true, username: true } } },
  });

  return (
    <>
      <Flash sp={sp} t={t} />
      <h1>{t("İşlem Geçmişi (Audit Log)")}</h1>
      <p className="muted">
        {t("Kim, ne zaman, hangi işlemi yaptı — son 500 kayıt. Tüm montaj, söküm, stok ve tanım değişiklikleri kullanıcı bazlı kayıt altındadır.")}
      </p>

      <form method="get" className="filters no-print">
        <label>
          {t("İşlem Tipi")}
          <select name="tip" defaultValue={action ?? ""}>
            <option value="">{t("Tümü")}</option>
            {Object.entries(ACTION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{t(v)}</option>
            ))}
          </select>
        </label>
        <label>
          {t("Ara")}
          <input type="search" name="q" defaultValue={q} placeholder={t("Açıklama veya kullanıcı...")} />
        </label>
        <button className="btn" type="submit">{t("Filtrele")}</button>
      </form>

      <div className="panel table-wrap">
        <table>
          <thead>
            <tr><th>{t("Tarih / Saat")}</th><th>{t("Kullanıcı")}</th><th>{t("İşlem")}</th><th>{t("Açıklama")}</th></tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td style={{ whiteSpace: "nowrap" }}>{fmtDateTime(l.createdAt)}</td>
                <td>{l.user ? l.user.fullName : "—"}</td>
                <td><span className={`badge ${ACTION_COLORS[l.action] ?? "gray"}`}>{t(ACTION_LABELS[l.action] ?? l.action)}</span></td>
                <td>{l.description}</td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td colSpan={4} className="muted">{t("Kayıt bulunamadı.")}</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
