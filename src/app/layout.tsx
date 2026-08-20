import type { Metadata, Viewport } from "next";
import { getLocale, getTheme } from "@/lib/locale-server";
import "./globals.css";

export const metadata: Metadata = {
  title: "KeçeTakip — Elek & Keçe Takip Yönetim Sistemi",
  description: "Kâğıt fabrikası elek ve keçe stok, ömür, maliyet ve performans takibi",
};

// maximum-scale=1 kullanılmıyor (erişilebilirlik); mobil input zoom'u
// 16px input font boyutu ile engelleniyor.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, theme] = await Promise.all([getLocale(), getTheme()]);
  return (
    <html lang={locale} data-theme={theme}>
      <body>{children}</body>
    </html>
  );
}
