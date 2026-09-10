# Google Drive Bulut Yedekleme Kurulum Rehberi ☁️

Bu rehber, **Aylık Hesap Gelir-Gider Defteri** uygulamanızı kendi kişisel Google hesabınıza (15 GB ücretsiz Google Drive depolama alanınıza) bağlamak için gereken **ücretsiz** Google OAuth İstemci Kimliğini (Client ID) almanızı sağlar.

---

## 💡 Önemli Bilgilendirme (%100 Ücretsizdir)
- **Kredi Kartı Gerekmez:** Google Cloud Console'da temel API kullanımı ve OAuth kimlik doğrulaması tamamen ücretsizdir.
- **Kişisel 15 GB Kotanızı Kullanır:** Uygulama veritabanınız ve yüklediğiniz fatura dekontları doğrudan sizin kendi Google Drive'ınızda depolanır.
- **Gizlilik ve Güvenlik:** Sadece `drive.file` yetkisi kullanılır; bu sayede uygulama sizin diğer kişisel Drive dosyalarınızı asla göremez, yalnızca kendi oluşturduğu `Gelir-Gider Defteri (Bulut Yedekleri)` klasörüne erişebilir.

---

## 🚀 2 Dakikada Adım Adım Kurulum

### 1. Adım: Google Cloud Console'u Açın
1. Tarayıcınızda [console.cloud.google.com](https://console.cloud.google.com/) adresine gidin.
2. Kişisel Google (Gmail) hesabınızla giriş yapın.

---

### 2. Adım: Yeni Bir Proje Oluşturun
1. Sayfanın en üstündeki proje açılır menüsüne tıklayın ve **"Yeni Proje" (New Project)** butonuna basın.
2. Proje Adı olarak: `Gelir Gider Defterim` yazın.
3. Kuruluş kısmını boş bırakıp **"Oluştur" (Create)** butonuna tıklayın.
4. Proje oluştuktan sonra üst menüden bu yeni projeyi seçin.

---

### 3. Adım: Google Drive API'yi Etkinleştirin
1. Üst arama çubuğuna **"Google Drive API"** yazın ve çıkan sonuca tıklayın.
2. Mavi renkli **"Etkinleştir" (Enable)** butonuna tıklayın. (Birkaç saniye içinde aktif olacaktır).

---

### 4. Adım: OAuth İzin Ekranını Yapılandırın (OAuth Consent Screen)
1. Sol menüden (üç çizgi) **"API'ler ve Hizmetler" (APIs & Services)** > **"OAuth İzin Ekranı" (OAuth consent screen)** sayfasına gidin.
2. Kullanıcı Türü (User Type) olarak **"Harici" (External)** seçeneğini işaretleyip **Oluştur (Create)** butonuna basın.
3. Açılan formda:
   - **Uygulama Adı (App name):** `Gelir Gider Defterim`
   - **Kullanıcı Destek E-postası (User support email):** Kendi Gmail adresinizi seçin.
   - **Geliştirici İletişim Bilgileri (Developer contact info):** Kendi Gmail adresinizi yazın.
4. **"Kaydet ve Devam Et" (Save and Continue)** butonuna basın.
5. Kapsamlar (Scopes) adımını doğrudan **"Kaydet ve Devam Et"** diyerek geçin.
6. **Test Kullanıcıları (Test Users)** adımında:
   - **"+ ADD USERS"** butonuna tıklayın.
   - Kendi Gmail adresinizi yazıp ekleyin (Test modundayken sadece izin verdiğiniz bu hesap giriş yapabilir, bu da maksimum güvenlik sağlar).
7. **"Kaydet ve Devam Et"** diyerek tamamlayın.

---

### 5. Adım: OAuth İstemci Kimliğini (Client ID) Oluşturun
1. Sol menüden **"Kimlik Bilgileri" (Credentials)** sekmesine tıklayın.
2. Sayfanın üstündeki **"+ Kimlik Bilgisi Oluştur" (+ Create Credentials)** butonuna basın ve **"OAuth İstemci Kimliği" (OAuth client ID)** seçin.
3. **Uygulama Türü (Application type):** `Web Uygulaması` (Web application) seçin.
4. **Ad (Name):** `Gelir Gider Web İstemcisi` yazabilirsiniz.
5. **Yetkili JavaScript Kaynakları (Authorized JavaScript origins):**
   - **"+ URI EKLE"** butonuna tıklayın ve uygulamanızın çalıştığı adresleri ekleyin:
   - Yerel test için: `http://localhost:3000` veya `http://localhost:5500` veya `http://127.0.0.1:5500`
   - Vercel için: `https://sizin-projeniz.vercel.app` *(Vercel linkinizi aldıktan sonra buraya dilediğiniz an ekleyebilirsiniz)*
6. Sayfanın altındaki **"Oluştur" (Create)** butonuna tıklayın.

---

### 6. Adım: Kodu Uygulamaya Yapıştırın ve Başlatın 🎉
1. Ekranda beliren **"İstemci Kimliğiniz" (Your Client ID)** kutusundaki kodu kopyalayın.
   *(Örn: `123456789012-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com`)*
2. **Aylık Hesap Gelir-Gider Defteri** uygulamanıza gelin:
   - **Ayarlar** sekmesini açın.
   - **Google Drive Yedekleme** başlığına tıklayın.
   - Kopyaladığınız kodu **"Google OAuth Client ID"** kutusuna yapıştırıp **"Kaydet"** butonuna basın.
3. **"Google ile Giriş Yap"** butonuna tıklayın.
4. Google onay penceresinde Gmail hesabınızı seçip izin verin.
5. Artık:
   - Profil resminiz ve adınız görünecektir.
   - **"Verileri Şimdi Drive'a Yedekle"** butonuna basarak tüm verilerinizi ve dekontlarınızı buluta aktarabilirsiniz.
   - **"Otomatik Senkronizasyon"** açık olduğu sürece eklediğiniz veya düzenlediğiniz her kayıt otomatik olarak Google Drive'ınıza yedeklenecektir!
