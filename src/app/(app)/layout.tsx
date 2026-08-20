import { requireSession, isAdmin, ROLE_LABELS } from "@/lib/auth";
import { getPermSet } from "@/lib/perm";
import { getLocale, getTheme } from "@/lib/locale-server";
import { tFor } from "@/lib/i18n";
import NavShell from "@/components/NavShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSession();
  const [perms, locale, theme] = await Promise.all([
    getPermSet(s.role),
    getLocale(),
    getTheme(),
  ]);
  const t = tFor(locale);
  const items = [
    { href: "/", label: t("Ana Sayfa") },
    ...(perms.has("sayfa_urunler") ? [{ href: "/urunler", label: t("Elek / Keçe Kartları") }] : []),
    ...(perms.has("sayfa_stok") ? [{ href: "/stok", label: t("Stok Yönetimi") }] : []),
    ...(perms.has("islem_montaj") ? [{ href: "/montaj", label: t("Montaj Yap") }] : []),
    ...(perms.has("sayfa_pozisyonlar")
      ? [{ href: "/pozisyonlar", label: t("Pozisyonlar & Geçmiş") }]
      : []),
    ...(perms.has("sayfa_raporlar") ? [{ href: "/raporlar", label: t("Raporlar & Analiz") }] : []),
    ...(perms.has("sayfa_hareketler") ? [{ href: "/hareketler", label: t("İşlem Geçmişi") }] : []),
    ...(perms.has("islem_tanim") ? [{ href: "/tanimlar", label: t("Tanımlar") }] : []),
    ...(isAdmin(s) ? [{ href: "/kullanicilar", label: t("Kullanıcılar") }] : []),
  ];
  return (
    <NavShell
      items={items}
      fullName={s.fullName}
      roleLabel={t(ROLE_LABELS[s.role])}
      locale={locale}
      theme={theme}
    >
      {children}
    </NavShell>
  );
}
