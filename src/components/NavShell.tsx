"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/lib/actions";
import { LOCALES, THEME_COOKIE, tFor } from "@/lib/i18n";
import AskoLogo from "@/components/AskoLogo";

type NavItem = { href: string; label: string };

export default function NavShell({
  items,
  fullName,
  roleLabel,
  locale,
  theme,
  children,
}: {
  items: NavItem[];
  fullName: string;
  roleLabel: string;
  locale: string;
  theme: "light" | "dark";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [curTheme, setCurTheme] = useState(theme);
  const pathname = usePathname();
  const t = tFor(locale);

  const toggleTheme = () => {
    const next = curTheme === "dark" ? "light" : "dark";
    setCurTheme(next);
    document.documentElement.dataset.theme = next;
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}`;
  };

  return (
    <div className="shell">
      {open && <div className="backdrop" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand">
          <AskoLogo height={30} wordColor="#ffffff" />
          <div className="brand-sub">{t("Elek & Keçe Takip Yönetim Sistemi")}</div>
        </div>
        <nav>
          {items.map((it) => {
            const active =
              it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                className={active ? "active" : ""}
                onClick={() => setOpen(false)}
              >
                {it.label}
              </Link>
            );
          })}
        </nav>
        <div className="userarea">
          <div className="name">{fullName}</div>
          <div>{roleLabel}</div>
          <form action={logoutAction} style={{ marginTop: 8 }}>
            <button className="btn sm" type="submit">{t("Çıkış Yap")}</button>
          </form>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button
            className="menu-btn"
            onClick={() => setOpen(!open)}
            aria-label="Menü"
          >
            ☰
          </button>
          <form className="search" action="/arama" method="get">
            <input
              type="search"
              name="q"
              placeholder={t("Ara: seri no, ürün kodu, üretici, pozisyon, barkod...")}
            />
            <button className="btn" type="submit">{t("Ara")}</button>
          </form>
          <span className="spacer" style={{ flex: 1 }} />
          <div className="lang-flags" role="group" aria-label="Dil / Language">
            {LOCALES.map((l) => (
              <a
                key={l.code}
                href={`/api/dil/${l.code}?geri=${encodeURIComponent(pathname)}`}
                className={`flag ${locale === l.code ? "active" : ""}`}
                title={l.name}
              >
                {l.flag}
              </a>
            ))}
          </div>
          <button
            className="theme-btn"
            onClick={toggleTheme}
            title={curTheme === "dark" ? "Aydınlık tema / Light" : "Karanlık tema / Dark"}
            aria-label="Tema"
          >
            {curTheme === "dark" ? "☀️" : "🌙"}
          </button>
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
