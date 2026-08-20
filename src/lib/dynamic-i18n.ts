// Veri olarak saklanan Türkçe içeriğin görüntüleme anında çevrilmesi:
//  - İşlem geçmişi (audit) cümleleri: sistemin ürettiği bilinen kalıplar
//    regex ile tanınır ve hedef dilde yeniden kurulur (harici API gerekmez).
//  - Pozisyon adları: kâğıt makinesi terim sözlüğüyle kelime/kalıp bazında
//    çevrilir ("1. Press Keçesi" → "1. Press Felt" / "1. Pressfilz" ...).
// Eşleşme yoksa metin olduğu gibi (Türkçe) gösterilir.
import { DICTS } from "./i18n";

// ---------------------------------------------------------------------------
// Pozisyon / terim çevirisi
// ---------------------------------------------------------------------------

type L4 = { en: string; de: string; fr: string; ru: string };

// Uzun kalıplar önce denenir
const PHRASES: [string, L4][] = [
  ["Press Keçesi", { en: "Press Felt", de: "Pressfilz", fr: "Feutre de presse", ru: "Прессовое сукно" }],
  ["Pres Keçesi", { en: "Press Felt", de: "Pressfilz", fr: "Feutre de presse", ru: "Прессовое сукно" }],
  ["Pick-up Keçesi", { en: "Pick-up Felt", de: "Pick-up-Filz", fr: "Feutre pick-up", ru: "Сукно пикап" }],
  ["Kurutma Keçesi", { en: "Dryer Felt", de: "Trockenfilz", fr: "Feutre sécheur", ru: "Сушильное сукно" }],
  ["Kurutma Eleği", { en: "Dryer Fabric", de: "Trockensieb", fr: "Toile sécheuse", ru: "Сушильная сетка" }],
  ["Yaş Elek", { en: "Wet Wire", de: "Nasssieb", fr: "Toile humide", ru: "Мокрая сетка" }],
  ["Alt Elek", { en: "Bottom Wire", de: "Untersieb", fr: "Toile inférieure", ru: "Нижняя сетка" }],
  ["Üst Elek", { en: "Top Wire", de: "Obersieb", fr: "Toile supérieure", ru: "Верхняя сетка" }],
  ["Grup", { en: "Group", de: "Gruppe", fr: "Groupe", ru: "Группа" }],
  ["Keçesi", { en: "Felt", de: "Filz", fr: "Feutre", ru: "Сукно" }],
  ["Keçe", { en: "Felt", de: "Filz", fr: "Feutre", ru: "Сукно" }],
  ["Eleği", { en: "Fabric", de: "Sieb", fr: "Toile", ru: "Сетка" }],
  ["Elek", { en: "Wire", de: "Sieb", fr: "Toile", ru: "Сетка" }],
];

export function trPos(name: string | null | undefined, locale: string): string {
  if (!name) return "";
  if (locale === "tr" || !(locale in DICTS)) return name;
  const key = locale as keyof L4;
  let out = name;
  for (const [tr, map] of PHRASES) {
    out = out.split(tr).join(map[key]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// İşlem geçmişi (audit) cümle çevirisi
// ---------------------------------------------------------------------------

type AuditRule = {
  re: RegExp;
  key: string;
  posGroups?: number[]; // pozisyon adı içeren gruplar (trPos uygulanır)
  tGroups?: number[]; // sözlükten çevrilecek gruplar (neden, rol, yıkama türü...)
};

const AUDIT_RULES: AuditRule[] = [
  { re: /^(.+) sisteme giriş yaptı\.$/, key: "@a_login" },
  { re: /^(.+) sistemden çıkış yaptı\.$/, key: "@a_logout" },
  { re: /^Yeni (elek|keçe) kaydı ve stok girişi: (.+)$/, key: "@a_new_product", tGroups: [1] },
  { re: /^Ürün kartı güncellendi: (.+)$/, key: "@a_prod_update" },
  { re: /^(.+) durumu değiştirildi: (.+) → (.+)$/, key: "@a_status" },
  { re: /^Ürün kaydı silindi \(soft-delete\): (.+)$/, key: "@a_prod_delete" },
  { re: /^(.+) → (.+) montajı yapıldı\.$/, key: "@a_install", posGroups: [2] },
  {
    re: /^(.+) söküldü \((.+)\)\. Neden: (.+)\. (\d+) gün çalıştı\. Karar: (.+)\.$/,
    key: "@a_remove",
    posGroups: [2],
    tGroups: [3],
  },
  { re: /^(.+) \((.+)\) — (.+) yapıldı\.$/, key: "@a_wash", posGroups: [2], tGroups: [3] },
  { re: /^(.+) \((.+)\) haftalık ölçüm kaydedildi\.$/, key: "@a_measure", posGroups: [2] },
  { re: /^(.+) kaydına dosya eklendi: (.+)$/, key: "@a_file_add" },
  { re: /^Dosya eki silindi \(#(\d+)\)\.$/, key: "@a_file_del" },
  { re: /^Yeni pozisyon eklendi: (.+)$/, key: "@a_pos_add", posGroups: [1] },
  { re: /^Pozisyon güncellendi: (.+)$/, key: "@a_pos_upd", posGroups: [1] },
  { re: /^Pozisyon silindi \(soft-delete\): (.+)$/, key: "@a_pos_del", posGroups: [1] },
  { re: /^Pozisyon sıralaması sürükle-bırak ile güncellendi\.$/, key: "@a_pos_order" },
  { re: /^Yeni söküm nedeni eklendi: (.+)$/, key: "@a_reason_add", tGroups: [1] },
  { re: /^Söküm nedeni silindi: (.+)$/, key: "@a_reason_del", tGroups: [1] },
  { re: /^Üretici eklendi: (.+)$/, key: "@a_man_add" },
  { re: /^Üretici silindi: (.+)$/, key: "@a_man_del" },
  { re: /^Tedarikçi eklendi: (.+)$/, key: "@a_sup_add" },
  { re: /^Tedarikçi silindi: (.+)$/, key: "@a_sup_del" },
  { re: /^Yeni kullanıcı: (.+) \((.+)\)$/, key: "@a_user_new", tGroups: [2] },
  { re: /^Kullanıcı pasife alındı: (.+)$/, key: "@a_user_off" },
  { re: /^Kullanıcı aktifleştirildi: (.+)$/, key: "@a_user_on" },
  { re: /^Rol değiştirildi: (.+) → (.+)$/, key: "@a_role", tGroups: [2] },
  { re: /^Şifre sıfırlandı: (.+)$/, key: "@a_pw" },
  { re: /^Kullanıcı silindi \(soft-delete\): (.+)$/, key: "@a_user_del" },
  { re: /^(.+) rolünün yetkileri güncellendi \((\d+) yetki\)\.$/, key: "@a_perms", tGroups: [1] },
  { re: /^Sistem kuruldu, başlangıç verileri yüklendi\.$/, key: "@a_setup" },
];

export function trAudit(desc: string, locale: string): string {
  if (locale === "tr") return desc;
  const d = DICTS[locale];
  if (!d) return desc;
  for (const rule of AUDIT_RULES) {
    const m = desc.match(rule.re);
    if (!m) continue;
    let out = d[rule.key];
    if (!out) return desc;
    for (let i = 1; i < m.length; i++) {
      let v = m[i];
      if (rule.posGroups?.includes(i)) v = trPos(v, locale);
      if (rule.tGroups?.includes(i)) v = d[v] ?? v;
      out = out.split(`{${i}}`).join(v);
    }
    return out;
  }
  return desc;
}
