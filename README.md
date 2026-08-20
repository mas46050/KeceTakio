# 🏭 KeçeTakip — Elek & Keçe Takip Yönetim Sistemi

Kâğıt fabrikaları için profesyonel, modern, mobil uyumlu ve online çalışan **elek & keçe
stok, montaj, söküm, çalışma süresi, kullanım ömrü, maliyet ve performans takip sistemi**.

Next.js (React + TypeScript) · PostgreSQL (Prisma) · Kullanıcı adı + şifre ile giriş

## Özellikler

- **Ana Dashboard** — Aktif/stoktaki elek-keçe sayıları, kritik stok, bu ay değiştirilen,
  ortalama elek/keçe ömrü, toplam stok değeri, aktif toplam çalışma süresi KPI kartları;
  yaklaşan değişimler (%80/%90/%100 ömür), son hareketler, makine durumu kartları ve
  akıllı uyarılar (kritik stok, ömür eşikleri, yaklaşan planlı değişim).
- **Elek/Keçe Kartı** — Her ürün benzersiz kayıt: Sistem ID + otomatik **QR kod**
  (okutulunca detay sayfası açılır), üretici, marka, ürün kodu, seri/sipariş no, en, boy,
  gramaj, kalınlık, geçirgenlik, konstrüksiyon, satın alma/teslim tarihi, birim fiyat +
  para birimi (TRY/USD/EUR), tedarikçi, tahmini ömür, depo/raf konumu, notlar, ürün
  fotoğrafı ve teknik doküman ekleri.
- **Stok Yönetimi** — Durumlar: Yeni, Stokta, Rezerve, Makinede, Kullanılmış, Tamirde,
  Hurda. Pozisyon başına asgari stok seviyesi; altına düşen pozisyonlar dashboard'da
  **Kritik Stok** olarak listelenir.
- **Montaj** — Tarih + saat, makine sayacı, montajı yapan kişi, açıklama; ürün otomatik
  "Stokta → Makinede" geçer. Dolu pozisyona montaj engellenir ve kullanıcı uyarılır;
  elek pozisyonuna keçe takılamaz.
- **Söküm** — Tarih + saat, makine sayacı, yönetilebilir söküm nedenleri (planlı/plansız),
  hasar fotoğrafı, **Kullanılabilir / Hurda kararı** (kullanılabilirse stoğa döner).
- **Ömür Takibi** — Çalışma günü/saati, kullanılan ömür %, kalan ömür, ilerleme çubuğu;
  pozisyon geçmişinden önceki ürünlerin ortalama/min/maks ömrü.
- **Yıkama & Haftalık Ölçüm** *(önceki sürümden korunan artılar)* — Kostik/kimyasal
  yıkama kayıtları (kimyasal, süre, yapan kişi) ve haftalık ölçümler (kalınlık,
  geçirgenlik, nem, vakum).
- **Performans & Maliyet Analizi** — Üretici / pozisyon / ürün kodu bazında ortalama-min-maks
  ömür, plansız değişim oranı, günlük kullanım maliyeti (fiyat ÷ çalışma günü), plansız
  değişim maliyeti, aylık/yıllık maliyet. Amaç: en uzun ömürlüyü değil **kullanım günü
  başına en ekonomik ürünü** bulmak.
- **Raporlama** — Tarih aralığı, tip, pozisyon, üretici, ürün kodu, neden ve durum
  filtreleri; ömür trendi, üretici performansı, aylık değişim, neden dağılımı grafikleri;
  **Excel (CSV) indirme** ve **PDF/yazdırma** çıktısı.
- **Geçmiş** — Her pozisyon için kronolojik kullanım geçmişi: üretici, seri no, montaj,
  söküm, çalışma günü, değişim nedeni, maliyet, günlük maliyet.
- **Kullanıcı & Yetki** — Roller: **Yönetici** (tümü), **Bakım** (montaj/söküm/teknik
  kayıt), **Operatör** (görüntüleme + yıkama/ölçüm), **Görüntüleyici** (salt okunur).
  Kullanıcı oluşturma/silme, şifre ve rol değiştirme yönetici panelinden.
- **İşlem Geçmişi (Audit Log)** — Kim, ne zaman, hangi kaydı değiştirdi; filtrelenebilir.
- **Veri Güvenliği** — Soft-delete (geçmiş silinmez), kritik işlemlerde onay ekranı,
  bcrypt şifreleme, imzalı oturum çerezi.
- **Global Arama** — Üst çubuktan seri no, ürün kodu, üretici, pozisyon, barkod/QR araması.
- **Mobil Uyumlu** — Masaüstü/tablet/telefonda responsive; mobil girişte otomatik zoom yok;
  tarih-saat gösterimi Türkiye formatında (Europe/Istanbul).

## Kurulum

Gereksinimler: Node.js 20+, PostgreSQL 14+.

```bash
# 1) Veritabanı oluşturun (örnek)
createdb kecetakip

# 2) Ortam değişkenleri
cp .env.example .env
#    .env içinde DATABASE_URL ve SESSION_SECRET değerlerini düzenleyin

# 3) Bağımlılıklar + şema + başlangıç verileri
npm install
npx prisma db push
npm run db:seed

# 4) Çalıştırma
npm run build
npm start          # http://localhost:3000
```

Geliştirme için `npm run dev`.

**Varsayılan giriş:** `admin` / `admin123` — ilk girişten sonra Kullanıcılar sayfasından
şifreyi mutlaka değiştirin.

Seed; örnek pozisyonları (Alt/Üst Elek, Forming Fabric 1-2, 1-4. Press Keçesi), 13 söküm
nedenini ve iki örnek ürünü yükler. Pozisyonlar, nedenler, üreticiler ve tedarikçiler
yönetici panelinden tamamen yönetilebilir.

## Veritabanı Mimarisi

Prisma şeması (`prisma/schema.prisma`) ilişkisel modeli tanımlar:

`users` · `positions` (ekipman pozisyonları) · `products` (elek/keçe kartları) ·
`installations` (montaj + söküm = kullanım dönemi) · `washes` (yıkamalar) ·
`measurements` (haftalık ölçümler) · `manufacturers` · `suppliers` ·
`failure_reasons` (söküm nedenleri) · `attachments` (foto/doküman, DB'de saklanır) ·
`audit_logs` (işlem geçmişi) · `stock_movements` (stok hareketleri)

Tüm silmeler soft-delete'tir (`deletedAt`); ürün ve pozisyon geçmişi asla kaybolmaz.
Yapı, ileride başka makine ekipmanlarının (valsler, bıçaklar vb.) eklenebilmesi için
pozisyon/ürün tipi üzerinden ölçeklenebilir tasarlandı.

## Dağıtım (internet üzerinden erişim)

Uygulama standart bir Next.js uygulamasıdır; `output: "standalone"` ile derlenir.
Bir VPS'te `npm run build && npm start` + nginx/Caddy ters vekil (HTTPS) arkasında,
ya da Vercel/Railway/Render gibi platformlarda `DATABASE_URL`'i yönetilen bir
PostgreSQL'e (Neon, Supabase, RDS...) yönlendirerek yayınlanabilir. Böylece her
bilgisayar, tablet ve telefondan aynı verilere erişilir.

> Eski Flask/SQLite sürümü `legacy/` klasöründe saklanmaktadır.
