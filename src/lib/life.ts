// Çalışma süresi ve ömür hesapları
export type LifeStatus = "normal" | "warn80" | "warn90" | "over";

export type LifeInfo = {
  workingDays: number;
  workingHours: number;
  expectedDays: number;
  usedPct: number; // kullanılan ömür %
  remainingDays: number;
  status: LifeStatus;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function calcLife(
  installDate: Date | string,
  expectedLifeDays: number,
  removeDate?: Date | string | null
): LifeInfo {
  const start = new Date(installDate).getTime();
  const end = removeDate ? new Date(removeDate).getTime() : Date.now();
  const workingDays = Math.max(0, Math.floor((end - start) / DAY_MS));
  const workingHours = Math.max(0, Math.round((end - start) / (60 * 60 * 1000)));
  const expectedDays = Math.max(1, expectedLifeDays || 1);
  const usedPct = Math.round((workingDays / expectedDays) * 100);
  const remainingDays = expectedDays - workingDays;
  let status: LifeStatus = "normal";
  if (usedPct >= 100) status = "over";
  else if (usedPct >= 90) status = "warn90";
  else if (usedPct >= 80) status = "warn80";
  return { workingDays, workingHours, expectedDays, usedPct, remainingDays, status };
}

export const LIFE_LABELS: Record<LifeStatus, string> = {
  normal: "Normal",
  warn80: "Ömrünün %80'ini geçti",
  warn90: "Kritik (%90+)",
  over: "Ömrünü aştı",
};

export const STATUS_LABELS: Record<string, string> = {
  YENI: "Yeni",
  STOKTA: "Stokta",
  REZERVE: "Rezerve",
  MAKINEDE: "Makinede",
  KULLANILMIS: "Kullanılmış",
  TAMIRDE: "Tamirde",
  HURDA: "Hurda",
};

export const TYPE_LABELS: Record<string, string> = {
  ELEK: "Elek",
  KECE: "Keçe",
};

export const KIND_LABELS: Record<string, string> = {
  FOTO: "Ürün fotoğrafı",
  DOKUMAN: "Teknik doküman",
  HASAR: "Hasar fotoğrafı",
};

export const WASH_TYPES = ["Kostik yıkama", "Kimyasal yıkama", "Basınçlı su", "Diğer"];
