import { loginAction } from "@/lib/actions";
import { getSession } from "@/lib/auth";
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
  return (
    <div className="login-wrap">
      <div className="login-box">
        <h1>🏭 KeçeTakip</h1>
        <p className="muted" style={{ textAlign: "center" }}>
          Elek &amp; Keçe Takip Yönetim Sistemi
        </p>
        <Flash sp={sp} />
        <form action={loginAction}>
          <label>
            Kullanıcı Adı
            <input type="text" name="username" required autoFocus autoComplete="username" />
          </label>
          <label>
            Şifre
            <input type="password" name="password" required autoComplete="current-password" />
          </label>
          <button type="submit" className="btn primary">Giriş Yap</button>
        </form>
      </div>
    </div>
  );
}
