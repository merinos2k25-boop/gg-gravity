/**
 * Aylık Hesap Gelir-Gider Defteri - Google Drive Bulut Senkronizasyon Modülü
 * Google Identity Services (GIS) & Google Drive API v3
 * Oluşturan: Hakan Korkmaz (c) 2026
 */

(function () {
    const DRIVE_FILE_NAME = 'gelir_gider_veriler.json';
    const FOLDER_NAME = 'Gelir-Gider Defteri (Bulut Yedekleri)';
    const SCOPES = 'https://www.googleapis.com/auth/drive.file';

    let tokenClient = null;
    let accessToken = null;
    let tokenExpiryTime = 0;
    let currentUser = null;
    let isSyncing = false;

    // LocalStorage Anahtarları
    const LS_CLIENT_ID = 'gdrive_client_id';
    const LS_AUTO_SYNC = 'gdrive_auto_sync';
    const LS_LAST_SYNC = 'gdrive_last_sync';
    const LS_USER_INFO = 'gdrive_user_info';

    const GoogleDrive = {
        getClientId() {
            return localStorage.getItem(LS_CLIENT_ID) || '';
        },

        setClientId(clientId) {
            localStorage.setItem(LS_CLIENT_ID, (clientId || '').trim());
            tokenClient = null; // Client ID değişirse yeniden başlat
        },

        isAutoSyncEnabled() {
            return localStorage.getItem(LS_AUTO_SYNC) === 'true';
        },

        setAutoSync(enabled) {
            localStorage.setItem(LS_AUTO_SYNC, enabled ? 'true' : 'false');
        },

        getLastSyncTime() {
            return localStorage.getItem(LS_LAST_SYNC) || null;
        },

        getUserInfo() {
            try {
                const raw = localStorage.getItem(LS_USER_INFO);
                return raw ? JSON.parse(raw) : null;
            } catch (e) {
                return null;
            }
        },

        isSignedIn() {
            return !!accessToken && Date.now() < tokenExpiryTime;
        },

        // Google Identity Services Token İstemcisini Başlatma
        initTokenClient(callback) {
            const clientId = this.getClientId();
            if (!clientId) {
                throw new Error('Lütfen önce Google OAuth Client ID bilginizi giriniz!');
            }

            if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
                throw new Error('Google Kimlik Servisi yüklenemedi. Lütfen internet bağlantınızı kontrol ediniz.');
            }

            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                scope: SCOPES,
                callback: (tokenResponse) => {
                    if (tokenResponse.error) {
                        console.error('Google OAuth Hatası:', tokenResponse);
                        if (callback) callback(new Error(tokenResponse.error_description || tokenResponse.error));
                        return;
                    }

                    accessToken = tokenResponse.access_token;
                    // Token varsayılan 3599 saniye geçerlidir
                    const expiresIn = (parseInt(tokenResponse.expires_in, 10) || 3600) * 1000;
                    tokenExpiryTime = Date.now() + expiresIn - 60000; // 1 dk pay bırak

                    // Kullanıcı bilgilerini çek
                    this.fetchUserInfo()
                        .then(user => {
                            if (callback) callback(null, user);
                        })
                        .catch(err => {
                            if (callback) callback(null, null);
                        });
                }
            });
        },

        // Oturum Açma Penceresini Başlat
        signIn() {
            return new Promise((resolve, reject) => {
                try {
                    this.initTokenClient((err, user) => {
                        if (err) reject(err);
                        else resolve(user);
                    });

                    // Google OAuth penceresini aç
                    tokenClient.requestAccessToken({ prompt: 'consent' });
                } catch (e) {
                    reject(e);
                }
            });
        },

        // Oturumu Kapat
        signOut() {
            if (accessToken && window.google && google.accounts.oauth2) {
                google.accounts.oauth2.revoke(accessToken, () => {
                    console.log('Google erişim yetkisi kaldırıldı.');
                });
            }
            accessToken = null;
            tokenExpiryTime = 0;
            currentUser = null;
            localStorage.removeItem(LS_USER_INFO);
        },

        // Token Geçerliliğini Sağla (Gerekiyorsa sessizce yenile)
        async ensureAccessToken() {
            if (this.isSignedIn()) return accessToken;

            return new Promise((resolve, reject) => {
                try {
                    this.initTokenClient((err) => {
                        if (err) reject(err);
                        else resolve(accessToken);
                    });
                    tokenClient.requestAccessToken({ prompt: '' });
                } catch (e) {
                    reject(e);
                }
            });
        },

        // Kullanıcı Profil Bilgisini Al (Google UserInfo API)
        async fetchUserInfo() {
            if (!accessToken) return null;

            try {
                const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    currentUser = {
                        name: data.name,
                        email: data.email,
                        picture: data.picture
                    };
                    localStorage.setItem(LS_USER_INFO, JSON.stringify(currentUser));
                    return currentUser;
                }
            } catch (e) {
                console.warn('Kullanıcı bilgisi alınamadı:', e);
            }
            return null;
        },

        // Google Drive'da Uygulama Klasörünü Bul veya Oluştur
        async getOrCreateFolder() {
            const token = await this.ensureAccessToken();

            // Klasör var mı kontrol et
            const q = `name = '${FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
            const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id, name)`;

            const res = await fetch(searchUrl, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!res.ok) {
                throw new Error('Google Drive dosyaları aranamadı: ' + res.statusText);
            }

            const data = await res.json();
            if (data.files && data.files.length > 0) {
                return data.files[0].id;
            }

            // Yoksa yeni klasör oluştur
            const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: FOLDER_NAME,
                    mimeType: 'application/vnd.google-apps.folder'
                })
            });

            if (!createRes.ok) {
                throw new Error('Drive üzerinde klasör oluşturulamadı.');
            }

            const folder = await createRes.json();
            return folder.id;
        },

        // Mevcut Veritabanı Dosyasını Bul
        async findDatabaseFile(folderId) {
            const token = await this.ensureAccessToken();
            const q = `'${folderId}' in parents and name = '${DRIVE_FILE_NAME}' and trashed = false`;
            const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id, name, modifiedTime)`;

            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!res.ok) return null;
            const data = await res.json();
            return (data.files && data.files.length > 0) ? data.files[0] : null;
        },

        // 1. VERİLERİ GOOGLE DRIVE'A YEDEKLE (UPLOAD / SYNC)
        async syncToDrive() {
            if (isSyncing) return;
            isSyncing = true;

            try {
                const token = await this.ensureAccessToken();
                const folderId = await this.getOrCreateFolder();
                const existingFile = await this.findDatabaseFile(folderId);

                // Yerel verileri hazırla
                const jsonData = await window.DB.exportAllJSON();

                if (existingFile) {
                    // Dosyayı güncelle (PATCH /upload/drive/v3/files/fileId)
                    const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`;
                    const updateRes = await fetch(updateUrl, {
                        method: 'PATCH',
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json; charset=utf-8'
                        },
                        body: jsonData
                    });

                    if (!updateRes.ok) {
                        throw new Error('Dosya güncellenemedi: ' + updateRes.statusText);
                    }
                } else {
                    // Yeni dosya oluştur (Multipart upload)
                    const metadata = {
                        name: DRIVE_FILE_NAME,
                        parents: [folderId],
                        mimeType: 'application/json'
                    };

                    const boundary = '-------314159265358979323846';
                    const delimiter = `\r\n--${boundary}\r\n`;
                    const closeDelim = `\r\n--${boundary}--`;

                    const multipartRequestBody =
                        delimiter +
                        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
                        JSON.stringify(metadata) +
                        delimiter +
                        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
                        jsonData +
                        closeDelim;

                    const createUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
                    const createRes = await fetch(createUrl, {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': `multipart/related; boundary=${boundary}`
                        },
                        body: multipartRequestBody
                    });

                    if (!createRes.ok) {
                        throw new Error('Yeni dosya yüklenemedi: ' + createRes.statusText);
                    }
                }

                const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                localStorage.setItem(LS_LAST_SYNC, now);
                return { success: true, time: now };
            } finally {
                isSyncing = false;
            }
        },

        // 2. GOOGLE DRIVE'DAN VERİLERİ İNDİR VE GERİ YÜKLE (RESTORE / DOWNLOAD)
        async restoreFromDrive() {
            if (isSyncing) return;
            isSyncing = true;

            try {
                const token = await this.ensureAccessToken();
                const folderId = await this.getOrCreateFolder();
                const file = await this.findDatabaseFile(folderId);

                if (!file) {
                    throw new Error('Google Drive klasörünüzde henüz yedek dosyası bulunamadı!');
                }

                // Dosya içeriğini indir
                const downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
                const res = await fetch(downloadUrl, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (!res.ok) {
                    throw new Error('Yedek dosyası indirilemedi: ' + res.statusText);
                }

                const jsonContent = await res.text();
                // Veritabanına içe aktar
                await window.DB.importAllJSON(jsonContent);

                const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                localStorage.setItem(LS_LAST_SYNC, now);

                return { success: true, time: now };
            } finally {
                isSyncing = false;
            }
        }
    };

    window.GoogleDrive = GoogleDrive;
})();
