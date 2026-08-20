"use client";

// Tarayıcının yazdırma diyaloğunu açar; "PDF olarak kaydet" ile PDF çıktı alınır
export default function PrintButton() {
  return (
    <button className="btn no-print" type="button" onClick={() => window.print()}>
      🖨 PDF / Yazdır
    </button>
  );
}
