// Türkiye tarih/saat ve para formatları
const TZ = "Europe/Istanbul";

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("tr-TR", { timeZone: TZ, dateStyle: "short" }).format(
    new Date(d)
  );
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

export function fmtMoney(v: number | string | null | undefined, currency = "TRY"): string {
  const n = Number(v ?? 0);
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${new Intl.NumberFormat("tr-TR").format(n)} ${currency}`;
  }
}

export function fmtNum(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined) return "—";
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: digits }).format(v);
}

// <input type="date"> değerini gün ortası UTC'ye çevirir (saat dilimi kaymasını önler)
export function parseDateInput(date: string, time?: string): Date {
  const t = time && /^\d{2}:\d{2}$/.test(time) ? time : "12:00";
  return new Date(`${date}T${t}:00+03:00`);
}

export function toDateInputValue(d: Date | null | undefined): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(d));
}
