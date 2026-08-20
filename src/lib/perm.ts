// Rol bazlı yetki sistemi.
// Yönetici her zaman tüm yetkilere sahiptir; diğer rollerin yetkileri
// Kullanıcılar sayfasındaki "Rol Yetkileri" tablosundan düzenlenir.
import { prisma } from "./db";
import type { Session } from "./auth";

export const PERM_GROUPS: { title: string; perms: { key: string; label: string }[] }[] = [
  {
    title: "Sayfa Görüntüleme",
    perms: [
      { key: "sayfa_urunler", label: "Elek/Keçe kartları, ürün detayları ve arama" },
      { key: "sayfa_stok", label: "Stok yönetimi sayfası" },
      { key: "sayfa_pozisyonlar", label: "Pozisyonlar ve pozisyon geçmişi" },
      { key: "sayfa_raporlar", label: "Raporlar, analiz ve dışa aktarma" },
      { key: "sayfa_hareketler", label: "İşlem geçmişi (audit log)" },
    ],
  },
  {
    title: "Değişiklik Yapma",
    perms: [
      { key: "islem_urun", label: "Ürün kartı oluşturma/düzenleme, stok girişi, durum değiştirme, dosya yükleme" },
      { key: "islem_montaj", label: "Montaj ve söküm yapma" },
      { key: "islem_yikama_olcum", label: "Yıkama ve ölçüm kaydı ekleme" },
      { key: "islem_tanim", label: "Pozisyon, söküm nedeni, üretici ve tedarikçi yönetimi" },
    ],
  },
];

export const ALL_PERMS = PERM_GROUPS.flatMap((g) => g.perms.map((p) => p.key));

// Yetkileri düzenlenebilen roller (Yönetici sabittir)
export const EDITABLE_ROLES = ["BAKIM", "OPERATOR", "IZLEYICI"] as const;

const PAGE_PERMS = PERM_GROUPS[0].perms.map((p) => p.key);

// Hiç kayıt yoksa geçerli olan varsayılanlar
export const DEFAULT_PERMS: Record<string, string[]> = {
  BAKIM: [...PAGE_PERMS, "islem_urun", "islem_montaj", "islem_yikama_olcum"],
  OPERATOR: [...PAGE_PERMS, "islem_yikama_olcum"],
  IZLEYICI: [...PAGE_PERMS],
};

// "Hiçbir kutu işaretlenmemiş" durumunu varsayılanlardan ayırt etmek için
// kaydedilen işaret satırı
export const CONFIGURED_MARKER = "_configured";

export async function getPermSet(role: Session["role"]): Promise<Set<string>> {
  if (role === "YONETICI") return new Set(ALL_PERMS);
  const rows = await prisma.rolePermission.findMany({ where: { role } });
  if (rows.length === 0) return new Set(DEFAULT_PERMS[role] ?? []);
  return new Set(rows.map((r) => r.permission).filter((p) => p !== CONFIGURED_MARKER));
}
