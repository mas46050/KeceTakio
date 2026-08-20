import { requireSession, canOperate, isAdmin, ROLE_LABELS } from "@/lib/auth";
import NavShell from "@/components/NavShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSession();
  const items = [
    { href: "/", label: "Ana Sayfa" },
    { href: "/urunler", label: "Elek / Keçe Kartları" },
    { href: "/stok", label: "Stok Yönetimi" },
    ...(canOperate(s) ? [{ href: "/montaj", label: "Montaj Yap" }] : []),
    { href: "/pozisyonlar", label: "Pozisyonlar & Geçmiş" },
    { href: "/raporlar", label: "Raporlar & Analiz" },
    { href: "/hareketler", label: "İşlem Geçmişi" },
    ...(isAdmin(s)
      ? [
          { href: "/tanimlar", label: "Tanımlar" },
          { href: "/kullanicilar", label: "Kullanıcılar" },
        ]
      : []),
  ];
  return (
    <NavShell items={items} fullName={s.fullName} roleLabel={ROLE_LABELS[s.role]}>
      {children}
    </NavShell>
  );
}
