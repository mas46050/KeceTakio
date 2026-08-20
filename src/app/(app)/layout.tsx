import { requireSession, isAdmin, ROLE_LABELS } from "@/lib/auth";
import { getPermSet } from "@/lib/perm";
import NavShell from "@/components/NavShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSession();
  const perms = await getPermSet(s.role);
  const items = [
    { href: "/", label: "Ana Sayfa" },
    ...(perms.has("sayfa_urunler") ? [{ href: "/urunler", label: "Elek / Keçe Kartları" }] : []),
    ...(perms.has("sayfa_stok") ? [{ href: "/stok", label: "Stok Yönetimi" }] : []),
    ...(perms.has("islem_montaj") ? [{ href: "/montaj", label: "Montaj Yap" }] : []),
    ...(perms.has("sayfa_pozisyonlar")
      ? [{ href: "/pozisyonlar", label: "Pozisyonlar & Geçmiş" }]
      : []),
    ...(perms.has("sayfa_raporlar") ? [{ href: "/raporlar", label: "Raporlar & Analiz" }] : []),
    ...(perms.has("sayfa_hareketler") ? [{ href: "/hareketler", label: "İşlem Geçmişi" }] : []),
    ...(perms.has("islem_tanim") ? [{ href: "/tanimlar", label: "Tanımlar" }] : []),
    ...(isAdmin(s) ? [{ href: "/kullanicilar", label: "Kullanıcılar" }] : []),
  ];
  return (
    <NavShell items={items} fullName={s.fullName} roleLabel={ROLE_LABELS[s.role]}>
      {children}
    </NavShell>
  );
}
