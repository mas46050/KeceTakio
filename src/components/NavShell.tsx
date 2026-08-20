"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/lib/actions";

type NavItem = { href: string; label: string };

export default function NavShell({
  items,
  fullName,
  roleLabel,
  children,
}: {
  items: NavItem[];
  fullName: string;
  roleLabel: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="shell">
      {open && <div className="backdrop" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand">🏭 KeçeTakip</div>
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
            <button className="btn sm" type="submit">Çıkış Yap</button>
          </form>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button
            className="menu-btn"
            onClick={() => setOpen(!open)}
            aria-label="Menüyü aç"
          >
            ☰
          </button>
          <form className="search" action="/arama" method="get">
            <input
              type="search"
              name="q"
              placeholder="Ara: seri no, ürün kodu, üretici, pozisyon, barkod..."
            />
            <button className="btn" type="submit">Ara</button>
          </form>
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
