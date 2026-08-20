import { calcLife, LIFE_LABELS, STATUS_LABELS, TYPE_LABELS, type LifeInfo } from "@/lib/life";

export function Flash({ sp }: { sp: { ok?: string; hata?: string } }) {
  return (
    <>
      {sp.ok && <div className="flash ok">{sp.ok}</div>}
      {sp.hata && <div className="flash err">{sp.hata}</div>}
    </>
  );
}

const STATUS_COLORS: Record<string, string> = {
  YENI: "cyan",
  STOKTA: "blue",
  REZERVE: "purple",
  MAKINEDE: "green",
  KULLANILMIS: "gray",
  TAMIRDE: "yellow",
  HURDA: "red",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${STATUS_COLORS[status] ?? "gray"}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function TypeBadge({ type }: { type: string }) {
  return (
    <span className={`badge ${type === "ELEK" ? "blue" : "purple"}`}>
      {TYPE_LABELS[type] ?? type}
    </span>
  );
}

const LIFE_BADGE: Record<string, string> = {
  normal: "green",
  warn80: "yellow",
  warn90: "orange",
  over: "red",
};

export function LifeBadge({ life }: { life: LifeInfo }) {
  return <span className={`badge ${LIFE_BADGE[life.status]}`}>{LIFE_LABELS[life.status]}</span>;
}

export function LifeBar({ life }: { life: LifeInfo }) {
  const w = Math.min(life.usedPct, 100);
  return (
    <div>
      <div className="lifebar">
        <div className={life.status} style={{ width: `${w}%` }} />
      </div>
      <small>
        %{life.usedPct} kullanıldı — {life.workingDays} / {life.expectedDays} gün
        {life.remainingDays >= 0
          ? ` (${life.remainingDays} gün kaldı)`
          : ` (${-life.remainingDays} gün aşıldı)`}
      </small>
    </div>
  );
}

export { calcLife };
