/**
 * Aylık Hesap Gelir-Gider Defteri - Ana Uygulama Mantığı
 * Oluşturan: Hakan Korkmaz (c) 2026
 */
(function () {
    const DB = window.DB;
    const Analytics = window.Analytics || {};
    const calculateMonthlyAnalytics = Analytics.calculateMonthlyAnalytics || (() => ({ monthlyTx: [], totalIncome: 0, totalExpense: 0, totalBills: 0, totalInstallments: 0, totalBankDebts: 0, totalOtherExpenses: 0, totalPaidExpenses: 0, totalUnpaidExpenses: 0, netSavings: 0 }));
    const renderCharts = Analytics.renderCharts || (() => {});
    const BILL_CATEGORIES = Analytics.BILL_CATEGORIES || ['su', 'elektrik', 'internet', 'dogalgaz', 'telefon'];

// Kategori Tanımları & İkon Eşleştirmeleri
const CATEGORY_META = {
    su: { name: 'Su Faturası', emoji: '💧', icon: 'droplet', color: '#0ea5e9' },
    elektrik: { name: 'Elektrik Faturası', emoji: '⚡', icon: 'zap', color: '#f59e0b' },
    internet: { name: 'İnternet Faturası', emoji: '🌐', icon: 'wifi', color: '#3b82f6' },
    dogalgaz: { name: 'Doğalgaz Faturası', emoji: '🔥', icon: 'flame', color: '#f97316' },
    telefon: { name: 'Kişisel Telefon Faturam', emoji: '📱', icon: 'smartphone', color: '#8b5cf6' },
    banka: { name: 'Bankaya Yapılan Borçlar', emoji: '🏦', icon: 'landmark', color: '#ef4444' },
    taksit: { name: 'Taksit Gideri', emoji: '💳', icon: 'credit-card', color: '#6366f1' },
    gelir: { name: 'Gelir / Maaş', emoji: '💰', icon: 'arrow-down-left', color: '#10b981' },
    diger: { name: 'Diğer Harcamalar', emoji: '🏷️', icon: 'tag', color: '#64748b' }
};

// Uygulama Durumu (State)
const AppState = {
    activeTab: 'tab-home',
    transactions: [],
    settings: {},
    activeFilter: 'all',
    searchQuery: '',
    selectedYear: new Date().getFullYear(),
    selectedMonth: new Date().getMonth() + 1,
    currentDetailTx: null,
    tempReceiptDataUrl: null
};

// Uygulamayı Başlat
async function initApp() {
    try {
        // 1. Önce TÜM buton ve gezinme olaylarını derhal bağla
        setupNavigation();
        setupModals();
        setupEventListeners();
        setupAccordions();
        setupYearMonthSelectors();

        // 2. Ayarları ve Verileri Yükle
        try {
            await initSettings();
            await loadData();

            // İlk Kurulum Kontrolü (Veri yoksa otomatik örnek veri yükleme)
            if (AppState.transactions.length === 0) {
                await DB.seedSampleData();
                await loadData();
            }
        } catch (storageErr) {
            console.warn('Depolama başlatma uyarısı:', storageErr);
        }

        // 3. Arayüzü Çiz
        renderAll();

        // 4. Lucide ikonlarını oluştur
        if (window.lucide) {
            lucide.createIcons();
        }
    } catch (e) {
        console.error('Uygulama başlatma hatası:', e);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}


// Ayarların Yüklenmesi ve Uygulanması
async function initSettings() {
    AppState.settings = await DB.getSettings();
    applySettingsToDOM(AppState.settings);
}

function applySettingsToDOM(settings) {
    // Renk Teması
    if (settings.themeColor) {
        document.body.setAttribute('data-theme-color', settings.themeColor);
        document.querySelectorAll('.theme-dot').forEach(dot => {
            dot.classList.toggle('active', dot.getAttribute('data-color') === settings.themeColor);
        });
    }

    // Yazı Tipi
    if (settings.fontFamily) {
        document.body.style.setProperty('--app-font', `'${settings.fontFamily}', system-ui, sans-serif`);
        const fontSelect = document.getElementById('settingFontFamily');
        if (fontSelect) fontSelect.value = settings.fontFamily;
    }

    // Koyu Mod
    const darkSelect = document.getElementById('settingDarkMode');
    if (darkSelect) darkSelect.value = settings.darkMode || 'auto';

    applyThemeMode(settings.darkMode);
}

function applyThemeMode(mode) {
    const themeIcon = document.getElementById('themeIcon');
    let isDark = false;

    if (mode === 'dark') {
        document.body.classList.add('dark');
        isDark = true;
    } else if (mode === 'light') {
        document.body.classList.remove('dark');
        isDark = false;
    } else {
        // Sistem Tercihi
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
            document.body.classList.add('dark');
            isDark = true;
        } else {
            document.body.classList.remove('dark');
            isDark = false;
        }
    }

    if (themeIcon) {
        themeIcon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
        if (window.lucide) lucide.createIcons();
    }

    // Analiz grafiklerini tema moduna göre yeniden çiz
    if (AppState.activeTab === 'tab-analysis') {
        updateAnalysisTab();
    }
}

// Verileri DB'den Çekme
async function loadData() {
    AppState.transactions = await DB.getAllTransactions();
}

// Tüm Görünümleri Güncelle
function renderAll() {
    updatePeriodHeader();
    renderHomeTab();
    renderRecordsTab();
    updateAnalysisTab();
    if (window.lucide) {
        lucide.createIcons();
    }
}

// Dönem Başlığını Güncelle
function updatePeriodHeader() {
    const monthsTr = [
        'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
        'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
    ];
    const el = document.getElementById('currentPeriodLabel');
    if (el) {
        el.textContent = `${monthsTr[AppState.selectedMonth - 1]} ${AppState.selectedYear}`;
    }
}

// ==================== 1. SEKME: ANA SAYFA MANTIĞI ====================
function renderHomeTab() {
    // 1. Özet Sayılarını Hesapla (Seçili ay ve yıl için)
    const analytics = calculateMonthlyAnalytics(AppState.transactions, AppState.selectedYear, AppState.selectedMonth);

    document.getElementById('homeTotalIncome').textContent = formatCurrency(analytics.totalIncome);
    document.getElementById('homeTotalExpense').textContent = formatCurrency(analytics.totalExpense);
    document.getElementById('homeTotalPaid').textContent = formatCurrency(analytics.totalPaidExpenses);
    document.getElementById('homeTotalUnpaid').textContent = formatCurrency(analytics.totalUnpaidExpenses);

    const netBalEl = document.getElementById('homeNetBalance');
    netBalEl.textContent = formatCurrency(analytics.netSavings);
    netBalEl.style.color = analytics.netSavings >= 0 ? 'var(--primary)' : 'var(--danger)';

    const paidCount = analytics.monthlyTx.filter(t => t.type !== 'income' && t.isPaid).length;
    const unpaidCount = analytics.monthlyTx.filter(t => t.type !== 'income' && !t.isPaid).length;

    document.getElementById('homePaidCount').textContent = `${paidCount} ödeme yapıldı`;
    document.getElementById('homeUnpaidCount').textContent = `${unpaidCount} ödeme bekliyor`;

    // 2. Gider Kalemleri Izgarası
    const homeCatGrid = document.getElementById('homeCategoryGrid');
    const expensesBadge = document.getElementById('expensesBadge');
    const monthlyExpenses = analytics.monthlyTx.filter(t => t.type !== 'income');

    if (expensesBadge) {
        expensesBadge.textContent = `${monthlyExpenses.length} Kalem • ${formatCurrency(analytics.totalExpense)}`;
    }

    if (homeCatGrid) {
        homeCatGrid.innerHTML = '';
        const mainCategories = ['su', 'elektrik', 'internet', 'dogalgaz', 'telefon', 'banka', 'taksit'];

        mainCategories.forEach(catKey => {
            const meta = CATEGORY_META[catKey];
            const catTxList = monthlyExpenses.filter(t => t.category === catKey);

            if (catKey === 'taksit') {
                if (catTxList.length === 0) {
                    homeCatGrid.appendChild(createEmptyCategoryCard(catKey, meta));
                } else {
                    catTxList.forEach(tx => {
                        homeCatGrid.appendChild(createHomeTransactionCard(tx, meta, true));
                    });
                }
            } else if (catKey === 'banka') {
                if (catTxList.length === 0) {
                    homeCatGrid.appendChild(createEmptyCategoryCard(catKey, meta));
                } else {
                    catTxList.forEach(tx => {
                        homeCatGrid.appendChild(createHomeTransactionCard(tx, meta, false));
                    });
                }
            } else {
                if (catTxList.length === 0) {
                    homeCatGrid.appendChild(createEmptyCategoryCard(catKey, meta));
                } else {
                    catTxList.forEach(tx => {
                        homeCatGrid.appendChild(createHomeTransactionCard(tx, meta, false));
                    });
                }
            }
        });

        // Diğer Harcamalar
        const otherList = monthlyExpenses.filter(t => t.category === 'diger');
        otherList.forEach(tx => {
            homeCatGrid.appendChild(createHomeTransactionCard(tx, CATEGORY_META['diger'], false));
        });
    }

    // 3. Gelir Kalemleri Izgarası
    const homeIncomeGrid = document.getElementById('homeIncomeGrid');
    const incomesBadge = document.getElementById('incomesBadge');
    const monthlyIncomes = analytics.monthlyTx.filter(t => t.type === 'income');

    if (incomesBadge) {
        incomesBadge.textContent = `${monthlyIncomes.length} Gelir • ${formatCurrency(analytics.totalIncome)}`;
    }

    if (homeIncomeGrid) {
        homeIncomeGrid.innerHTML = '';
        if (monthlyIncomes.length === 0) {
            homeIncomeGrid.appendChild(createEmptyIncomeCard());
        } else {
            monthlyIncomes.forEach(tx => {
                homeIncomeGrid.appendChild(createHomeIncomeCard(tx));
            });
        }
    }
}

function createHomeTransactionCard(tx, meta, isInstallment) {
    const card = document.createElement('div');
    card.className = 'home-cat-card';

    // Durum Belirteci (Ödendi, Ödenmedi, Yaklaşan)
    const statusObj = getDueStatus(tx.dueDate, tx.isPaid);

    let displayTitle = tx.title;
    let subtitleText = `Son Ödeme: ${formatDateTR(tx.dueDate)}`;

    if (isInstallment && tx.installmentTotal) {
        subtitleText = `Taksit: ${tx.installmentCurrent || 1} / ${tx.installmentTotal} • Son Ödeme: ${formatDateTR(tx.dueDate)}`;
        if (tx.installmentTitle) {
            displayTitle = `${tx.title} (${tx.installmentTitle})`;
        }
    }

    card.innerHTML = `
        <div class="cat-info-group">
            <div class="cat-emoji-bubble" style="background: ${meta.color}15; color: ${meta.color};">
                ${meta.emoji}
            </div>
            <div class="cat-text-group">
                <span class="cat-name">${displayTitle}</span>
                <span class="cat-status-text">${subtitleText}</span>
            </div>
        </div>
        <div class="cat-amount-group">
            <span class="cat-amount">₺${Number(tx.amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
            <span class="status-pill ${statusObj.badgeClass}">
                <i data-lucide="${statusObj.icon}" style="width: 12px; height: 12px;"></i>
                ${statusObj.text}
            </span>
        </div>
    `;

    // Ana ekranda tıklanılan her ödeme için açılabilir pencere (Popup Modal)
    card.addEventListener('click', () => {
        openDetailModal(tx);
    });

    return card;
}

function createEmptyCategoryCard(catKey, meta) {
    const card = document.createElement('div');
    card.className = 'home-cat-card';
    card.style.opacity = '0.75';

    card.innerHTML = `
        <div class="cat-info-group">
            <div class="cat-emoji-bubble" style="background: ${meta.color}15; color: ${meta.color};">
                ${meta.emoji}
            </div>
            <div class="cat-text-group">
                <span class="cat-name">${meta.name}</span>
                <span class="cat-status-text">Bu ay için kayıt eklenmedi</span>
            </div>
        </div>
        <div class="cat-amount-group">
            <span class="cat-amount" style="color: var(--text-muted);">₺0,00</span>
            <span class="status-pill" style="background: var(--bg-card-hover); color: var(--text-muted);">
                <i data-lucide="plus" style="width: 12px; height: 12px;"></i> Ekle
            </span>
        </div>
    `;

    // Tıklanınca hemen bu kategoriye ait hızlı kayıt ekleme modalını aç
    card.addEventListener('click', () => {
        openRecordModalForCategory(catKey);
    });

    return card;
}

function createHomeIncomeCard(tx) {
    const card = document.createElement('div');
    card.className = 'home-cat-card income-card';

    card.innerHTML = `
        <div class="cat-info-group">
            <div class="cat-emoji-bubble" style="background: rgba(16, 185, 129, 0.15); color: #10b981;">
                💰
            </div>
            <div class="cat-text-group">
                <span class="cat-name">${tx.title}</span>
                <span class="cat-status-text">Tarih: ${formatDateTR(tx.dueDate)} ${tx.notes ? '• ' + tx.notes : ''}</span>
            </div>
        </div>
        <div class="cat-amount-group">
            <span class="cat-amount" style="color: #10b981;">+₺${Number(tx.amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
            <span class="status-pill status-paid">
                <i data-lucide="check" style="width: 12px; height: 12px;"></i> Gelir
            </span>
        </div>
    `;

    card.addEventListener('click', () => {
        openDetailModal(tx);
    });

    return card;
}

function createEmptyIncomeCard() {
    const card = document.createElement('div');
    card.className = 'home-cat-card';
    card.style.opacity = '0.8';

    card.innerHTML = `
        <div class="cat-info-group">
            <div class="cat-emoji-bubble" style="background: rgba(16, 185, 129, 0.15); color: #10b981;">
                💰
            </div>
            <div class="cat-text-group">
                <span class="cat-name">Gelir Kaydı Bulunamadı</span>
                <span class="cat-status-text">Bu ay için henüz gelir eklenmedi</span>
            </div>
        </div>
        <div class="cat-amount-group">
            <span class="cat-amount" style="color: var(--text-muted);">₺0,00</span>
            <span class="status-pill" style="background: var(--bg-card-hover); color: var(--primary);">
                <i data-lucide="plus" style="width: 12px; height: 12px;"></i> Gelir Ekle
            </span>
        </div>
    `;

    card.addEventListener('click', () => {
        openRecordModalForIncome();
    });

    return card;
}

function openRecordModalForIncome() {
    openRecordModal();
    const formType = document.getElementById('formType');
    const formCategory = document.getElementById('formCategory');
    const formTitle = document.getElementById('formTitle');
    const formIsPaid = document.getElementById('formIsPaid');
    if (formType) formType.value = 'income';
    if (formCategory) formCategory.value = 'gelir';
    if (formTitle) formTitle.value = 'Aylık Maaş Geliri';
    if (formIsPaid) formIsPaid.value = 'true';
}

// ==================== 2. SEKME: KAYITLAR MANTIĞI ====================
function renderRecordsTab() {
    const container = document.getElementById('recordsListContainer');
    if (!container) return;

    container.innerHTML = '';

    // Arama ve Filtreleme
    let filtered = AppState.transactions.filter(tx => {
        // Arama sorgusu
        if (AppState.searchQuery) {
            const q = AppState.searchQuery.toLowerCase();
            const matchTitle = (tx.title || '').toLowerCase().includes(q);
            const matchInst = (tx.installmentTitle || '').toLowerCase().includes(q);
            const matchNotes = (tx.notes || '').toLowerCase().includes(q);
            if (!matchTitle && !matchInst && !matchNotes) return false;
        }

        // Sekme Filtresi: all | unpaid | paid | upcoming
        if (AppState.activeFilter === 'paid') return tx.isPaid === true;
        if (AppState.activeFilter === 'unpaid') return tx.isPaid === false;
        if (AppState.activeFilter === 'upcoming') {
            if (tx.isPaid) return false;
            const statusObj = getDueStatus(tx.dueDate, tx.isPaid);
            return statusObj.isDueSoon;
        }

        return true;
    });

    // Tarihe göre sıralama (En yakın tarih üstte)
    filtered.sort((a, b) => new Date(b.dueDate || 0) - new Date(a.dueDate || 0));

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <div class="empty-state-title">Kayıt Bulunamadı</div>
                <div class="empty-state-desc">Belirtilen kriterlere uygun fatura, taksit veya gelir kaydı yok.</div>
                <button class="btn-primary" id="btnEmptyAdd">
                    <i data-lucide="plus"></i> Yeni Kayıt Ekle
                </button>
            </div>
        `;
        const btnEmpty = document.getElementById('btnEmptyAdd');
        if (btnEmpty) btnEmpty.addEventListener('click', () => openRecordModal());
        return;
    }

    filtered.forEach(tx => {
        const card = createRecordListItem(tx);
        container.appendChild(card);
    });
}

function createRecordListItem(tx) {
    const meta = CATEGORY_META[tx.category] || CATEGORY_META['diger'];
    const isIncome = tx.type === 'income';
    const statusObj = getDueStatus(tx.dueDate, tx.isPaid);

    const card = document.createElement('div');
    card.className = 'record-item-card';

    let displayTitle = tx.title;
    if (tx.category === 'taksit' && tx.installmentTotal) {
        displayTitle = `${tx.title} (${tx.installmentCurrent || 1}/${tx.installmentTotal})`;
    }

    card.innerHTML = `
        <div class="record-left">
            <div class="record-checkbox-wrap" title="${tx.isPaid ? 'Ödenmedi Yap' : 'Ödendi Yap'}">
                <div class="custom-checkbox ${tx.isPaid ? 'checked' : ''}">
                    ${tx.isPaid ? '<i data-lucide="check" style="width: 14px; height: 14px;"></i>' : ''}
                </div>
            </div>
            <div class="cat-emoji-bubble" style="width: 36px; height: 36px; font-size: 1.1rem; background: ${meta.color}15; color: ${meta.color};">
                ${meta.emoji}
            </div>
            <div class="record-content">
                <div class="record-title-row">
                    <span class="record-title">${displayTitle}</span>
                    ${tx.receiptImage ? `<span class="receipt-tag" title="Dekontu Görüntüle"><i data-lucide="paperclip" style="width: 12px; height: 12px;"></i> Dekont</span>` : ''}
                </div>
                <div class="record-meta">
                    <span>${meta.name}</span>
                    <span>•</span>
                    <span>${formatDateTR(tx.dueDate)}</span>
                    <span class="status-pill ${statusObj.badgeClass}" style="padding: 1px 6px;">${statusObj.text}</span>
                </div>
            </div>
        </div>

        <div class="record-right">
            <div class="record-amount-col">
                <div class="record-amount" style="color: ${isIncome ? 'var(--success)' : 'var(--text-main)'};">
                    ${isIncome ? '+' : '-'}₺${Number(tx.amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                </div>
            </div>
            <div class="record-actions">
                <button class="action-btn-sm edit-record-btn" title="Düzenle">
                    <i data-lucide="edit-3" style="width: 16px; height: 16px;"></i>
                </button>
                <button class="action-btn-sm delete-btn delete-record-btn" title="Sil">
                    <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
                </button>
            </div>
        </div>
    `;

    // Checkbox Tıklama -> Hızlı Ödendi / Ödenmedi Değiştirme
    const chk = card.querySelector('.record-checkbox-wrap');
    chk.addEventListener('click', async (e) => {
        e.stopPropagation();
        tx.isPaid = !tx.isPaid;
        tx.paidDate = tx.isPaid ? new Date().toISOString().split('T')[0] : null;
        await DB.saveTransaction(tx);
        await loadData();
        renderAll();
    });

    // Dekont Tag'i Tıklandığında Doğrudan Lightbox Açma
    const receiptTag = card.querySelector('.receipt-tag');
    if (receiptTag && tx.receiptImage) {
        receiptTag.addEventListener('click', (e) => {
            e.stopPropagation();
            openLightbox(tx.receiptImage);
        });
    }

    // Düzenle Butonu
    const editBtn = card.querySelector('.edit-record-btn');
    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openRecordModal(tx);
    });

    // Sil Butonu
    const deleteBtn = card.querySelector('.delete-record-btn');
    deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`"${tx.title}" kaydını silmek istediğinize emin misiniz?`)) {
            await DB.deleteTransaction(tx.id);
            await loadData();
            renderAll();
        }
    });

    // Kartın Kendisine Tıklanınca Açılır Detay Penceresini Açma
    card.addEventListener('click', () => {
        openDetailModal(tx);
    });

    return card;
}

// ==================== 3. SEKME: ANALİZ MANTIĞI ====================
function updateAnalysisTab() {
    const analytics = calculateMonthlyAnalytics(AppState.transactions, AppState.selectedYear, AppState.selectedMonth);

    const billsEl = document.getElementById('statBillsTotal');
    const instEl = document.getElementById('statInstallmentsTotal');
    const bankEl = document.getElementById('statBankDebtsTotal');

    if (billsEl) billsEl.textContent = formatCurrency(analytics.totalBills);
    if (instEl) instEl.textContent = formatCurrency(analytics.totalInstallments);
    if (bankEl) bankEl.textContent = formatCurrency(analytics.totalBankDebts);

    // Kalemleri Ayrı Ayrı Gruplama ve Açılır/Kapanır İçerikleri Doldurma
    const monthlyExpenses = analytics.monthlyTx.filter(t => t.type !== 'income');
    const billsList = monthlyExpenses.filter(t => BILL_CATEGORIES.includes(t.category));
    const installmentsList = monthlyExpenses.filter(t => t.category === 'taksit');
    const bankList = monthlyExpenses.filter(t => t.category === 'banka');

    const badgeBills = document.getElementById('badgeBillsCount');
    const badgeInst = document.getElementById('badgeInstallmentsCount');
    const badgeBank = document.getElementById('badgeBankCount');

    if (badgeBills) badgeBills.textContent = `${billsList.length} Kalem`;
    if (badgeInst) badgeInst.textContent = `${installmentsList.length} Taksit`;
    if (badgeBank) badgeBank.textContent = `${bankList.length} Borç`;

    populateStatSubList('listStatBills', billsList);
    populateStatSubList('listStatInstallments', installmentsList);
    populateStatSubList('listStatBank', bankList);

    const isDark = document.body.classList.contains('dark');
    renderCharts(analytics, isDark);
}

function populateStatSubList(containerId, list) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    if (list.length === 0) {
        container.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.76rem; padding: 8px 0;">Bu ay için kayıt bulunmuyor</div>`;
        return;
    }

    list.forEach(tx => {
        const meta = CATEGORY_META[tx.category] || CATEGORY_META['diger'];
        const statusObj = getDueStatus(tx.dueDate, tx.isPaid);
        const item = document.createElement('div');
        item.className = 'stat-sub-item';

        let titleDisplay = tx.title;
        if (tx.category === 'taksit' && tx.installmentTotal) {
            titleDisplay = `${tx.title} (${tx.installmentCurrent || 1}/${tx.installmentTotal})`;
        }

        item.innerHTML = `
            <div class="stat-sub-item-left">
                <span style="font-size: 1rem;">${meta.emoji}</span>
                <div style="min-width: 0;">
                    <div class="stat-sub-title">${titleDisplay}</div>
                    <div style="font-size: 0.68rem; color: var(--text-muted);">${formatDateTR(tx.dueDate)}</div>
                </div>
            </div>
            <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end;">
                <span class="stat-sub-amount">₺${Number(tx.amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                <span class="status-pill ${statusObj.badgeClass}" style="font-size: 0.62rem; padding: 1px 6px;">${statusObj.text}</span>
            </div>
        `;

        item.addEventListener('click', (e) => {
            e.stopPropagation();
            openDetailModal(tx);
        });

        container.appendChild(item);
    });
}

function setupYearMonthSelectors() {
    const selectors = [
        { y: document.getElementById('homeYearSelect'), m: document.getElementById('homeMonthSelect') },
        { y: document.getElementById('analysisYearSelect'), m: document.getElementById('analysisMonthSelect') }
    ];

    // Yılları topla
    const currentYear = new Date().getFullYear();
    const yearsSet = new Set([currentYear - 1, currentYear, currentYear + 1]);

    AppState.transactions.forEach(t => {
        if (t.dueDate) {
            const y = parseInt(t.dueDate.split('-')[0], 10);
            if (!isNaN(y)) yearsSet.add(y);
        }
    });

    const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);

    selectors.forEach(pair => {
        if (pair.y) {
            pair.y.innerHTML = '';
            sortedYears.forEach(y => {
                const opt = document.createElement('option');
                opt.value = y;
                opt.textContent = y;
                if (y === AppState.selectedYear) opt.selected = true;
                pair.y.appendChild(opt);
            });
            pair.y.onchange = (e) => {
                AppState.selectedYear = parseInt(e.target.value, 10);
                syncSelectors();
                renderAll();
            };
        }

        if (pair.m) {
            pair.m.value = String(AppState.selectedMonth);
            pair.m.onchange = (e) => {
                AppState.selectedMonth = parseInt(e.target.value, 10);
                syncSelectors();
                renderAll();
            };
        }
    });

    function syncSelectors() {
        selectors.forEach(pair => {
            if (pair.y) pair.y.value = String(AppState.selectedYear);
            if (pair.m) pair.m.value = String(AppState.selectedMonth);
        });
    }
}

// ==================== 4. SEKME: AYARLAR MANTIĞI ====================
function setupAccordions() {
    // Ayarlar sekmesindeki standart akordiyonlar
    document.querySelectorAll('.accordion-header').forEach(header => {
        header.addEventListener('click', () => {
            const item = header.parentElement;
            item.classList.toggle('open');
        });
    });

    // Ana Sayfa: Gider Kalemleri Açılır/Kapanır Başlığı
    const headerExpenses = document.getElementById('headerExpenses');
    if (headerExpenses) {
        headerExpenses.addEventListener('click', () => {
            document.getElementById('sectionExpenses')?.classList.toggle('open');
        });
    }

    // Ana Sayfa: Gelir Kalemleri Açılır/Kapanır Başlığı
    const headerIncomes = document.getElementById('headerIncomes');
    if (headerIncomes) {
        headerIncomes.addEventListener('click', () => {
            document.getElementById('sectionIncomes')?.classList.toggle('open');
        });
    }

    // Analiz: 3 Grup Kartı Açılır/Kapanır
    const cardStatBills = document.getElementById('cardStatBills');
    const headerStatBills = document.getElementById('headerStatBills');
    if (headerStatBills && cardStatBills) {
        headerStatBills.addEventListener('click', () => {
            cardStatBills.classList.toggle('open');
        });
    }

    const cardStatInstallments = document.getElementById('cardStatInstallments');
    const headerStatInstallments = document.getElementById('headerStatInstallments');
    if (headerStatInstallments && cardStatInstallments) {
        headerStatInstallments.addEventListener('click', () => {
            cardStatInstallments.classList.toggle('open');
        });
    }

    const cardStatBank = document.getElementById('cardStatBank');
    const headerStatBank = document.getElementById('headerStatBank');
    if (headerStatBank && cardStatBank) {
        headerStatBank.addEventListener('click', () => {
            cardStatBank.classList.toggle('open');
        });
    }

    // Koyu Mod Seçimi
    const darkSelect = document.getElementById('settingDarkMode');
    if (darkSelect) {
        darkSelect.addEventListener('change', async (e) => {
            AppState.settings.darkMode = e.target.value;
            applyThemeMode(AppState.settings.darkMode);
            await DB.saveSettings(AppState.settings);
        });
    }

    // Renk Teması Seçimi
    document.querySelectorAll('.theme-dot').forEach(dot => {
        dot.addEventListener('click', async () => {
            const color = dot.getAttribute('data-color');
            AppState.settings.themeColor = color;
            applySettingsToDOM(AppState.settings);
            await DB.saveSettings(AppState.settings);
        });
    });

    // Yazı Stili Seçimi
    const fontSelect = document.getElementById('settingFontFamily');
    if (fontSelect) {
        fontSelect.addEventListener('change', async (e) => {
            AppState.settings.fontFamily = e.target.value;
            applySettingsToDOM(AppState.settings);
            await DB.saveSettings(AppState.settings);
        });
    }

    // JSON Dışa Aktar
    const btnExport = document.getElementById('btnExportJSON');
    if (btnExport) {
        btnExport.addEventListener('click', async () => {
            const json = await DB.exportAllJSON();
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const now = new Date().toISOString().split('T')[0];
            a.href = url;
            a.download = `gelir-gider-yedek-${now}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    // JSON İçe Aktar
    const jsonFileInput = document.getElementById('jsonFileInput');
    if (jsonFileInput) {
        jsonFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    await DB.importAllJSON(ev.target.result);
                    await initSettings();
                    await loadData();
                    setupYearMonthSelectors();
                    renderAll();
                    alert('Veriler başarıyla içe aktarıldı ve geri yüklendi!');
                } catch (err) {
                    alert('Hata: JSON dosyası okunamadı veya biçim geçersiz! ' + err.message);
                }
            };
            reader.readAsText(file);
            jsonFileInput.value = '';
        });
    }

    // Örnek Veri Yükle
    const btnSeed = document.getElementById('btnSeedData');
    if (btnSeed) {
        btnSeed.addEventListener('click', async () => {
            if (confirm('Hazır örnek veriler eklensin mi?')) {
                await DB.seedSampleData();
                await loadData();
                setupYearMonthSelectors();
                renderAll();
                alert('Örnek veriler başarıyla yüklendi!');
            }
        });
    }

    // Tüm Verileri Temizle
    const btnClear = document.getElementById('btnClearData');
    if (btnClear) {
        btnClear.addEventListener('click', async () => {
            if (confirm('DİKKAT: Tüm kayıtlarınız ve dekontlarınız silinecektir. Emin misiniz?')) {
                await DB.clearAllData();
                await loadData();
                renderAll();
                alert('Tüm veriler temizlendi.');
            }
        });
    }
}

// ==================== NAVİGASYON & ETKİLEŞİM ====================
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetTab = item.getAttribute('data-tab');
            switchTab(targetTab);
        });
    });
}

function switchTab(tabId) {
    AppState.activeTab = tabId;

    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.toggle('active', pane.id === tabId);
    });

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-tab') === tabId);
    });

    // Sayfa değiştirildiğinde anında en yukarı kaydır (mobil zıplamayı ve alt bar kaymasını önler)
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

    // Ayarlar sekmesinde FAB (+) butonunu gizle, diğerlerinde göster
    const fab = document.getElementById('fabAddBtn');
    if (fab) {
        fab.style.display = (tabId === 'tab-settings') ? 'none' : 'flex';
    }

    if (tabId === 'tab-analysis') {
        updateAnalysisTab();
    } else if (tabId === 'tab-records') {
        renderRecordsTab();
    } else if (tabId === 'tab-home') {
        renderHomeTab();
    }

    if (window.lucide) {
        lucide.createIcons();
    }
}

function setupEventListeners() {
    // Hızlı Ekle Butonları
    const fab = document.getElementById('fabAddBtn');
    if (fab) fab.addEventListener('click', () => openRecordModal());

    const quickAdd = document.getElementById('btnQuickAdd');
    if (quickAdd) quickAdd.addEventListener('click', () => openRecordModal());

    // Üst Koyu Mod Butonu
    const btnThemeToggle = document.getElementById('btnThemeToggle');
    if (btnThemeToggle) {
        btnThemeToggle.addEventListener('click', async () => {
            const isDark = document.body.classList.contains('dark');
            const newMode = isDark ? 'light' : 'dark';
            AppState.settings.darkMode = newMode;
            applyThemeMode(newMode);
            const darkSelect = document.getElementById('settingDarkMode');
            if (darkSelect) darkSelect.value = newMode;
            await DB.saveSettings(AppState.settings);
        });
    }

    // Arama Çubuğu (Kayıtlar)
    const searchInput = document.getElementById('recordsSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            AppState.searchQuery = e.target.value.trim();
            renderRecordsTab();
        });
    }

    // Filtre Butonları (Tümü, Ödenen, Ödenmeyen, Yaklaşan)
    document.querySelectorAll('.filter-pill-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-pill-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            AppState.activeFilter = btn.getAttribute('data-filter');
            renderRecordsTab();
        });
    });

    // Dekont Tam Ekran Lightbox Kapatma
    const lightboxModal = document.getElementById('lightboxModal');
    const btnCloseLightbox = document.getElementById('btnCloseLightbox');
    if (lightboxModal && btnCloseLightbox) {
        btnCloseLightbox.addEventListener('click', () => lightboxModal.classList.remove('active'));
        lightboxModal.addEventListener('click', (e) => {
            if (e.target === lightboxModal) lightboxModal.classList.remove('active');
        });
    }
}

// ==================== MODALLARIN YÖNETİMİ ====================
function setupModals() {
    // 1. Kayıt Modalı Elemanları
    const recordModal = document.getElementById('recordModal');
    const btnCloseRecordModal = document.getElementById('btnCloseRecordModal');
    const btnCancelRecordModal = document.getElementById('btnCancelRecordModal');
    const btnSaveRecord = document.getElementById('btnSaveRecord');

    const formCategory = document.getElementById('formCategory');
    const installmentFields = document.getElementById('installmentFields');
    const formReceiptInput = document.getElementById('formReceiptInput');
    const receiptUploadBox = document.getElementById('receiptUploadBox');
    const btnRemoveReceipt = document.getElementById('btnRemoveReceipt');

    if (btnCloseRecordModal) btnCloseRecordModal.addEventListener('click', closeRecordModal);
    if (btnCancelRecordModal) btnCancelRecordModal.addEventListener('click', closeRecordModal);

    // Kategori değişince taksit alanlarını aç/kapat
    if (formCategory && installmentFields) {
        formCategory.addEventListener('change', () => {
            const isInstallment = formCategory.value === 'taksit';
            installmentFields.style.display = isInstallment ? 'block' : 'none';
        });
    }

    // Dekont Yükleme Kutusuna Tıklama
    if (receiptUploadBox && formReceiptInput) {
        receiptUploadBox.addEventListener('click', (e) => {
            if (e.target.closest('#btnRemoveReceipt')) return;
            formReceiptInput.click();
        });

        formReceiptInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Görseli Base64'e dönüştür ve önizle
            const reader = new FileReader();
            reader.onload = (ev) => {
                AppState.tempReceiptDataUrl = ev.target.result;
                displayReceiptPreview(AppState.tempReceiptDataUrl);
            };
            reader.readAsDataURL(file);
        });
    }

    // Dekont Silme Butonu
    if (btnRemoveReceipt) {
        btnRemoveReceipt.addEventListener('click', (e) => {
            e.stopPropagation();
            AppState.tempReceiptDataUrl = null;
            displayReceiptPreview(null);
            if (formReceiptInput) formReceiptInput.value = '';
        });
    }

    // Kayıt Kaydet Butonu
    if (btnSaveRecord) {
        btnSaveRecord.addEventListener('click', async () => {
            const id = document.getElementById('recordId').value || null;
            const type = document.getElementById('formType').value;
            const category = document.getElementById('formCategory').value;
            const title = document.getElementById('formTitle').value.trim();
            const amount = parseFloat(document.getElementById('formAmount').value);
            const dueDate = document.getElementById('formDueDate').value;
            const isPaid = document.getElementById('formIsPaid').value === 'true';
            const notes = document.getElementById('formNotes').value.trim();

            if (!title) {
                alert('Lütfen kayıt başlığını giriniz!');
                return;
            }
            if (isNaN(amount) || amount <= 0) {
                alert('Lütfen geçerli bir tutar giriniz!');
                return;
            }
            if (!dueDate) {
                alert('Lütfen bir tarih seçiniz!');
                return;
            }

            const item = {
                id: id,
                type: type,
                category: category,
                title: title,
                amount: amount,
                dueDate: dueDate,
                isPaid: isPaid,
                paidDate: isPaid ? (dueDate || new Date().toISOString().split('T')[0]) : null,
                notes: notes,
                receiptImage: AppState.tempReceiptDataUrl
            };

            if (category === 'taksit') {
                item.installmentTitle = document.getElementById('formInstallmentTitle').value.trim();
                item.installmentCurrent = parseInt(document.getElementById('formInstallmentCurrent').value, 10) || 1;
                item.installmentTotal = parseInt(document.getElementById('formInstallmentTotal').value, 10) || 1;
            }

            await DB.saveTransaction(item);
            closeRecordModal();
            await loadData();
            setupYearMonthSelectors();
            renderAll();
        });
    }

    // 2. Detay Modalı Elemanları
    const detailModal = document.getElementById('detailModal');
    const btnCloseDetailModal = document.getElementById('btnCloseDetailModal');
    const btnTogglePayStatus = document.getElementById('btnTogglePayStatus');
    const btnGoToRecord = document.getElementById('btnGoToRecord');
    const btnDeleteDetailRecord = document.getElementById('btnDeleteDetailRecord');

    if (btnCloseDetailModal) btnCloseDetailModal.addEventListener('click', closeDetailModal);

    if (btnTogglePayStatus) {
        btnTogglePayStatus.addEventListener('click', async () => {
            if (!AppState.currentDetailTx) return;
            AppState.currentDetailTx.isPaid = !AppState.currentDetailTx.isPaid;
            AppState.currentDetailTx.paidDate = AppState.currentDetailTx.isPaid ? new Date().toISOString().split('T')[0] : null;
            await DB.saveTransaction(AppState.currentDetailTx);
            await loadData();
            openDetailModal(AppState.currentDetailTx); // Güncel haliyle tekrar aç
            renderAll();
        });
    }

    if (btnGoToRecord) {
        btnGoToRecord.addEventListener('click', () => {
            const tx = AppState.currentDetailTx;
            closeDetailModal();
            switchTab('tab-records');
            openRecordModal(tx);
        });
    }

    if (btnDeleteDetailRecord) {
        btnDeleteDetailRecord.addEventListener('click', async () => {
            if (!AppState.currentDetailTx) return;
            if (confirm(`"${AppState.currentDetailTx.title}" kaydını silmek istediğinize emin misiniz?`)) {
                await DB.deleteTransaction(AppState.currentDetailTx.id);
                closeDetailModal();
                await loadData();
                renderAll();
            }
        });
    }
}

function openRecordModal(existingTx = null) {
    const modal = document.getElementById('recordModal');
    const modalTitle = document.getElementById('modalRecordTitle');
    const recordId = document.getElementById('recordId');
    const formType = document.getElementById('formType');
    const formCategory = document.getElementById('formCategory');
    const formTitle = document.getElementById('formTitle');
    const formAmount = document.getElementById('formAmount');
    const formDueDate = document.getElementById('formDueDate');
    const formIsPaid = document.getElementById('formIsPaid');
    const formNotes = document.getElementById('formNotes');
    const installmentFields = document.getElementById('installmentFields');

    // Bugünün tarihi (varsayılan)
    const todayStr = new Date().toISOString().split('T')[0];

    if (existingTx) {
        modalTitle.innerHTML = `<i data-lucide="edit"></i> Kaydı Düzenle`;
        recordId.value = existingTx.id;
        formType.value = existingTx.type || 'expense';
        formCategory.value = existingTx.category || 'su';
        formTitle.value = existingTx.title || '';
        formAmount.value = existingTx.amount || '';
        formDueDate.value = existingTx.dueDate || todayStr;
        formIsPaid.value = existingTx.isPaid ? 'true' : 'false';
        formNotes.value = existingTx.notes || '';

        if (existingTx.category === 'taksit') {
            installmentFields.style.display = 'block';
            document.getElementById('formInstallmentTitle').value = existingTx.installmentTitle || '';
            document.getElementById('formInstallmentCurrent').value = existingTx.installmentCurrent || 1;
            document.getElementById('formInstallmentTotal').value = existingTx.installmentTotal || 12;
        } else {
            installmentFields.style.display = 'none';
        }

        AppState.tempReceiptDataUrl = existingTx.receiptImage || null;
    } else {
        modalTitle.innerHTML = `<i data-lucide="plus-circle"></i> Yeni Kayıt Ekle`;
        recordId.value = '';
        formType.value = 'expense';
        formCategory.value = 'su';
        formTitle.value = '';
        formAmount.value = '';
        formDueDate.value = todayStr;
        formIsPaid.value = 'false';
        formNotes.value = '';
        installmentFields.style.display = 'none';
        document.getElementById('formInstallmentTitle').value = '';
        document.getElementById('formInstallmentCurrent').value = 1;
        document.getElementById('formInstallmentTotal').value = 12;
        AppState.tempReceiptDataUrl = null;
    }

    displayReceiptPreview(AppState.tempReceiptDataUrl);
    modal.classList.add('active');
    if (window.lucide) lucide.createIcons();
}

function openRecordModalForCategory(categoryKey) {
    openRecordModal();
    const formCategory = document.getElementById('formCategory');
    const formTitle = document.getElementById('formTitle');
    const installmentFields = document.getElementById('installmentFields');

    if (formCategory) {
        formCategory.value = categoryKey;
        const meta = CATEGORY_META[categoryKey];
        if (meta) {
            formTitle.value = meta.name;
        }
        if (categoryKey === 'taksit') {
            installmentFields.style.display = 'block';
        }
    }
}

function closeRecordModal() {
    const modal = document.getElementById('recordModal');
    modal.classList.remove('active');
}

function displayReceiptPreview(dataUrl) {
    const placeholder = document.getElementById('receiptUploadPlaceholder');
    const container = document.getElementById('receiptPreviewContainer');
    const img = document.getElementById('receiptPreviewImg');

    if (dataUrl) {
        img.src = dataUrl;
        container.style.display = 'block';
        placeholder.style.display = 'none';
    } else {
        img.src = '';
        container.style.display = 'none';
        placeholder.style.display = 'block';
    }
}

// Ana ekranda ve kayıtlarda açılan Detay Modalı
function openDetailModal(tx) {
    AppState.currentDetailTx = tx;
    const modal = document.getElementById('detailModal');
    const meta = CATEGORY_META[tx.category] || CATEGORY_META['diger'];
    const statusObj = getDueStatus(tx.dueDate, tx.isPaid);

    document.getElementById('detailCatEmoji').textContent = meta.emoji;
    document.getElementById('detailTitleText').textContent = tx.title;
    document.getElementById('detailAmount').textContent = `₺${Number(tx.amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;

    const badge = document.getElementById('detailStatusBadge');
    badge.className = `status-pill ${statusObj.badgeClass}`;
    badge.innerHTML = `<i data-lucide="${statusObj.icon}" style="width: 13px; height: 13px;"></i> ${statusObj.text}`;

    document.getElementById('detailCategory').textContent = meta.name;
    document.getElementById('detailDueDate').textContent = formatDateTR(tx.dueDate);
    document.getElementById('detailNotes').textContent = tx.notes || 'Belirtilmedi';

    // Taksit Satırı
    const instRow = document.getElementById('detailInstallmentRow');
    if (tx.category === 'taksit' && tx.installmentTotal) {
        instRow.style.display = 'flex';
        document.getElementById('detailInstallmentInfo').textContent = `${tx.installmentCurrent || 1} / ${tx.installmentTotal} Taksit (${tx.installmentTitle || tx.title})`;
    } else {
        instRow.style.display = 'none';
    }

    // Dekont Bölümü
    const receiptSec = document.getElementById('detailReceiptSection');
    const receiptImg = document.getElementById('detailReceiptImg');
    if (tx.receiptImage) {
        receiptSec.style.display = 'block';
        receiptImg.src = tx.receiptImage;
        receiptImg.onclick = () => openLightbox(tx.receiptImage);
    } else {
        receiptSec.style.display = 'none';
    }

    // Ödendi Durum Butonu
    const btnToggle = document.getElementById('btnTogglePayStatus');
    const toggleIcon = document.getElementById('detailPayToggleIcon');
    const toggleText = document.getElementById('detailPayToggleText');

    if (tx.isPaid) {
        btnToggle.className = 'btn-secondary';
        toggleIcon.setAttribute('data-lucide', 'rotate-ccw');
        toggleText.textContent = 'Ödenmedi Yap';
    } else {
        btnToggle.className = 'btn-primary';
        toggleIcon.setAttribute('data-lucide', 'check-circle');
        toggleText.textContent = 'Ödendi Olarak İşaretle';
    }

    modal.classList.add('active');
    if (window.lucide) lucide.createIcons();
}

function closeDetailModal() {
    const modal = document.getElementById('detailModal');
    modal.classList.remove('active');
    AppState.currentDetailTx = null;
}

// Dekont Lightbox Açma
function openLightbox(dataUrl) {
    const lightboxModal = document.getElementById('lightboxModal');
    const lightboxImg = document.getElementById('lightboxImg');
    if (lightboxModal && lightboxImg) {
        lightboxImg.src = dataUrl;
        lightboxModal.classList.add('active');
    }
}

// ==================== YARDIMCI FONKSİYONLAR ====================
function formatCurrency(amount) {
    return '₺' + Number(amount || 0).toLocaleString('tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatDateTR(dateString) {
    if (!dateString) return '-';
    const [y, m, d] = dateString.split('-');
    if (!y || !m || !d) return dateString;
    return `${d}.${m}.${y}`;
}

function getDueStatus(dueDateStr, isPaid) {
    if (isPaid) {
        return {
            text: 'Ödendi',
            badgeClass: 'status-paid',
            icon: 'check',
            isDueSoon: false
        };
    }

    if (!dueDateStr) {
        return {
            text: 'Ödenmedi',
            badgeClass: 'status-unpaid',
            icon: 'alert-circle',
            isDueSoon: false
        };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [y, m, d] = dueDateStr.split('-');
    const due = new Date(y, m - 1, d);
    due.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return {
            text: 'Günü Geçti',
            badgeClass: 'status-unpaid',
            icon: 'alert-octagon',
            isDueSoon: true
        };
    } else if (diffDays <= 4) {
        return {
            text: diffDays === 0 ? 'Bugün Son Gün' : `${diffDays} Gün Kaldı`,
            badgeClass: 'status-due-soon',
            icon: 'clock',
            isDueSoon: true
        };
    } else {
        return {
            text: 'Bekliyor',
            badgeClass: 'status-unpaid',
            icon: 'hourglass',
            isDueSoon: false
        };
    }
}
})();

