import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession, canOperate, canEnterTech, isAdmin } from "@/lib/auth";
import {
  addMeasurementAction,
  addWashAction,
  deleteAttachmentAction,
  deleteProductAction,
  setProductStatusAction,
  uploadAttachmentAction,
} from "@/lib/actions";
import { calcLife, KIND_LABELS, WASH_TYPES } from "@/lib/life";
import { fmtDate, fmtDateTime, fmtMoney, fmtNum, toDateInputValue } from "@/lib/format";
import { Flash, LifeBadge, LifeBar, StatusBadge, TypeBadge } from "@/components/ui";
import ConfirmButton from "@/components/ConfirmButton";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; hata?: string }>;
}) {
  const s = await requireSession();
  const { id } = await params;
  const sp = await searchParams;
  const productId = Number(id);

  const product = await prisma.product.findFirst({
    where: { id: productId, deletedAt: null },
    include: {
      manufacturer: true,
      supplier: true,
      position: true,
      attachments: { select: { id: true, kind: true, filename: true, mime: true, createdAt: true } },
      installations: {
        orderBy: { installDate: "desc" },
        include: {
          position: true,
          installedBy: { select: { fullName: true } },
          removedBy: { select: { fullName: true } },
          failureReason: true,
          washes: { orderBy: { washDate: "desc" }, include: { user: { select: { fullName: true } } } },
          measurements: {
            orderBy: { measureDate: "desc" },
            include: { user: { select: { fullName: true } } },
          },
          attachments: { select: { id: true, kind: true, filename: true, mime: true } },
        },
      },
    },
  });
  if (!product) notFound();

  const activeInst = product.installations.find((i) => i.active);
  const life = activeInst ? calcLife(activeInst.installDate, activeInst.expectedLifeDays) : null;

  const totalWorkingDays = product.installations.reduce(
    (a, i) => a + calcLife(i.installDate, i.expectedLifeDays, i.removeDate ?? undefined).workingDays,
    0
  );
  const dailyCost =
    totalWorkingDays > 0 ? Number(product.unitPrice) / totalWorkingDays : null;

  const statusAction = setProductStatusAction.bind(null, productId);
  const uploadAction = uploadAttachmentAction.bind(null, productId);
  const deleteAction = deleteProductAction.bind(null, productId);

  return (
    <>
      <Flash sp={sp} />
      <div className="page-head">
        <h1>
          {product.code} <TypeBadge type={product.type} /> <StatusBadge status={product.status} />
        </h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {canOperate(s) && (
            <Link className="btn" href={`/urunler/${product.id}/duzenle`}>Düzenle</Link>
          )}
          {canOperate(s) && product.status !== "MAKINEDE" && (
            <Link className="btn primary" href={`/montaj?urun=${product.id}`}>Montaj Yap</Link>
          )}
          {activeInst && canOperate(s) && (
            <Link className="btn warn" href={`/sokum/${activeInst.id}`}>Söküm Yap</Link>
          )}
        </div>
      </div>

      <div className="panel-grid">
        <div className="panel">
          <h2>Kart Bilgileri</h2>
          <div className="detail-grid">
            <div><small className="muted">Üretici</small><br />{product.manufacturer?.name ?? "—"}</div>
            <div><small className="muted">Marka</small><br />{product.brand || "—"}</div>
            <div><small className="muted">Ürün Kodu</small><br />{product.productCode || "—"}</div>
            <div><small className="muted">Seri No</small><br />{product.serialNo || "—"}</div>
            <div><small className="muted">Sipariş No</small><br />{product.orderNo || "—"}</div>
            <div><small className="muted">Pozisyon</small><br />{product.position ? `${product.position.machineName} / ${product.position.name}` : "—"}</div>
            <div><small className="muted">En × Boy (mm)</small><br />{product.widthMm ?? "—"} × {product.lengthMm ?? "—"}</div>
            <div><small className="muted">Gramaj</small><br />{product.gsm ? `${fmtNum(product.gsm)} g/m²` : "—"}</div>
            <div><small className="muted">Kalınlık</small><br />{product.thicknessMm ? `${product.thicknessMm} mm` : "—"}</div>
            <div><small className="muted">Geçirgenlik</small><br />{product.permeability ? `${product.permeability} CFM` : "—"}</div>
            <div><small className="muted">Konstrüksiyon</small><br />{product.construction || "—"}</div>
            <div><small className="muted">Satın Alma</small><br />{fmtDate(product.purchaseDate)}</div>
            <div><small className="muted">Teslim</small><br />{fmtDate(product.deliveryDate)}</div>
            <div><small className="muted">Stok Girişi</small><br />{fmtDate(product.stockDate)}</div>
            <div><small className="muted">Birim Fiyat</small><br /><strong>{fmtMoney(Number(product.unitPrice), product.currency)}</strong></div>
            <div><small className="muted">Tedarikçi</small><br />{product.supplier?.name ?? "—"}</div>
            <div><small className="muted">Tahmini Ömür</small><br />{product.expectedLifeDays} gün</div>
            <div><small className="muted">Depo / Raf</small><br />{product.warehouseLocation || "—"} / {product.shelfLocation || "—"}</div>
            <div><small className="muted">Toplam Çalışma</small><br />{fmtNum(totalWorkingDays)} gün</div>
            <div>
              <small className="muted">Günlük Kullanım Maliyeti</small><br />
              {dailyCost === null ? "—" : `${fmtMoney(dailyCost, product.currency)}/gün`}
            </div>
          </div>
          {product.notes && (
            <p style={{ marginBottom: 0 }}>
              <small className="muted">Notlar:</small> {product.notes}
            </p>
          )}
        </div>

        <div className="panel">
          <h2>QR / Barkod</h2>
          <div className="qr-box">
            {/* QR içeriği ürünün detay sayfası adresidir; okutulduğunda bu sayfa açılır */}
            <img src={`/api/qr/${product.code}`} alt={`QR: ${product.code}`} />
            <div><strong>{product.code}</strong></div>
            <small className="muted">QR kod okutulduğunda ürün detay sayfası açılır.</small>
          </div>

          {life && activeInst && (
            <>
              <h2 style={{ marginTop: 16 }}>Aktif Çalışma</h2>
              <p style={{ margin: "4px 0" }}>
                {activeInst.position.machineName} / {activeInst.position.name} —{" "}
                montaj {fmtDateTime(activeInst.installDate)}
              </p>
              <LifeBar life={life} />
              <p style={{ margin: "6px 0 0" }}>
                <LifeBadge life={life} />{" "}
                <small className="muted">{fmtNum(life.workingHours)} saat çalışma</small>
              </p>
            </>
          )}

          {canOperate(s) && product.status !== "MAKINEDE" && (
            <>
              <h2 style={{ marginTop: 16 }}>Durum Değiştir</h2>
              <form action={statusAction} className="inline-form">
                <select name="status" defaultValue="STOKTA">
                  <option value="STOKTA">Stokta</option>
                  <option value="REZERVE">Rezerve</option>
                  <option value="TAMIRDE">Tamirde</option>
                  <option value="KULLANILMIS">Kullanılmış</option>
                  {isAdmin(s) && <option value="HURDA">Hurda</option>}
                </select>
                <ConfirmButton message="Ürün durumunu değiştirmek istediğinize emin misiniz?" className="btn sm">
                  Uygula
                </ConfirmButton>
              </form>
            </>
          )}

          {isAdmin(s) && product.status !== "MAKINEDE" && (
            <form action={deleteAction} style={{ marginTop: 12 }}>
              <ConfirmButton message={`${product.code} kaydı silinecek (geçmiş korunur). Emin misiniz?`}>
                Kaydı Sil
              </ConfirmButton>
            </form>
          )}
        </div>
      </div>

      {activeInst && (
        <div className="panel-grid">
          <div className="panel">
            <h2>🧴 Yıkama Kayıtları ({activeInst.washes.length})</h2>
            {canEnterTech(s) && (
              <form action={addWashAction.bind(null, activeInst.id)} className="inline-form no-print">
                <label>Tarih<input type="date" name="washDate" required defaultValue={toDateInputValue(new Date())} /></label>
                <label>Tür
                  <select name="washType">
                    {WASH_TYPES.map((w) => <option key={w}>{w}</option>)}
                  </select>
                </label>
                <label>Kimyasal<input type="text" name="chemical" placeholder="örn. NaOH %2" /></label>
                <label>Süre (dk)<input type="text" inputMode="numeric" name="durationMin" /></label>
                <label>Not<input type="text" name="note" /></label>
                <button className="btn primary sm" type="submit">Ekle</button>
              </form>
            )}
            <div className="table-wrap">
              <table>
                <thead><tr><th>Tarih</th><th>Tür</th><th>Kimyasal</th><th>Süre</th><th>Yapan</th><th>Not</th></tr></thead>
                <tbody>
                  {activeInst.washes.map((w) => (
                    <tr key={w.id}>
                      <td>{fmtDate(w.washDate)}</td>
                      <td><span className="badge cyan">{w.washType}</span></td>
                      <td>{w.chemical || "—"}</td>
                      <td>{w.durationMin ? `${w.durationMin} dk` : "—"}</td>
                      <td>{w.user?.fullName ?? "—"}</td>
                      <td>{w.note}</td>
                    </tr>
                  ))}
                  {activeInst.washes.length === 0 && (
                    <tr><td colSpan={6} className="muted">Henüz yıkama kaydı yok.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <h2>📏 Haftalık Ölçümler ({activeInst.measurements.length})</h2>
            {canEnterTech(s) && (
              <form action={addMeasurementAction.bind(null, activeInst.id)} className="inline-form no-print">
                <label>Tarih<input type="date" name="measureDate" required defaultValue={toDateInputValue(new Date())} /></label>
                <label>Kalınlık (mm)<input type="text" inputMode="decimal" name="thicknessMm" /></label>
                <label>Geçirgenlik (CFM)<input type="text" inputMode="decimal" name="permeabilityCfm" /></label>
                <label>Nem (%)<input type="text" inputMode="decimal" name="moisturePct" /></label>
                <label>Vakum (kPa)<input type="text" inputMode="decimal" name="vacuumKpa" /></label>
                <label>Not<input type="text" name="note" /></label>
                <button className="btn primary sm" type="submit">Ekle</button>
              </form>
            )}
            <div className="table-wrap">
              <table>
                <thead><tr><th>Tarih</th><th>Kalınlık</th><th>Geçirgenlik</th><th>Nem</th><th>Vakum</th><th>Ölçen</th><th>Not</th></tr></thead>
                <tbody>
                  {activeInst.measurements.map((m) => (
                    <tr key={m.id}>
                      <td>{fmtDate(m.measureDate)}</td>
                      <td>{m.thicknessMm ?? "—"}</td>
                      <td>{m.permeabilityCfm ?? "—"}</td>
                      <td>{m.moisturePct ?? "—"}</td>
                      <td>{m.vacuumKpa ?? "—"}</td>
                      <td>{m.user?.fullName ?? "—"}</td>
                      <td>{m.note}</td>
                    </tr>
                  ))}
                  {activeInst.measurements.length === 0 && (
                    <tr><td colSpan={7} className="muted">Henüz ölçüm kaydı yok.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="panel">
        <h2>🗂 Montaj / Söküm Geçmişi</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Pozisyon</th><th>Montaj</th><th>Söküm</th><th>Çalışma</th>
                <th>Ömür Kullanımı</th><th>Neden</th><th>Karar</th><th>Günlük Maliyet</th><th>Kayıtlar</th>
              </tr>
            </thead>
            <tbody>
              {product.installations.map((i) => {
                const l = calcLife(i.installDate, i.expectedLifeDays, i.removeDate ?? undefined);
                const dc = l.workingDays > 0 ? Number(product.unitPrice) / l.workingDays : null;
                return (
                  <tr key={i.id}>
                    <td>{i.position.machineName} / {i.position.name}</td>
                    <td>{fmtDateTime(i.installDate)}<br /><small>{i.installedBy?.fullName ?? ""}</small></td>
                    <td>
                      {i.removeDate ? (
                        <>{fmtDateTime(i.removeDate)}<br /><small>{i.removedBy?.fullName ?? ""}</small></>
                      ) : (
                        <span className="badge green">Makinede</span>
                      )}
                    </td>
                    <td>{l.workingDays} gün<br /><small>{fmtNum(l.workingHours)} saat</small></td>
                    <td><LifeBar life={l} /></td>
                    <td>{i.failureReason?.name ?? "—"}</td>
                    <td>{i.removalDecision === "HURDA" ? <span className="badge red">Hurda</span> : i.removalDecision === "KULLANILABILIR" ? <span className="badge green">Kullanılabilir</span> : "—"}</td>
                    <td>{dc === null ? "—" : `${fmtMoney(dc, product.currency)}/gün`}</td>
                    <td>
                      <small>
                        {i.washes.length} yıkama, {i.measurements.length} ölçüm
                        {i.attachments.length > 0 && `, ${i.attachments.length} dosya`}
                      </small>
                      {i.removalNote && <><br /><small className="muted">{i.removalNote}</small></>}
                    </td>
                  </tr>
                );
              })}
              {product.installations.length === 0 && (
                <tr><td colSpan={9} className="muted">Bu ürün henüz makineye takılmadı.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <h2>📎 Fotoğraf ve Dokümanlar</h2>
        {canOperate(s) && (
          <form action={uploadAction} className="inline-form no-print" encType="multipart/form-data">
            <label>Dosya<input type="file" name="file" required accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" /></label>
            <label>Tür
              <select name="kind">
                <option value="FOTO">Ürün fotoğrafı</option>
                <option value="DOKUMAN">Teknik doküman</option>
                <option value="HASAR">Hasar fotoğrafı</option>
              </select>
            </label>
            <button className="btn primary sm" type="submit">Yükle</button>
          </form>
        )}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10 }}>
          {[...product.attachments, ...product.installations.flatMap((i) => i.attachments)].map(
            (a) => (
              <div key={a.id} style={{ textAlign: "center" }}>
                <a href={`/api/dosya/${a.id}`} target="_blank" rel="noreferrer">
                  {a.mime.startsWith("image/") ? (
                    <img src={`/api/dosya/${a.id}`} alt={a.filename} className="thumb" />
                  ) : (
                    <span className="btn sm">📄 {a.filename}</span>
                  )}
                </a>
                <br />
                <small className="muted">{KIND_LABELS[a.kind] ?? a.kind}</small>
                {isAdmin(s) && (
                  <form action={deleteAttachmentAction.bind(null, a.id, productId)}>
                    <ConfirmButton message="Bu dosya kalıcı olarak silinecek. Emin misiniz?" className="btn sm">
                      Sil
                    </ConfirmButton>
                  </form>
                )}
              </div>
            )
          )}
          {product.attachments.length === 0 &&
            product.installations.every((i) => i.attachments.length === 0) && (
              <p className="muted" style={{ margin: 0 }}>Henüz dosya yok.</p>
            )}
        </div>
      </div>
    </>
  );
}
