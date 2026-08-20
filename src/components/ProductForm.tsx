// Ürün kartı formu (yeni kayıt + düzenleme için ortak, server component)
import type { Manufacturer, Position, Product, Supplier } from "@prisma/client";
import { toDateInputValue } from "@/lib/format";
import { tFor } from "@/lib/i18n";

export default function ProductForm({
  action,
  product,
  positions,
  manufacturers,
  suppliers,
  locale = "tr",
}: {
  action: (fd: FormData) => Promise<void>;
  product?: Product | null;
  positions: Position[];
  manufacturers: Manufacturer[];
  suppliers: Supplier[];
  locale?: string;
}) {
  const p = product;
  const t = tFor(locale);
  return (
    <form action={action} className="panel form-grid">
      {!p && (
        <label>
          {t("Malzeme Tipi")} *
          <select name="type" required defaultValue="KECE">
            <option value="KECE">{t("Keçe")}</option>
            <option value="ELEK">{t("Elek")}</option>
          </select>
        </label>
      )}
      <label>
        {t("Pozisyon")}
        <select name="positionId" defaultValue={p?.positionId ?? ""}>
          <option value="">{t("— Seçiniz —")}</option>
          {positions.map((pos) => (
            <option key={pos.id} value={pos.id}>
              {pos.machineName} / {pos.name} ({t(pos.type === "ELEK" ? "Elek" : "Keçe")})
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("Üretici")}
        <select name="manufacturerId" defaultValue={p?.manufacturerId ?? ""}>
          <option value="">{t("— Seçiniz —")}</option>
          {manufacturers.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </label>
      <label>
        {t("Yeni Üretici (listede yoksa)")}
        <input type="text" name="newManufacturer" placeholder={t("Yeni üretici adı")} />
      </label>
      <label>
        {t("Marka")}
        <input type="text" name="brand" defaultValue={p?.brand ?? ""} />
      </label>
      <label>
        {t("Ürün Kodu")}
        <input type="text" name="productCode" defaultValue={p?.productCode ?? ""} />
      </label>
      <label>
        {t("Seri Numarası")}
        <input type="text" name="serialNo" defaultValue={p?.serialNo ?? ""} />
      </label>
      <label>
        {t("Sipariş Numarası")}
        <input type="text" name="orderNo" defaultValue={p?.orderNo ?? ""} />
      </label>
      <label>
        {t("En (mm)")}
        <input type="text" inputMode="decimal" name="widthMm" defaultValue={p?.widthMm ?? ""} />
      </label>
      <label>
        {t("Boy (mm)")}
        <input type="text" inputMode="decimal" name="lengthMm" defaultValue={p?.lengthMm ?? ""} />
      </label>
      <label>
        {t("Gramaj (g/m²)")}
        <input type="text" inputMode="decimal" name="gsm" defaultValue={p?.gsm ?? ""} />
      </label>
      <label>
        {t("Kalınlık (mm)")}
        <input type="text" inputMode="decimal" name="thicknessMm" defaultValue={p?.thicknessMm ?? ""} />
      </label>
      <label>
        {t("Geçirgenlik (CFM)")}
        <input type="text" inputMode="decimal" name="permeability" defaultValue={p?.permeability ?? ""} />
      </label>
      <label className="wide">
        {t("Malzeme / Konstrüksiyon")}
        <input type="text" name="construction" defaultValue={p?.construction ?? ""} />
      </label>
      <label>
        {t("Satın Alma Tarihi")}
        <input type="date" name="purchaseDate" defaultValue={toDateInputValue(p?.purchaseDate)} />
      </label>
      <label>
        {t("Teslim Tarihi")}
        <input type="date" name="deliveryDate" defaultValue={toDateInputValue(p?.deliveryDate)} />
      </label>
      <label>
        {t("Birim Fiyat")}
        <input type="text" inputMode="decimal" name="unitPrice" defaultValue={p ? Number(p.unitPrice) : ""} />
      </label>
      <label>
        {t("Para Birimi")}
        <select name="currency" defaultValue={p?.currency ?? "TRY"}>
          <option value="TRY">TRY (₺)</option>
          <option value="USD">USD ($)</option>
          <option value="EUR">EUR (€)</option>
        </select>
      </label>
      <label>
        {t("Tedarikçi")}
        <select name="supplierId" defaultValue={p?.supplierId ?? ""}>
          <option value="">{t("— Seçiniz —")}</option>
          {suppliers.map((sup) => (
            <option key={sup.id} value={sup.id}>{sup.name}</option>
          ))}
        </select>
      </label>
      <label>
        {t("Yeni Tedarikçi (listede yoksa)")}
        <input type="text" name="newSupplier" placeholder={t("Yeni tedarikçi adı")} />
      </label>
      <label>
        {t("Tahmini Kullanım Ömrü (gün)")} *
        <input type="text" inputMode="numeric" name="expectedLifeDays" required defaultValue={p?.expectedLifeDays ?? 60} />
      </label>
      <label>
        {t("Depo Konumu")}
        <input type="text" name="warehouseLocation" defaultValue={p?.warehouseLocation ?? ""} />
      </label>
      <label>
        {t("Raf Konumu")}
        <input type="text" name="shelfLocation" defaultValue={p?.shelfLocation ?? ""} />
      </label>
      <label className="wide">
        {t("Açıklama / Notlar")}
        <textarea name="notes" rows={3} defaultValue={p?.notes ?? ""} />
      </label>
      <div className="wide">
        <button type="submit" className="btn primary">
          {p ? t("Kartı Güncelle") : t("Kaydet ve Stoğa Al")}
        </button>
      </div>
    </form>
  );
}
