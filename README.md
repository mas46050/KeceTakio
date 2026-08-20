# 🏭 KeçeTakip

Kâğıt fabrikaları için **keçe & elek stok, çalışma durumu, kalan ömür ve maliyet takip** programı.

## Özellikler

- **Kullanıcı girişi ve roller** — Yönetici, Operatör ve İzleyici rolleri; kullanıcı ekleme, pasife alma, şifre sıfırlama.
- **Stok takibi** — Keçe/elek stok kartları (kod, tedarikçi, ebat, gramaj, birim maliyet), stok girişi, stok düzeltme, minimum stok (kritik stok) uyarıları.
- **Çalışma durumu** — Makine ve pozisyon tanımları (pres keçesi, yaş elek, kurutma eleği vb.), montaj ve söküm kayıtları; hangi pozisyonda hangi keçe/elek çalışıyor anında görülür.
- **Kalan ömür** — Her keçe/elek için beklenen ömür (gün); takılma tarihinden itibaren kalan ömür yüzdesi renkli çubukla gösterilir, %25 altında uyarı verir.
- **Yıkama kayıtları** — Takılı her keçe/elek için kostik yıkama, kimyasal yıkama vb. kayıtları: tarih, kullanılan kimyasal, süre ve yapan kullanıcı. Son yıkama tarihi ve toplam yıkama sayısı Çalışanlar listesinde görünür.
- **Haftalık ölçümler** — Takılı her keçe/elek için kalınlık (mm), hava geçirgenliği (CFM), nem (%) ve vakum (kPa) ölçümleri tarih ve ölçen kullanıcı ile kaydedilir. 7 günden uzun süre ölçüm yapılmayanlar ana sayfada "ölçüm gecikti" uyarısıyla listelenir.
- **Maliyet raporları** — Aylık satın alma maliyeti, makine bazlı kullanım maliyeti, sökülen keçe/eleklerin ömür performansı (gerçekleşen/beklenen) ve günlük maliyet analizi.
- **Kullanıcı hareket takibi** — Stok girişi, montaj, söküm, düzeltme, kart değişikliği ve giriş/çıkış dahil tüm işlemler hangi kullanıcının yaptığı bilgisiyle kayıt altına alınır.

## Kurulum

Python 3.9+ gereklidir.

```bash
pip install -r requirements.txt
python app.py
```

Tarayıcıdan `http://localhost:5000` adresine girin.

**Varsayılan giriş:** kullanıcı adı `admin`, şifre `admin123`
> İlk girişten sonra Kullanıcılar sayfasından şifreyi mutlaka değiştirin.

Veritabanı (`kecetakip.db`) SQLite dosyası olarak otomatik oluşturulur. İlk açılışta örnek bir makine (PM-1) ve tipik pozisyonlar hazır gelir; Makineler sayfasından kendi makine ve pozisyonlarınızı ekleyebilirsiniz.

## Kullanım Akışı

1. **Stok** sayfasından keçe/elek kartlarını açın (beklenen ömür ve birim maliyeti girin).
2. Kart üzerinden **Stok Girişi** yapın (miktar + güncel birim maliyet).
3. **Montaj** sayfasından stoktaki ürünü boş bir pozisyona takın — stoktan otomatik düşer.
4. **Çalışanlar** sayfasında kalan ömürleri izleyin; her satırdaki **Yıkama / Ölçüm** bağlantısından detay sayfasına girip yıkama ve haftalık ölçüm kayıtlarını ekleyin.
5. Ömrü dolan/yıpranan ürün için **Söküm** kaydedin (neden seçilir).
6. **Raporlar** sayfasından maliyet ve ömür performansını takip edin.
7. **Hareketler** sayfasında kim, ne zaman, ne yaptı görün.

## Roller

| Rol | Yetkiler |
|---|---|
| Yönetici (admin) | Tüm işlemler + kullanıcı yönetimi + stok düzeltme |
| Operatör | Stok kartı, stok girişi, montaj, söküm, makine/pozisyon ekleme |
| İzleyici | Yalnızca görüntüleme |

## Notlar

- Üretim ortamında `SECRET_KEY` ortam değişkenini kendi gizli anahtarınızla ayarlayın.
- Veritabanı dosyasının konumu `KECETAKIP_DB` ortam değişkeni ile değiştirilebilir.
- Uygulama fabrika içi ağda (intranet) kullanım için tasarlanmıştır; internete açacaksanız bir ters vekil (nginx + HTTPS) arkasında çalıştırın.
