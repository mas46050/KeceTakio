// Sunucu tarafı: çerezlerden dil ve tema okuma
import { cookies } from "next/headers";
import { LANG_COOKIE, THEME_COOKIE, isLocale, tFor, type Locale } from "./i18n";

export async function getLocale(): Promise<Locale> {
  const v = (await cookies()).get(LANG_COOKIE)?.value;
  return isLocale(v) ? v : "tr";
}

export async function getTheme(): Promise<"light" | "dark"> {
  const v = (await cookies()).get(THEME_COOKIE)?.value;
  return v === "dark" ? "dark" : "light";
}

export async function getT() {
  return tFor(await getLocale());
}
