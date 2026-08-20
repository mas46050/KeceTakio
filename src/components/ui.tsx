import { calcLife, LIFE_LABELS, STATUS_LABELS, TYPE_LABELS, type LifeInfo } from "@/lib/life";
import { tFor } from "@/lib/i18n";

export function Flash({
  sp,
  t = (s: string) => s,
}: {
  sp: { ok?: string; hata?: string };
  t?: (s: string) => string;
}) {
  return (
    <>
      {sp.ok && <div className="flash ok">{t(sp.ok)}</div>}
      {sp.hata && <div className="flash err">{t(sp.hata)}</div>}
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

export function StatusBadge({ status, locale = "tr" }: { status: string; locale?: string }) {
  const t = tFor(locale);
  return (
    <span className={`badge ${STATUS_COLORS[status] ?? "gray"}`}>
      {t(STATUS_LABELS[status] ?? status)}
    </span>
  );
}

export function TypeBadge({ type, locale = "tr" }: { type: string; locale?: string }) {
  const t = tFor(locale);
  return (
    <span className={`badge ${type === "ELEK" ? "blue" : "purple"}`}>
      {t(TYPE_LABELS[type] ?? type)}
    </span>
  );
}

const LIFE_BADGE: Record<string, string> = {
  normal: "green",
  warn80: "yellow",
  warn90: "orange",
  over: "red",
};

export function LifeBadge({ life, locale = "tr" }: { life: LifeInfo; locale?: string }) {
  const t = tFor(locale);
  return <span className={`badge ${LIFE_BADGE[life.status]}`}>{t(LIFE_LABELS[life.status])}</span>;
}

export function LifeBar({ life, locale = "tr" }: { life: LifeInfo; locale?: string }) {
  const t = tFor(locale);
  const w = Math.min(life.usedPct, 100);
  return (
    <div>
      <div className="lifebar">
        <div className={life.status} style={{ width: `${w}%` }} />
      </div>
      <small>
        %{life.usedPct} {t("kullanıldı")} — {life.workingDays} / {life.expectedDays} {t("gün")}
        {life.remainingDays >= 0
          ? ` (${life.remainingDays} ${t("gün kaldı")})`
          : ` (${-life.remainingDays} ${t("gün aşıldı")})`}
      </small>
    </div>
  );
}

export { calcLife };
