import { prisma } from "@/lib/db";
import { requireSession, canOperate } from "@/lib/auth";
import { redirect } from "next/navigation";
import { montajAction } from "@/lib/actions";
import { toDateInputValue } from "@/lib/format";
import { Flash } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MontajPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; hata?: string; urun?: string }>;
}) {
  const s = await requireSession();
  if (!canOperate(s)) redirect("/?hata=Montaj%20i%C3%A7in%20yetkiniz%20yok.");
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
      <Flash sp={sp} />
      <h1>Montaj Yap</h1>
      <p className="muted">
        Stoktaki bir elek/keçe makineye takılır; ürün otomatik olarak
        &quot;Stokta → Makinede&quot; durumuna geçer. Dolu pozisyona montaj yapılmadan önce
        mevcut ürünün sökümü kaydedilmelidir.
      </p>

      {products.length === 0 ? (
        <div className="flash err">Montaja uygun (stokta) ürün yok. Önce stok girişi yapın.</div>
      ) : (
        <form action={montajAction} className="panel form-grid">
          <label>
            Malzeme *
            <select name="productId" required defaultValue={preselect ?? ""}>
              <option value="">— Seçiniz —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.manufacturer?.name ?? ""} {p.productCode}{" "}
                  {p.serialNo ? `(${p.serialNo})` : ""} [{p.type === "ELEK" ? "Elek" : "Keçe"}]
                </option>
              ))}
            </select>
          </label>
          <label>
            Pozisyon *
            <select name="positionId" required>
              <option value="">— Seçiniz —</option>
              {positions.map((pos) => (
                <option key={pos.id} value={pos.id}>
                  {pos.machineName} / {pos.name} ({pos.type === "ELEK" ? "Elek" : "Keçe"})
                  {occupied.has(pos.id) ? " — DOLU" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Montaj Tarihi *
            <input type="date" name="installDate" required defaultValue={toDateInputValue(now)} />
          </label>
          <label>
            Montaj Saati
            <input type="time" name="installTime" defaultValue={timeNow} />
          </label>
          <label>
            Makine Sayacı
            <input type="text" inputMode="decimal" name="machineCounter" placeholder="örn. 128450" />
          </label>
          <label>
            Tahmini Ömür (gün)
            <input type="text" inputMode="numeric" name="expectedLifeDays" placeholder="Boşsa karttaki değer kullanılır" />
          </label>
          <label className="wide">
            Açıklama
            <input type="text" name="note" placeholder="Montaj notu (opsiyonel)" />
          </label>
          <div className="wide">
            <button type="submit" className="btn primary">Montajı Kaydet</button>
          </div>
        </form>
      )}
    </>
  );
}
