import type { Metadata, Viewport } from "next";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
