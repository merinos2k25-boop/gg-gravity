/**
 * Aylık Hesap Gelir-Gider Defteri - Analiz ve Grafik Modülü
 * Oluşturan: Hakan Korkmaz (c) 2026
 */

let categoryChartInstance = null;
let paidUnpaidChartInstance = null;

// Fatura kategorileri listesi
const BILL_CATEGORIES = ['su', 'elektrik', 'internet', 'dogalgaz', 'telefon'];

function calculateMonthlyAnalytics(transactions, selectedYear, selectedMonth) {
    // Seçili ay ve yıla göre filtreleme
    // selectedMonth 1-12 tabanlı string veya sayı örn: '03' veya '3'
    const monthStr = String(selectedMonth).padStart(2, '0');
    const yearStr = String(selectedYear);

    const monthlyTx = transactions.filter(t => {
        if (!t.dueDate) return false;
        const [y, m] = t.dueDate.split('-');
        return y === yearStr && m === monthStr;
    });

    let totalIncome = 0;
    let totalExpense = 0;
    let totalBills = 0; // Su + Elektrik + İnternet + Doğalgaz + Telefon
    let totalInstallments = 0; // Taksitler
    let totalBankDebts = 0; // Banka Borçları
    let totalOtherExpenses = 0; // Diğer

    let totalPaidExpenses = 0;
    let totalUnpaidExpenses = 0;

    const categoryTotals = {
        su: 0,
        elektrik: 0,
        internet: 0,
        dogalgaz: 0,
        telefon: 0,
        banka: 0,
        taksit: 0,
        diger: 0
    };

    monthlyTx.forEach(tx => {
        const amt = Number(tx.amount) || 0;
        if (tx.type === 'income') {
            totalIncome += amt;
        } else {
            totalExpense += amt;

            if (tx.isPaid) {
                totalPaidExpenses += amt;
            } else {
                totalUnpaidExpenses += amt;
            }

            if (BILL_CATEGORIES.includes(tx.category)) {
                totalBills += amt;
            } else if (tx.category === 'taksit') {
                totalInstallments += amt;
            } else if (tx.category === 'banka') {
                totalBankDebts += amt;
            } else {
                totalOtherExpenses += amt;
            }

            const cat = tx.category in categoryTotals ? tx.category : 'diger';
            categoryTotals[cat] += amt;
        }
    });

    const netSavings = totalIncome - totalExpense;

    return {
        monthlyTx,
        totalIncome,
        totalExpense,
        totalBills,
        totalInstallments,
        totalBankDebts,
        totalOtherExpenses,
        totalPaidExpenses,
        totalUnpaidExpenses,
        netSavings,
        categoryTotals
    };
}

function renderCharts(analyticsData, isDarkMode) {
    const textColor = isDarkMode ? '#cbd5e1' : '#475569';
    const gridColor = isDarkMode ? '#1e293b' : '#f1f5f9';

    // 1. Kategori Dağılımı Donut Grafiği
    const catCanvas = document.getElementById('categoryDoughnutChart');
    if (catCanvas && window.Chart) {
        if (categoryChartInstance) {
            categoryChartInstance.destroy();
        }

        const labels = ['Faturalar', 'Taksitler', 'Banka Borçları', 'Diğer Giderler'];
        const dataValues = [
            analyticsData.totalBills,
            analyticsData.totalInstallments,
            analyticsData.totalBankDebts,
            analyticsData.totalOtherExpenses
        ];

        const hasAnyExpense = dataValues.some(v => v > 0);

        categoryChartInstance = new Chart(catCanvas, {
            type: 'doughnut',
            data: {
                labels: hasAnyExpense ? labels : ['Harcama Yok'],
                datasets: [{
                    data: hasAnyExpense ? dataValues : [1],
                    backgroundColor: hasAnyExpense ? [
                        '#3b82f6', // Faturalar (Mavi)
                        '#8b5cf6', // Taksitler (Mor)
                        '#ef4444', // Banka Borçları (Kırmızı)
                        '#f59e0b'  // Diğer (Turuncu)
                    ] : [isDarkMode ? '#334155' : '#e2e8f0'],
                    borderWidth: 2,
                    borderColor: isDarkMode ? '#131b2e' : '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: textColor,
                            boxWidth: 12,
                            padding: 14,
                            font: { size: 11, weight: '500' }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                if (!hasAnyExpense) return 'Bu ay harcama kaydı yok';
                                const val = ctx.parsed || 0;
                                const total = analyticsData.totalExpense || 1;
                                const pct = ((val / total) * 100).toFixed(1);
                                return ` ${ctx.label}: ₺${val.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} (%${pct})`;
                            }
                        }
                    }
                },
                cutout: '68%'
            }
        });
    }

    // 2. Ödenen vs Ödenmeyen Çubuk Grafiği
    const paidUnpaidCanvas = document.getElementById('paidUnpaidBarChart');
    if (paidUnpaidCanvas && window.Chart) {
        if (paidUnpaidChartInstance) {
            paidUnpaidChartInstance.destroy();
        }

        paidUnpaidChartInstance = new Chart(paidUnpaidCanvas, {
            type: 'bar',
            data: {
                labels: ['Ödenen Giderler', 'Kalan / Ödenmeyen'],
                datasets: [{
                    label: 'Tutar (₺)',
                    data: [analyticsData.totalPaidExpenses, analyticsData.totalUnpaidExpenses],
                    backgroundColor: [
                        '#10b981', // Yeşil (Ödenen)
                        '#f59e0b'  // Turuncu/Sarı (Ödenmeyen)
                    ],
                    borderRadius: 8,
                    maxBarThickness: 50
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                return ` ₺${(ctx.parsed.y || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: textColor, font: { size: 11, weight: '600' } }
                    },
                    y: {
                        grid: { color: gridColor },
                        ticks: {
                            color: textColor,
                            callback: function (val) {
                                return '₺' + Number(val).toLocaleString('tr-TR');
                            }
                        }
                    }
                }
            }
        });
    }
}

window.Analytics = {
    calculateMonthlyAnalytics,
    renderCharts,
    BILL_CATEGORIES
};
