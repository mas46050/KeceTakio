import { loginAction } from "@/lib/actions";
import { getSession } from "@/lib/auth";
import { getLocale } from "@/lib/locale-server";
import { LOCALES, tFor } from "@/lib/i18n";
import { redirect } from "next/navigation";
import { Flash } from "@/components/ui";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; hata?: string }>;
}) {
  const s = await getSession();
  if (s) redirect("/");
  const sp = await searchParams;
  const locale = await getLocale();
  const t = tFor(locale);
  return (
    <div className="login-wrap">
      <div className="login-box">
        <h1>🏭 KeçeTakip</h1>
        <p className="muted" style={{ textAlign: "center" }}>
          {t("Elek & Keçe Takip Yönetim Sistemi")}
        </p>
        <div className="lang-flags" style={{ justifyContent: "center", marginBottom: 4 }}>
          {LOCALES.map((l) => (
            <a
              key={l.code}
              href={`/api/dil/${l.code}?geri=/login`}
              className={`flag ${locale === l.code ? "active" : ""}`}
              title={l.name}
            >
              {l.flag}
            </a>
          ))}
        </div>
        <Flash sp={sp} t={t} />
        <form action={loginAction}>
          <label>
            {t("Kullanıcı Adı")}
            <input type="text" name="username" required autoFocus autoComplete="username" />
          </label>
          <label>
            {t("Şifre")}
            <input type="password" name="password" required autoComplete="current-password" />
          </label>
          <button type="submit" className="btn primary">{t("Giriş Yap")}</button>
        </form>
      </div>
    </div>
  );
}
