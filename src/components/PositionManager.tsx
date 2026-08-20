"use client";

// Pozisyon listesi: kenardaki tutma yerinden sürükle-bırak sıralama,
// "Düzenle" ile alanların yerinde düzenlenmesi ve solda çöp kutusu ile silme.
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  deletePositionAction,
  reorderPositionsAction,
  updatePositionAction,
} from "@/lib/actions";
import { LifeBar, TypeBadge } from "@/components/ui";
import { tFor } from "@/lib/i18n";
import type { LifeInfo } from "@/lib/life";

export type PosRow = {
  id: number;
  name: string;
  displayName?: string;
  machineName: string;
  type: string;
  minStock: number;
  count: number;
  product: { id: number; code: string } | null;
  life: LifeInfo | null;
};

export default function PositionManager({
  groups,
  canManage,
  locale = "tr",
}: {
  groups: { machine: string; rows: PosRow[] }[];
  canManage: boolean;
  locale?: string;
}) {
  const t = tFor(locale);
  const router = useRouter();
  const byId = new Map(groups.flatMap((g) => g.rows).map((r) => [r.id, r]));
  const [order, setOrder] = useState<Record<string, number[]>>(() =>
    Object.fromEntries(groups.map((g) => [g.machine, g.rows.map((r) => r.id)]))
  );
  const [dragId, setDragId] = useState<number | null>(null);
  const [armedId, setArmedId] = useState<number | null>(null); // tutma yerine basıldı
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, startSaving] = useTransition();

  const persistOrder = () => {
    const flat = groups.flatMap((g) => order[g.machine] ?? []);
    startSaving(async () => {
      await reorderPositionsAction(flat);
      router.refresh();
    });
  };

  const moveWithin = (machine: string, id: number, overId: number) => {
    setOrder((o) => {
      const ids = [...(o[machine] ?? [])];
      const from = ids.indexOf(id);
      const to = ids.indexOf(overId);
      if (from < 0 || to < 0 || from === to) return o;
      ids.splice(from, 1);
      ids.splice(to, 0, id);
      return { ...o, [machine]: ids };
    });
  };

  const nudge = (machine: string, id: number, delta: number) => {
    const ids = [...(order[machine] ?? [])];
    const from = ids.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) return;
    ids.splice(from, 1);
    ids.splice(to, 0, id);
    const newOrder = { ...order, [machine]: ids };
    setOrder(newOrder);
    const flat = groups.flatMap((g) => newOrder[g.machine] ?? []);
    startSaving(async () => {
      await reorderPositionsAction(flat);
      router.refresh();
    });
  };

  return (
    <>
      {groups.map((g) => (
        <div className="panel" key={g.machine}>
          <h2>
            🏭 {g.machine}
            {saving && <small className="muted"> — {t("sıralama kaydediliyor...")}</small>}
          </h2>
          <div className="pos-list">
            {(order[g.machine] ?? []).map((id) => {
              const row = byId.get(id);
              if (!row) return null;
              const isEditing = editingId === id;

              if (isEditing) {
                return (
                  <form
                    key={id}
                    action={updatePositionAction.bind(null, id)}
                    className="pos-row editing"
                  >
                    <button
                      type="submit"
                      className="trash-btn"
                      title={t("Pozisyonu sil")}
                      formAction={deletePositionAction.bind(null, id)}
                      onClick={(e) => {
                        if (!confirm(`"${row.name}" — ${t("Pozisyonu sil")}?`))
                          e.preventDefault();
                      }}
                    >
                      🗑
                    </button>
                    <div className="pos-main">
                      <input type="text" name="name" defaultValue={row.name} required aria-label={t("Pozisyon Adı")} />
                      <input type="hidden" name="machineName" value={row.machineName} />
                    </div>
                    <div className="pos-cell">
                      <TypeBadge type={row.type} locale={locale} />
                    </div>
                    <div className="pos-cell" />
                    <div className="pos-cell">
                      <label className="mini-label">
                        {t("asgari stok")}
                        <input
                          type="text"
                          inputMode="numeric"
                          name="minStock"
                          defaultValue={row.minStock}
                          style={{ maxWidth: 90 }}
                        />
                      </label>
                    </div>
                    <div className="pos-actions">
                      <button className="btn sm primary" type="submit">{t("Kaydet")}</button>
                      <button className="btn sm" type="button" onClick={() => setEditingId(null)}>
                        {t("Vazgeç")}
                      </button>
                    </div>
                  </form>
                );
              }

              return (
                <div
                  key={id}
                  className={`pos-row ${dragId === id ? "dragging" : ""}`}
                  draggable={canManage && armedId === id}
                  onDragStart={(e) => {
                    setDragId(id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    if (dragId !== null && dragId !== id) {
                      e.preventDefault();
                      moveWithin(g.machine, dragId, id);
                    }
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setArmedId(null);
                    persistOrder();
                  }}
                >
                  {canManage && (
                    <span
                      className="drag-handle"
                      title={t("Sıralamak için tutup sürükleyin")}
                      onMouseDown={() => setArmedId(id)}
                      onMouseUp={() => setArmedId(null)}
                    >
                      ⠿
                    </span>
                  )}
                  {canManage && (
                    <span className="nudge-btns">
                      <button type="button" aria-label={t("Yukarı taşı")} onClick={() => nudge(g.machine, id, -1)}>▲</button>
                      <button type="button" aria-label={t("Aşağı taşı")} onClick={() => nudge(g.machine, id, 1)}>▼</button>
                    </span>
                  )}
                  <div className="pos-main">
                    <strong>{row.displayName ?? row.name}</strong>
                    <small className="muted">{row.count} {t("kullanım kaydı")} · {t("asgari stok")} {row.minStock}</small>
                  </div>
                  <div className="pos-cell">
                    <TypeBadge type={row.type} locale={locale} />
                  </div>
                  <div className="pos-cell">
                    {row.product ? (
                      <Link href={`/urunler/${row.product.id}`}>{row.product.code}</Link>
                    ) : (
                      <span className="muted">{t("Boş")}</span>
                    )}
                  </div>
                  <div className="pos-cell">
                    {row.life ? <LifeBar life={row.life} locale={locale} /> : <span className="muted">—</span>}
                  </div>
                  <div className="pos-actions">
                    <Link className="btn sm" href={`/pozisyonlar/${id}/gecmis`}>{t("Geçmiş")}</Link>
                    {canManage && (
                      <button className="btn sm" type="button" onClick={() => setEditingId(id)}>
                        {t("Düzenle")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
