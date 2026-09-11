/**
 * Aylık Hesap Gelir-Gider Defteri - Google Drive Bulut Senkronizasyon Modülü
 * Google Identity Services (GIS) & Google Drive API v3
 * Oluşturan: Hakan Korkmaz (c) 2026
 */

(function () {
    const DRIVE_FILE_NAME = 'gelir_gider_veriler.json';
    const FOLDER_NAME = 'Gelir-Gider Defteri Yedekleri';
    const SCOPES = 'https://www.googleapis.com/auth/drive.file email profile openid';

    let tokenClient = null;
    let isSyncing = false;

    // LocalStorage Anahtarları
    const LS_CLIENT_ID = 'gdrive_client_id';
    const LS_AUTO_SYNC = 'gdrive_auto_sync';
    const LS_LAST_SYNC = 'gdrive_last_sync';
    const LS_USER_INFO = 'gdrive_user_info';
    const LS_ACCESS_TOKEN = 'gdrive_access_token';
    const LS_TOKEN_EXPIRY = 'gdrive_token_expiry';
    const LS_IS_LOGGED_IN = 'gdrive_is_logged_in';
    const LS_FOLDER_ID = 'gdrive_folder_id';
    const LS_FILE_ID = 'gdrive_file_id';

    // Sayfa açılışında belleğe yükle
    let accessToken = localStorage.getItem(LS_ACCESS_TOKEN) || null;
    let tokenExpiryTime = parseInt(localStorage.getItem(LS_TOKEN_EXPIRY), 10) || 0;
    let currentUser = null;
    try {
        const rawUser = localStorage.getItem(LS_USER_INFO);
        if (rawUser) currentUser = JSON.parse(rawUser);
    } catch (e) {}

    // Yetkili Fetch Yardımcısı: 401 durumunda token yeniler ve hata detaylarını net olarak ayrıştırır
    async function fetchWithAuth(url, options = {}) {
        let token = await GoogleDrive.ensureAccessToken();
        options.headers = options.headers || {};
        options.headers['Authorization'] = `Bearer ${token}`;

        let res = await fetch(url, options);

        // Token geçersiz veya süresi dolmuşsa (401), sessizce token'ı yenileyip bir kez daha dene
        if (res.status === 401) {
            console.warn('Google Access Token 401 döndü, token yenileniyor...');
            try {
                token = await GoogleDrive.refreshToken();
                options.headers['Authorization'] = `Bearer ${token}`;
                res = await fetch(url, options);
            } catch (refreshErr) {
                throw new Error('Google oturumunuzun süresi doldu. Lütfen önce "Google ile Giriş Yap" butonuna basarak tekrar oturum açın.');
            }
        }

        if (!res.ok) {
            let errMessage = '';
            try {
                const errJson = await res.json();
                if (errJson && errJson.error) {
                    errMessage = errJson.error.message || JSON.stringify(errJson.error);
                }
            } catch (e) {
                errMessage = res.statusText;
            }
            throw new Error(`Google Drive Hatası (${res.status}): ${errMessage || 'İşlem gerçekleştirilemedi.'}`);
        }

        return res;
    }

    const GoogleDrive = {
        getClientId() {
            return localStorage.getItem(LS_CLIENT_ID) || '';
        },

        setClientId(clientId) {
            localStorage.setItem(LS_CLIENT_ID, (clientId || '').trim());
            tokenClient = null; // Client ID değişirse yeniden başlat
        },

        isAutoSyncEnabled() {
            // Varsayılan olarak açık (true)
            const val = localStorage.getItem(LS_AUTO_SYNC);
            return val === null ? true : val === 'true';
        },

        setAutoSync(enabled) {
            localStorage.setItem(LS_AUTO_SYNC, enabled ? 'true' : 'false');
        },

        getLastSyncTime() {
            return localStorage.getItem(LS_LAST_SYNC) || null;
        },

        getUserInfo() {
            if (currentUser) return currentUser;
            try {
                const raw = localStorage.getItem(LS_USER_INFO);
                if (raw) {
                    currentUser = JSON.parse(raw);
                    return currentUser;
                }
            } catch (e) {}
            return null;
        },

        isSignedIn() {
            if (!accessToken) {
                const storedToken = localStorage.getItem(LS_ACCESS_TOKEN);
                const storedExpiry = parseInt(localStorage.getItem(LS_TOKEN_EXPIRY), 10) || 0;
                if (storedToken && Date.now() < storedExpiry) {
                    accessToken = storedToken;
                    tokenExpiryTime = storedExpiry;
                }
            }
            return !!accessToken && Date.now() < tokenExpiryTime;
        },

        // Kullanıcı daha önce Google ile oturum açtı mı?
        isConnected() {
            return localStorage.getItem(LS_IS_LOGGED_IN) === 'true' || !!this.getUserInfo();
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
                    const expiresIn = (parseInt(tokenResponse.expires_in, 10) || 3600) * 1000;
                    tokenExpiryTime = Date.now() + expiresIn - 60000; // 1 dk pay bırak

                    // Kalıcı depolamaya kaydet
                    localStorage.setItem(LS_ACCESS_TOKEN, accessToken);
                    localStorage.setItem(LS_TOKEN_EXPIRY, tokenExpiryTime.toString());
                    localStorage.setItem(LS_IS_LOGGED_IN, 'true');

                    // Kullanıcı profil bilgilerini çek
                    this.fetchUserInfo()
                        .then(user => {
                            if (callback) callback(null, user);
                        })
                        .catch(err => {
                            console.warn('Profil çekilemedi, varsayılan kullanıcı atanıyor:', err);
                            const fallbackUser = this.getUserInfo() || {
                                name: 'Google Kullanıcısı',
                                email: 'Google Drive Bağlandı',
                                picture: ''
                            };
                            localStorage.setItem(LS_USER_INFO, JSON.stringify(fallbackUser));
                            currentUser = fallbackUser;
                            if (callback) callback(null, fallbackUser);
                        });
                }
            });
        },

        // Oturum Açma Penceresini Başlat
        signIn() {
            return new Promise((resolve, reject) => {
                try {
                    this.initTokenClient((err, user) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(user);
                        }
                    });

                    // Google OAuth penceresini aç
                    tokenClient.requestAccessToken({ prompt: 'consent' });
                } catch (e) {
                    reject(e);
                }
            });
        },

        // Token Yenileme (Sessiz)
        refreshToken() {
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

        // Oturumu Kapat
        signOut() {
            if (accessToken && window.google && window.google.accounts && window.google.accounts.oauth2) {
                try {
                    google.accounts.oauth2.revoke(accessToken, () => {
                        console.log('Google erişim yetkisi kaldırıldı.');
                    });
                } catch (e) {}
            }
            accessToken = null;
            tokenExpiryTime = 0;
            currentUser = null;
            localStorage.removeItem(LS_IS_LOGGED_IN);
            localStorage.removeItem(LS_ACCESS_TOKEN);
            localStorage.removeItem(LS_TOKEN_EXPIRY);
            localStorage.removeItem(LS_USER_INFO);
            localStorage.removeItem(LS_FOLDER_ID);
            localStorage.removeItem(LS_FILE_ID);
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
                    // Sessiz yenileme yapılamazsa ve kullanıcı önceden giriş yapmışsa onay penceresi aç
                    if (tokenClient) {
                        try {
                            tokenClient.requestAccessToken({ prompt: 'consent' });
                        } catch (err2) {
                            reject(e);
                        }
                    } else {
                        reject(e);
                    }
                }
            });
        },

        // Kullanıcı Profil Bilgisini Al (Google UserInfo API)
        async fetchUserInfo() {
            if (!accessToken) return this.getUserInfo();

            try {
                const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    currentUser = {
                        name: data.name || data.given_name || 'Google Kullanıcısı',
                        email: data.email || 'Kişisel Hesap',
                        picture: data.picture || ''
                    };
                    localStorage.setItem(LS_USER_INFO, JSON.stringify(currentUser));
                    localStorage.setItem(LS_IS_LOGGED_IN, 'true');
                    return currentUser;
                }
            } catch (e) {
                console.warn('Google UserInfo API çağrılamadı:', e);
            }

            const existing = this.getUserInfo();
            if (existing) return existing;

            const fallback = {
                name: 'Google Kullanıcısı',
                email: 'Google Drive Bağlandı',
                picture: ''
            };
            localStorage.setItem(LS_USER_INFO, JSON.stringify(fallback));
            currentUser = fallback;
            return fallback;
        },

        // Google Drive'da Uygulama Klasörünü Bul veya Oluştur
        async getOrCreateFolder() {
            // 1. Önce localStorage'da kayıtlı folderId var mı ve geçerli mi bakalım
            const cachedFolderId = localStorage.getItem(LS_FOLDER_ID);
            if (cachedFolderId) {
                try {
                    const checkRes = await fetchWithAuth(`https://www.googleapis.com/drive/v3/files/${cachedFolderId}?fields=id,trashed`);
                    const checkData = await checkRes.json();
                    if (checkData && !checkData.trashed) {
                        return cachedFolderId;
                    }
                } catch (e) {
                    localStorage.removeItem(LS_FOLDER_ID);
                }
            }

            // 2. Klasör var mı ara
            const q = `name = '${FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
            const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&spaces=drive&fields=files(id, name)`;

            const res = await fetchWithAuth(searchUrl);
            const data = await res.json();

            if (data.files && data.files.length > 0) {
                const folderId = data.files[0].id;
                localStorage.setItem(LS_FOLDER_ID, folderId);
                return folderId;
            }

            // 3. Yoksa yeni klasör oluştur
            const createRes = await fetchWithAuth('https://www.googleapis.com/drive/v3/files', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: FOLDER_NAME,
                    mimeType: 'application/vnd.google-apps.folder'
                })
            });

            const folder = await createRes.json();
            if (folder && folder.id) {
                localStorage.setItem(LS_FOLDER_ID, folder.id);
                return folder.id;
            }
            throw new Error('Drive üzerinde klasör oluşturulamadı.');
        },

        // Mevcut Veritabanı Dosyasını Bul
        async findDatabaseFile(folderId) {
            // 1. Önce localStorage'da kayıtlı fileId var mı ve geçerli mi bakalım
            const cachedFileId = localStorage.getItem(LS_FILE_ID);
            if (cachedFileId) {
                try {
                    const checkRes = await fetchWithAuth(`https://www.googleapis.com/drive/v3/files/${cachedFileId}?fields=id,name,trashed`);
                    const checkData = await checkRes.json();
                    if (checkData && !checkData.trashed) {
                        return checkData;
                    }
                } catch (e) {
                    localStorage.removeItem(LS_FILE_ID);
                }
            }

            // 2. Dosyayı klasör içinde ara
            if (folderId) {
                const q = `'${folderId}' in parents and name = '${DRIVE_FILE_NAME}' and trashed = false`;
                const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&spaces=drive&fields=files(id, name, modifiedTime)`;

                const res = await fetchWithAuth(url);
                const data = await res.json();
                if (data.files && data.files.length > 0) {
                    const file = data.files[0];
                    localStorage.setItem(LS_FILE_ID, file.id);
                    return file;
                }
            }

            // 3. Bulunamadıysa genel olarak dosya adıyla ara (klasör dışına kaydedildiyse bile kurtarmak için)
            const fallbackQ = `name = '${DRIVE_FILE_NAME}' and trashed = false`;
            const fallbackUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(fallbackQ)}&spaces=drive&fields=files(id, name, modifiedTime)`;
            try {
                const fbRes = await fetchWithAuth(fallbackUrl);
                const fbData = await fbRes.json();
                if (fbData.files && fbData.files.length > 0) {
                    const file = fbData.files[0];
                    localStorage.setItem(LS_FILE_ID, file.id);
                    return file;
                }
            } catch (fbErr) {}

            return null;
        },

        // 1. VERİLERİ GOOGLE DRIVE'A YEDEKLE (UPLOAD / SYNC)
        async syncToDrive() {
            if (isSyncing) return;
            isSyncing = true;

            try {
                const folderId = await this.getOrCreateFolder();
                const existingFile = await this.findDatabaseFile(folderId);

                // Yerel verileri hazırla
                const jsonData = await window.DB.exportAllJSON();

                let savedFileId = null;

                if (existingFile && existingFile.id) {
                    // Dosyayı güncelle
                    const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`;
                    const updateRes = await fetchWithAuth(updateUrl, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json; charset=utf-8'
                        },
                        body: jsonData
                    });
                    const updatedData = await updateRes.json();
                    savedFileId = updatedData.id || existingFile.id;
                } else {
                    // Yeni dosya oluştur
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
                    const createRes = await fetchWithAuth(createUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': `multipart/related; boundary=${boundary}`
                        },
                        body: multipartRequestBody
                    });
                    const createdData = await createRes.json();
                    savedFileId = createdData.id;
                }

                if (savedFileId) {
                    localStorage.setItem(LS_FILE_ID, savedFileId);
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
                const folderId = await this.getOrCreateFolder();
                const file = await this.findDatabaseFile(folderId);

                if (!file || !file.id) {
                    throw new Error('Google Drive hesabınızda henüz bir yedek dosyası bulunamadı! Lütfen önce "Verileri Şimdi Drive\'a Yedekle" butonuna tıklayarak ilk yedeğinizi alın.');
                }

                const downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
                const res = await fetchWithAuth(downloadUrl);
                const jsonContent = await res.text();

                if (!jsonContent || jsonContent.trim().length === 0) {
                    throw new Error('İndirilen yedek dosyası boş görünüyor.');
                }

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
