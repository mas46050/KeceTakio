// Ürün kartı formu (yeni kayıt + düzenleme için ortak, server component)
import type { Manufacturer, Position, Product, Supplier } from "@prisma/client";
import { toDateInputValue } from "@/lib/format";

export default function ProductForm({
  action,
  product,
  positions,
  manufacturers,
  suppliers,
}: {
  action: (fd: FormData) => Promise<void>;
  product?: Product | null;
  positions: Position[];
  manufacturers: Manufacturer[];
  suppliers: Supplier[];
}) {
  const p = product;
  return (
    <form action={action} className="panel form-grid">
      {!p && (
        <label>
          Malzeme Tipi *
          <select name="type" required defaultValue="KECE">
            <option value="KECE">Keçe</option>
            <option value="ELEK">Elek</option>
          </select>
        </label>
      )}
      <label>
        Pozisyon
        <select name="positionId" defaultValue={p?.positionId ?? ""}>
          <option value="">— Seçiniz —</option>
          {positions.map((pos) => (
            <option key={pos.id} value={pos.id}>
              {pos.machineName} / {pos.name} ({pos.type === "ELEK" ? "Elek" : "Keçe"})
            </option>
          ))}
        </select>
      </label>
      <label>
        Üretici
        <select name="manufacturerId" defaultValue={p?.manufacturerId ?? ""}>
          <option value="">— Seçiniz —</option>
          {manufacturers.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </label>
      <label>
        Yeni Üretici (listede yoksa)
        <input type="text" name="newManufacturer" placeholder="Yeni üretici adı" />
      </label>
      <label>
        Marka
        <input type="text" name="brand" defaultValue={p?.brand ?? ""} />
      </label>
      <label>
        Ürün Kodu
        <input type="text" name="productCode" defaultValue={p?.productCode ?? ""} />
      </label>
      <label>
        Seri Numarası
        <input type="text" name="serialNo" defaultValue={p?.serialNo ?? ""} />
      </label>
      <label>
        Sipariş Numarası
        <input type="text" name="orderNo" defaultValue={p?.orderNo ?? ""} />
      </label>
      <label>
        En (mm)
        <input type="text" inputMode="decimal" name="widthMm" defaultValue={p?.widthMm ?? ""} />
      </label>
      <label>
        Boy (mm)
        <input type="text" inputMode="decimal" name="lengthMm" defaultValue={p?.lengthMm ?? ""} />
      </label>
      <label>
        Gramaj (g/m²)
        <input type="text" inputMode="decimal" name="gsm" defaultValue={p?.gsm ?? ""} />
      </label>
      <label>
        Kalınlık (mm)
        <input type="text" inputMode="decimal" name="thicknessMm" defaultValue={p?.thicknessMm ?? ""} />
      </label>
      <label>
        Geçirgenlik (CFM)
        <input type="text" inputMode="decimal" name="permeability" defaultValue={p?.permeability ?? ""} />
      </label>
      <label className="wide">
        Malzeme / Konstrüksiyon
        <input type="text" name="construction" defaultValue={p?.construction ?? ""} />
      </label>
      <label>
        Satın Alma Tarihi
        <input type="date" name="purchaseDate" defaultValue={toDateInputValue(p?.purchaseDate)} />
      </label>
      <label>
        Teslim Tarihi
        <input type="date" name="deliveryDate" defaultValue={toDateInputValue(p?.deliveryDate)} />
      </label>
      <label>
        Birim Fiyat
        <input type="text" inputMode="decimal" name="unitPrice" defaultValue={p ? Number(p.unitPrice) : ""} />
      </label>
      <label>
        Para Birimi
        <select name="currency" defaultValue={p?.currency ?? "TRY"}>
          <option value="TRY">TRY (₺)</option>
          <option value="USD">USD ($)</option>
          <option value="EUR">EUR (€)</option>
        </select>
      </label>
      <label>
        Tedarikçi
        <select name="supplierId" defaultValue={p?.supplierId ?? ""}>
          <option value="">— Seçiniz —</option>
          {suppliers.map((sup) => (
            <option key={sup.id} value={sup.id}>{sup.name}</option>
          ))}
        </select>
      </label>
      <label>
        Yeni Tedarikçi (listede yoksa)
        <input type="text" name="newSupplier" placeholder="Yeni tedarikçi adı" />
      </label>
      <label>
        Tahmini Kullanım Ömrü (gün) *
        <input type="text" inputMode="numeric" name="expectedLifeDays" required defaultValue={p?.expectedLifeDays ?? 60} />
      </label>
      <label>
        Depo Konumu
        <input type="text" name="warehouseLocation" defaultValue={p?.warehouseLocation ?? ""} />
      </label>
      <label>
        Raf Konumu
        <input type="text" name="shelfLocation" defaultValue={p?.shelfLocation ?? ""} />
      </label>
      <label className="wide">
        Açıklama / Notlar
        <textarea name="notes" rows={3} defaultValue={p?.notes ?? ""} />
      </label>
      <div className="wide">
        <button type="submit" className="btn primary">
          {p ? "Kartı Güncelle" : "Kaydet ve Stoğa Al"}
        </button>
      </div>
    </form>
  );
}
