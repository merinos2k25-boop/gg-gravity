# 📊 Aylık Hesap Gelir-Gider Defteri

Ev ve kişisel bütçe takibi için modern, mobil öncelikli, **Vercel'e doğrudan yüklenebilir (PWA)** web uygulaması.

**Geliştirici:** HAKAN KORKMAZ  
**Telif Hakkı:** Copyright © 2026 Tüm Hakları Saklıdır.

---

## ⚡ Vercel'e Nasıl Yüklenir ve Yayınlanır?

Proje içerisinde **`vercel.json`**, **`package.json`** ve **`manifest.json`** hazır olarak bulunmaktadır. Sıfır konfigürasyon ile doğrudan Vercel üzerinde çalışır.

### Yöntem 1: GitHub & Vercel Dashboard (En Kolayı)
1. Bu proje klasörünü bir GitHub reposuna yükleyin (push edin).
2. [vercel.com](https://vercel.com) adresine gidin ve **Add New... > Project** butonuna tıklayın.
3. GitHub reponuzu seçip **Deploy** butonuna basın.
4. Birkaç saniye içinde projeniz `https://projeniz.vercel.app` şeklinde ücretsiz canlıya alınır!

### Yöntem 2: Vercel CLI ile Doğrudan Yükleme
Komut satırında proje dizinindeyken:
```bash
npx vercel
```
ekrandaki adımları onaylayarak doğrudan yayına alabilirsiniz.

---

## 📱 Cep Telefonuna Uygulama Olarak Yükleme (PWA)

Vercel linkinizi telefonunuzun tarayıcısında (Safari veya Chrome) açtıktan sonra:
- **iPhone (iOS Safari):** Paylaş butonuna dokunun -> **"Ana Ekrana Ekle"** seçeneğini seçin.
- **Android (Chrome):** Sağ üstteki üç nokta menüsüne dokunun -> **"Uygulamayı Yükle"** veya **"Ana Ekrana Ekle"** seçeneğini seçin.

Uygulama telefonunuzda tıpkı App Store veya Google Play'den indirilmiş gibi tam ekran, çentik ve durum çubuğu ile uyumlu bir mobil uygulama olarak çalışacaktır.

---

## 🌟 Sekmeler ve Özellikler

1. **Ana Sayfa:**
   - Toplam Gelir, Toplam Gider, Net Kalan Bakiye, Ödenen ve Bekleyen tutarlar.
   - Su, Elektrik, İnternet, Doğalgaz, Telefon, Banka ve Taksit harcama kalemleri.
   - Kalemlere tıklandığında açılan hızlı detay penceresi (Popup modal).
2. **Kayıtlar:**
   - `+` butonu ile fatura, taksit ve gelir ekleme.
   - **Dekont Ekleme:** Cihazdan veya kameradan makbuz/dekont resmi ekleme ve tam ekran görüntüleme.
   - Ödendi/Ödenmedi tek tıkla işaretleme, arama ve filtreler.
3. **Analiz:**
   - Yıl ve Ay seçici.
   - Faturalar, Taksitler ve Banka borçlarını ayrı ayrı hesaplama.
   - Donut harcama dağılımı ve çubuk karşılaştırma grafikleri (Chart.js).
4. **Ayarlar:**
   - Koyu Mod / Açık Mod / Otomatik Mod.
   - Renk Teması (Zümrüt, Safir, Mor, Amber, Gül).
   - Yazı stili (Font) seçimi.
   - Tek tıkla açılıp kapanan toparlanmış akordiyon yapı.
   - JSON formatında tek tıkla dışa aktar / içe aktar (dekontlar dahil yedekleme).
   - Hakkında: *Oluşturan HAKAN KORKMAZ Copyright 2026*.
