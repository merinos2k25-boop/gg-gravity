/**
 * Aylık Hesap Gelir-Gider Defteri - Veri Depolama Katmanı (IndexedDB & Fallback)
 * Oluşturan: Hakan Korkmaz (c) 2026
 */
(function () {
    const DB_NAME = 'GelirGiderDefteriDB';
const DB_VERSION = 1;
const STORE_TRANSACTIONS = 'transactions';
const STORE_SETTINGS = 'settings';

let dbInstance = null;

// IndexedDB Başlatma
function openDatabase() {
    return new Promise((resolve) => {
        if (dbInstance) {
            resolve(dbInstance);
            return;
        }

        if (!window.indexedDB) {
            resolve(null);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_TRANSACTIONS)) {
                const txStore = db.createObjectStore(STORE_TRANSACTIONS, { keyPath: 'id' });
                txStore.createIndex('category', 'category', { unique: false });
                txStore.createIndex('dueDate', 'dueDate', { unique: false });
                txStore.createIndex('isPaid', 'isPaid', { unique: false });
            }
            if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
                db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
            }
        };

        request.onsuccess = (event) => {
            dbInstance = event.target.result;
            resolve(dbInstance);
        };

        request.onerror = (event) => {
            console.error('IndexedDB açılamadı, LocalStorage kullanılacak:', event);
            resolve(null);
        };
    });
}

// LocalStorage Yedek / Fallback
const LS_TX_KEY = 'gelir_gider_transactions_v2';
const LS_SET_KEY = 'gelir_gider_settings_v2';

function getLocalStorageTx() {
    try {
        const raw = localStorage.getItem(LS_TX_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

function saveLocalStorageTx(txs) {
    try {
        localStorage.setItem(LS_TX_KEY, JSON.stringify(txs));
    } catch (e) {
        console.warn('LocalStorage kotası aşıldı:', e);
    }
}
const DB = {
    async getAllTransactions() {
        const db = await openDatabase();
        if (!db) return getLocalStorageTx();

        return new Promise((resolve) => {
            try {
                const tx = db.transaction([STORE_TRANSACTIONS], 'readonly');
                const store = tx.objectStore(STORE_TRANSACTIONS);
                const req = store.getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => resolve(getLocalStorageTx());
            } catch (e) {
                resolve(getLocalStorageTx());
            }
        });
    },

    async getTransactionById(id) {
        const db = await openDatabase();
        if (!db) {
            const list = getLocalStorageTx();
            return list.find(t => t.id === id) || null;
        }

        return new Promise((resolve) => {
            try {
                const tx = db.transaction([STORE_TRANSACTIONS], 'readonly');
                const store = tx.objectStore(STORE_TRANSACTIONS);
                const req = store.get(id);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => resolve(null);
            } catch (e) {
                resolve(null);
            }
        });
    },

    async saveTransaction(item) {
        if (!item.id) {
            item.id = 'tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        }
        item.updatedAt = new Date().toISOString();
        if (!item.createdAt) {
            item.createdAt = new Date().toISOString();
        }

        const db = await openDatabase();
        if (!db) {
            const list = getLocalStorageTx();
            const idx = list.findIndex(t => t.id === item.id);
            if (idx >= 0) list[idx] = item;
            else list.unshift(item);
            saveLocalStorageTx(list);
            return item;
        }

        return new Promise((resolve, reject) => {
            try {
                const tx = db.transaction([STORE_TRANSACTIONS], 'readwrite');
                const store = tx.objectStore(STORE_TRANSACTIONS);
                const req = store.put(item);
                req.onsuccess = () => resolve(item);
                req.onerror = (e) => reject(e.target.error);
            } catch (e) {
                reject(e);
            }
        });
    },

    async deleteTransaction(id) {
        const db = await openDatabase();
        if (!db) {
            let list = getLocalStorageTx();
            list = list.filter(t => t.id !== id);
            saveLocalStorageTx(list);
            return true;
        }

        return new Promise((resolve, reject) => {
            try {
                const tx = db.transaction([STORE_TRANSACTIONS], 'readwrite');
                const store = tx.objectStore(STORE_TRANSACTIONS);
                const req = store.delete(id);
                req.onsuccess = () => resolve(true);
                req.onerror = (e) => reject(e.target.error);
            } catch (e) {
                reject(e);
            }
        });
    },

    async getSettings() {
        const defaultSettings = {
            darkMode: 'auto', // 'light' | 'dark' | 'auto'
            themeColor: 'emerald', // 'emerald' | 'sapphire' | 'violet' | 'amber' | 'rose'
            fontFamily: 'Inter',
            userName: 'Hakan Korkmaz'
        };

        const db = await openDatabase();
        if (!db) {
            try {
                const s = localStorage.getItem(LS_SET_KEY);
                return s ? { ...defaultSettings, ...JSON.parse(s) } : defaultSettings;
            } catch (e) {
                return defaultSettings;
            }
        }

        return new Promise((resolve) => {
            try {
                const tx = db.transaction([STORE_SETTINGS], 'readonly');
                const store = tx.objectStore(STORE_SETTINGS);
                const req = store.get('app_settings');
                req.onsuccess = () => {
                    if (req.result && req.result.value) {
                        resolve({ ...defaultSettings, ...req.result.value });
                    } else {
                        resolve(defaultSettings);
                    }
                };
                req.onerror = () => resolve(defaultSettings);
            } catch (e) {
                resolve(defaultSettings);
            }
        });
    },

    async saveSettings(settingsObj) {
        localStorage.setItem(LS_SET_KEY, JSON.stringify(settingsObj));

        const db = await openDatabase();
        if (!db) return settingsObj;

        return new Promise((resolve) => {
            try {
                const tx = db.transaction([STORE_SETTINGS], 'readwrite');
                const store = tx.objectStore(STORE_SETTINGS);
                const req = store.put({ key: 'app_settings', value: settingsObj });
                req.onsuccess = () => resolve(settingsObj);
                req.onerror = () => resolve(settingsObj);
            } catch (e) {
                resolve(settingsObj);
            }
        });
    },

    async exportAllJSON() {
        const txs = await this.getAllTransactions();
        const settings = await this.getSettings();
        const exportData = {
            appName: 'Aylık Hesap Gelir-Gider Defteri',
            author: 'HAKAN KORKMAZ',
            copyright: 'Copyright 2026',
            exportDate: new Date().toISOString(),
            version: '2.0',
            settings: settings,
            transactions: txs
        };
        return JSON.stringify(exportData, null, 2);
    },

    async importAllJSON(jsonString) {
        const data = JSON.parse(jsonString);
        if (!data || !Array.isArray(data.transactions)) {
            throw new Error('Geçersiz veri formatı! "transactions" listesi bulunamadı.');
        }

        const db = await openDatabase();
        if (db) {
            const tx = db.transaction([STORE_TRANSACTIONS, STORE_SETTINGS], 'readwrite');
            const txStore = tx.objectStore(STORE_TRANSACTIONS);
            await new Promise((res, rej) => {
                const req = txStore.clear();
                req.onsuccess = res;
                req.onerror = rej;
            });
            for (const item of data.transactions) {
                txStore.put(item);
            }
            if (data.settings) {
                const setStore = tx.objectStore(STORE_SETTINGS);
                setStore.put({ key: 'app_settings', value: data.settings });
            }
        }

        saveLocalStorageTx(data.transactions);
        if (data.settings) {
            localStorage.setItem(LS_SET_KEY, JSON.stringify(data.settings));
        }

        return true;
    },

    async clearAllData() {
        const db = await openDatabase();
        if (db) {
            const tx = db.transaction([STORE_TRANSACTIONS], 'readwrite');
            tx.objectStore(STORE_TRANSACTIONS).clear();
        }
        localStorage.removeItem(LS_TX_KEY);
        return true;
    },

    async seedSampleData() {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

        const samples = [
            {
                id: 'seed_1',
                type: 'income',
                category: 'gelir',
                title: 'Aylık Maaş Geliri',
                amount: 68500,
                dueDate: `${currentYear}-${currentMonth}-05`,
                isPaid: true,
                paidDate: `${currentYear}-${currentMonth}-05`,
                receiptImage: null,
                notes: 'Aylık net maaş girişi'
            },
            {
                id: 'seed_2',
                type: 'expense',
                category: 'elektrik',
                title: 'Elektrik Faturası',
                amount: 845.50,
                dueDate: `${currentYear}-${currentMonth}-15`,
                isPaid: true,
                paidDate: `${currentYear}-${currentMonth}-12`,
                receiptImage: null,
                notes: 'CK Boğaziçi elektrik aboneliği'
            },
            {
                id: 'seed_3',
                type: 'expense',
                category: 'su',
                title: 'Su Faturası',
                amount: 340.00,
                dueDate: `${currentYear}-${currentMonth}-18`,
                isPaid: false,
                paidDate: null,
                receiptImage: null,
                notes: 'İSKİ su faturası'
            },
            {
                id: 'seed_4',
                type: 'expense',
                category: 'dogalgaz',
                title: 'Doğalgaz Faturası',
                amount: 1650.00,
                dueDate: `${currentYear}-${currentMonth}-20`,
                isPaid: false,
                paidDate: null,
                receiptImage: null,
                notes: 'Kış dönemi doğalgaz gideri'
            },
            {
                id: 'seed_5',
                type: 'expense',
                category: 'internet',
                title: 'İnternet Faturası',
                amount: 499.90,
                dueDate: `${currentYear}-${currentMonth}-10`,
                isPaid: true,
                paidDate: `${currentYear}-${currentMonth}-09`,
                receiptImage: null,
                notes: 'Ev fiber internet hizmeti'
            },
            {
                id: 'seed_6',
                type: 'expense',
                category: 'telefon',
                title: 'Kişisel Telefon Faturam',
                amount: 420.00,
                dueDate: `${currentYear}-${currentMonth}-24`,
                isPaid: false,
                paidDate: null,
                receiptImage: null,
                notes: 'Turkcell faturalı hat paketi'
            },
            {
                id: 'seed_7',
                type: 'expense',
                category: 'banka',
                title: 'Banka Kredi Kartı Borcu',
                amount: 14200.00,
                dueDate: `${currentYear}-${currentMonth}-16`,
                isPaid: false,
                paidDate: null,
                receiptImage: null,
                notes: 'Aylık kredi kartı ekstre toplamı'
            },
            {
                id: 'seed_8',
                type: 'expense',
                category: 'taksit',
                title: 'Laptop Taksiti',
                installmentTitle: 'MacBook Pro Taksiti',
                installmentCurrent: 4,
                installmentTotal: 12,
                amount: 5250.00,
                dueDate: `${currentYear}-${currentMonth}-14`,
                isPaid: true,
                paidDate: `${currentYear}-${currentMonth}-13`,
                receiptImage: null,
                notes: '12 aylık teknoloji taksiti (4. ay)'
            },
            {
                id: 'seed_9',
                type: 'expense',
                category: 'taksit',
                title: 'Beyaz Eşya Taksiti',
                installmentTitle: 'Buzdolabı Taksiti',
                installmentCurrent: 7,
                installmentTotal: 9,
                amount: 3100.00,
                dueDate: `${currentYear}-${currentMonth}-26`,
                isPaid: false,
                paidDate: null,
                receiptImage: null,
                notes: 'Bitmesine 2 ay kaldı'
            }
        ];

        for (const item of samples) {
            await this.saveTransaction(item);
        }

        return true;
    }
};

    window.DB = DB;
})();
