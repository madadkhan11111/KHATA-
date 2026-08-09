/**
 * KhataPro App Logic
 */

const translations = {
    en: {
        dashboard: 'Dashboard',
        khata: 'Khata Book',
        rooznamcha: 'Rooznamcha',
        reports: 'Reports',
        settings: 'Settings',
        trash: 'Trash',
        cashInHand: 'Cash in Hand',
        receivables: 'Total Receivables',
        payables: 'Total Payables',
        newEntry: 'New Entry',
        addCustomer: 'Add Customer',
        addIncome: 'Add Income',
        addExpense: 'Add Expense'
    },
    ur: {
        dashboard: 'ÚˆÛŒØ´ Ø¨ÙˆØ±Úˆ',
        khata: 'Ú©Ú¾Ø§ØªÛ Ø¨Ú©',
        rooznamcha: 'Ø±ÙˆØ²Ù†Ø§Ù…Ú†Û',
        reports: 'Ø±Ù¾ÙˆØ±Ù¹Ø³',
        settings: 'Ø³ÛŒÙ¹Ù†Ú¯Ø²',
        trash: 'Ù¹Ø±ÛŒØ´',
        cashInHand: 'Ù†Ù‚Ø¯ÛŒ',
        receivables: 'Ú©Ù„ ÙˆØµÙˆÙ„ÛŒ',
        payables: 'Ú©Ù„ Ø§Ø¯Ø§Ø¦ÛŒÚ¯ÛŒ',
        newEntry: 'Ù†ÛŒØ§ Ø§Ù†Ø¯Ø±Ø§Ø¬',
        addCustomer: 'Ú¯Ø§ÛÚ© Ø´Ø§Ù…Ù„ Ú©Ø±ÛŒÚº',
        addIncome: 'Ø¢Ù…Ø¯Ù†ÛŒ Ø´Ø§Ù…Ù„ Ú©Ø±ÛŒÚº',
        addExpense: 'Ø§Ø®Ø±Ø§Ø¬Ø§Øª Ø´Ø§Ù…Ù„ Ú©Ø±ÛŒÚº'
    }
};

/**
 * Browser Folder Handle Persistence (IndexedDB)
 */
const HandleStore = {
    dbName: 'KhataBackupDB',
    storeName: 'handles',
    async getDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            request.onupgradeneeded = () => request.result.createObjectStore(this.storeName);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },
    async save(handle) {
        const db = await this.getDB();
        const tx = db.transaction(this.storeName, 'readwrite');
        tx.objectStore(this.storeName).put(handle, 'backupFolder');
        return new Promise((resolve) => tx.oncomplete = () => resolve());
    },
    async get() {
        try {
            const db = await this.getDB();
            const tx = db.transaction(this.storeName, 'readonly');
            const request = tx.objectStore(this.storeName).get('backupFolder');
            return new Promise((resolve) => request.onsuccess = () => resolve(request.result));
        } catch (e) { return null; }
    }
};

/**
 * Google Drive Sync Manager
 */

class DataManager {
    constructor() {
        this.data = JSON.parse(localStorage.getItem('khata-data')) || {
            customers: [],
            rooznamcha: [],
            trash: [], // New Trash collection
            settings: {
                shopName: 'My Business',
                currency: 'Rs.',
                language: 'en',
                backupFolderPath: null,
                nextKhataNo: 1,
                nextTransactionNo: 1001
            }
        };
        this.undoStack = [];
        this.redoStack = [];
        this.maxStackSize = 50;

        // Ensure defaults...
        if (!this.data.trash) this.data.trash = [];
        if (!this.data.settings.nextKhataNo) this.data.settings.nextKhataNo = 1;
        if (!this.data.settings.nextTransactionNo) this.data.settings.nextTransactionNo = 1001;
        if (!this.data.settings.language) this.data.settings.language = 'en';
        if (this.data.settings.backupFolderPath === undefined) this.data.settings.backupFolderPath = null;
    }

    save(isUndoRedo = false) {
        if (!isUndoRedo) {
            // Push current state to undo stack before saving new state
            const snapshot = JSON.stringify(this.data);
            if (this.undoStack.length === 0 || this.undoStack[this.undoStack.length - 1] !== snapshot) {
                this.undoStack.push(snapshot);
                if (this.undoStack.length > this.maxStackSize) this.undoStack.shift();
                this.redoStack = []; // Clear redo stack on new action
            }
        }
        localStorage.setItem('khata-data', JSON.stringify(this.data));
        this.updateUndoRedoButtons();
        if (window.AccountCloud) AccountCloud.queueSync();
    }

    undo() {
        if (this.undoStack.length === 0) return;
        this.redoStack.push(JSON.stringify(this.data));
        this.data = JSON.parse(this.undoStack.pop());
        this.save(true);
    }

    redo() {
        if (this.redoStack.length === 0) return;
        this.undoStack.push(JSON.stringify(this.data));
        this.data = JSON.parse(this.redoStack.pop());
        this.save(true);
    }

    updateUndoRedoButtons() {
        const undoBtn = document.getElementById('btn-global-undo');
        const redoBtn = document.getElementById('btn-global-redo');
        if (undoBtn) undoBtn.disabled = this.undoStack.length === 0;
        if (redoBtn) redoBtn.disabled = this.redoStack.length === 0;
    }

    // Customer Management
    addCustomer(name, phone, manualKhataNo = null) {
        const id = Date.now().toString();
        let khataNo = manualKhataNo;
        
        if (!khataNo) {
            khataNo = this.data.settings.nextKhataNo++;
        } else {
            // Check if manual khata no already exists
            const exists = this.data.customers.some(c => c.khataNo == khataNo);
            if (exists) {
                showToast(`Khata No ${khataNo} already exists. Using automatic number instead.`, 'error');
                khataNo = this.data.settings.nextKhataNo++;
            }
            // Update nextKhataNo if manual is higher
            if (parseInt(khataNo) >= this.data.settings.nextKhataNo) {
                this.data.settings.nextKhataNo = parseInt(khataNo) + 1;
            }
        }

        this.data.customers.push({ id, khataNo, name, phone, balance: 0, transactions: [] });
        this.save();
        return id;
    }

    // Ledger Transactions (Internal)
    addKhataEntry(customerId, amount, type, description, linkedId = null) {
        const customer = this.data.customers.find(c => c.id === customerId);
        if (customer) {
            const entry = { id: Date.now().toString(), amount, type, description, date: new Date().toISOString(), linkedId };
            customer.transactions.push(entry);
            customer.balance += (type === 'credit' ? amount : -amount);
            this.save();
        }
    }

    // Rooznamcha Management (Daily Diary)
    addRooznamchaEntry(amount, type, category, description, customerId = null) {
        const entryId = Date.now().toString();
        const transactionNo = this.data.settings.nextTransactionNo++;
        const pageNo = Math.floor(this.data.rooznamcha.length / 20) + 1; // 20 entries per page

        const entry = {
            id: entryId,
            transactionNo,
            pageNo,
            amount,
            type, // income or expense
            category,
            description,
            date: new Date().toISOString(),
            customerId // Link to Khata if provided
        };
        this.data.rooznamcha.push(entry);

        // If a customer is linked, also add to their Ledger
        if (customerId) {
            const customer = this.data.customers.find(c => c.id === customerId);
            if (customer) {
                const khataType = (type === 'income') ? 'debit' : 'credit'; 
                // Note: If I receive income (cash in) from a customer, they are paying their debt (debit from their balance)
                // If I have an expense (cash out) given to a customer, it's a credit to them (they owe me)
                
                const ledgerEntry = { 
                    id: entryId + "-link", 
                    amount, 
                    type: khataType, 
                    description: `[Rooznamcha] ${description}`, 
                    date: entry.date,
                    linkedRooznamchaId: entryId
                };
                customer.transactions.push(ledgerEntry);
                customer.balance += (khataType === 'credit' ? amount : -amount);
            }
        }

        this.save();
    }

    deleteRooznamchaEntry(id) {
        const index = this.data.rooznamcha.findIndex(e => e.id == id);
        if (index === -1) return;
        
        const entry = this.data.rooznamcha.splice(index, 1)[0];
        
        // Move to trash
        this.data.trash.push({
            id: Date.now().toString(),
            originalId: entry.id,
            type: 'transaction',
            data: entry,
            deletedAt: new Date().toISOString()
        });
        
        // If linked, remove from Khata
        if (entry.customerId) {
            const customer = this.data.customers.find(c => c.id == entry.customerId);
            if (customer) {
                const ledgerIndex = customer.transactions.findIndex(t => t.linkedRooznamchaId == id);
                if (ledgerIndex !== -1) {
                    const ledgerEntry = customer.transactions[ledgerIndex];
                    customer.balance -= (ledgerEntry.type === 'credit' ? ledgerEntry.amount : -ledgerEntry.amount);
                    customer.transactions.splice(ledgerIndex, 1);
                }
            }
        }
        this.save();
    }

    deleteCustomer(id) {
        const index = this.data.customers.findIndex(c => c.id == id);
        if (index !== -1) {
            const customer = this.data.customers.splice(index, 1)[0];
            this.data.trash.push({
                id: Date.now().toString(),
                originalId: customer.id,
                type: 'customer',
                data: customer,
                deletedAt: new Date().toISOString()
            });
            this.save();
        }
    }

    restoreFromTrash(trashId) {
        const index = this.data.trash.findIndex(t => t.id == trashId);
        if (index === -1) return;

        const trashItem = this.data.trash.splice(index, 1)[0];
        if (trashItem.type === 'customer') {
            this.data.customers.push(trashItem.data);
        } else if (trashItem.type === 'transaction') {
            this.data.rooznamcha.push(trashItem.data);
            // Re-apply ledger if linked
            const entry = trashItem.data;
            if (entry.customerId) {
                const customer = this.data.customers.find(c => c.id == entry.customerId);
                if (customer) {
                    const khataType = (entry.type === 'income') ? 'debit' : 'credit';
                    const ledgerEntry = { 
                        id: entry.id + "-link", 
                        amount: entry.amount, 
                        type: khataType, 
                        description: `[Rooznamcha] ${entry.description}`, 
                        date: entry.date,
                        linkedRooznamchaId: entry.id
                    };
                    customer.transactions.push(ledgerEntry);
                    customer.balance += (khataType === 'credit' ? entry.amount : -entry.amount);
                }
            }
        }
        this.save();
    }

    emptyTrash() {
        if (confirm("Are you sure you want to permanently delete all items in trash?")) {
            this.data.trash = [];
            this.save();
        }
    }

    // Calculations
    getStats() {
        const totalReceivables = this.data.customers.reduce((sum, c) => sum + (c.balance > 0 ? c.balance : 0), 0);
        const totalPayables = this.data.customers.reduce((sum, c) => sum + (c.balance < 0 ? Math.abs(c.balance) : 0), 0);
        
        let cashInHand = 0;
        this.data.rooznamcha.forEach(entry => {
            if (entry.type === 'income') cashInHand += entry.amount;
            else cashInHand -= entry.amount;
        });
        return { totalReceivables, totalPayables, cashInHand };
    }

    getTodayStats() {
        const today = new Date().toISOString().split('T')[0];
        return this.getFilteredStats(today, today);
    }

    getFilteredStats(startDate, endDate) {
        let income = 0;
        let expense = 0;
        
        this.data.rooznamcha.forEach(entry => {
            const entryDate = entry.date.split('T')[0];
            if ((!startDate || entryDate >= startDate) && (!endDate || entryDate <= endDate)) {
                if (entry.type === 'income') income += entry.amount;
                else expense += entry.amount;
            }
        });
        
        return { income, expense, net: income - expense };
    }

    getFilteredRooznamcha(dateFilter) {
        if (!dateFilter) return [...this.data.rooznamcha].reverse();
        return this.data.rooznamcha.filter(entry => entry.date.startsWith(dateFilter)).reverse();
    }

    getCustomerLedger(customerId) {
        const customer = this.data.customers.find(c => c.id == customerId);
        if (!customer) return [];
        return customer.transactions;
    }

    // Deletion & Undo
    updateCustomer(id, name, phone) {
        const customer = this.data.customers.find(c => c.id == id);
        if (customer) {
            customer.name = name;
            customer.phone = phone;
            this.save();
        }
    }

    updateRooznamchaEntry(id, amount, type, category, description, customerId = null) {
        const entryIndex = this.data.rooznamcha.findIndex(e => e.id == id);
        if (entryIndex === -1) return;

        const oldEntry = this.data.rooznamcha[entryIndex];
        
        // 1. Revert old balance changes if linked
        if (oldEntry.customerId) {
            const oldCustomer = this.data.customers.find(c => c.id == oldEntry.customerId);
            if (oldCustomer) {
                const ledgerIndex = oldCustomer.transactions.findIndex(t => t.linkedRooznamchaId == id);
                if (ledgerIndex !== -1) {
                    const ledgerEntry = oldCustomer.transactions[ledgerIndex];
                    oldCustomer.balance -= (ledgerEntry.type === 'credit' ? ledgerEntry.amount : -ledgerEntry.amount);
                    oldCustomer.transactions.splice(ledgerIndex, 1);
                }
            }
        }

        // 2. Update the entry
        oldEntry.amount = amount;
        oldEntry.type = type;
        oldEntry.category = category;
        oldEntry.description = description;
        oldEntry.customerId = customerId;

        // 3. Apply new balance changes if linked
        if (customerId) {
            const newCustomer = this.data.customers.find(c => c.id == customerId);
            if (newCustomer) {
                const khataType = (type === 'income') ? 'debit' : 'credit';
                const ledgerEntry = { 
                    id: id + "-link", 
                    amount, 
                    type: khataType, 
                    description: `[Rooznamcha] ${description}`, 
                    date: oldEntry.date,
                    linkedRooznamchaId: id
                };
                newCustomer.transactions.push(ledgerEntry);
                newCustomer.balance += (khataType === 'credit' ? amount : -amount);
            }
        }

        this.save();
    }

    updateSettings(shopName, currency, language) {
        this.data.settings.shopName = shopName;
        this.data.settings.currency = currency;
        this.data.settings.language = language;
        this.save();
        this.applyLanguage();
    }

    applyLanguage() {
        const lang = this.data.settings.language || 'en';
        const t = translations[lang];
        
        // Update Sidebar
        document.querySelector('[data-view="dashboard"] span').innerText = t.dashboard;
        document.querySelector('[data-view="khata"] span').innerText = t.khata;
        document.querySelector('[data-view="rooznamcha"] span').innerText = t.rooznamcha;
        document.querySelector('[data-view="reports"] span').innerText = t.reports;
        document.querySelector('[data-view="settings"] span').innerText = t.settings;
        const trashNav = document.querySelector('[data-view="trash"] span');
        if (trashNav) trashNav.innerText = t.trash;

        // Update Dashboard Stats Labels
        const statsCards = document.querySelectorAll('.stat-card .label');
        if (statsCards[0]) statsCards[0].innerText = t.cashInHand;
        if (statsCards[1]) statsCards[1].innerText = t.receivables;
        if (statsCards[2]) statsCards[2].innerText = t.payables;

        // Update Buttons
        const newEntryBtn = document.querySelector('.btn-add-transaction span');
        if (newEntryBtn) newEntryBtn.innerText = t.newEntry;

        const addCustomerBtn = document.querySelector('.btn-add-customer span');
        if (addCustomerBtn) addCustomerBtn.innerText = t.addCustomer;

        const addIncomeBtn = document.querySelector('.btn-add-income span');
        if (addIncomeBtn) addIncomeBtn.innerText = t.addIncome;

        const addExpenseBtn = document.querySelector('.btn-add-expense span');
        if (addExpenseBtn) addExpenseBtn.innerText = t.addExpense;

        // Update Body Class for RTL support if Urdu
        if (lang === 'ur') {
            document.body.classList.add('rtl');
        } else {
            document.body.classList.remove('rtl');
        }
    }

    resetData() {
        if (confirm('Are you SURE you want to delete ALL data? This cannot be undone.')) {
            this.data = {
                customers: [],
                rooznamcha: [],
                trash: [],
                settings: {
                    shopName: this.data.settings.shopName || 'My Business',
                    currency: this.data.settings.currency || 'Rs.',
                    language: this.data.settings.language || 'en',
                    backupFolderPath: null,
                    nextKhataNo: 1,
                    nextTransactionNo: 1001
                }
            };
            localStorage.setItem('khata-data', JSON.stringify(this.data));
            const finish = () => location.reload();
            if (window.AccountCloud && AccountCloud.user) {
                AccountCloud.pushToCloud(false).finally(finish);
            } else {
                finish();
            }
        }
    }

    exportData() {
        return JSON.stringify(this.data, null, 2);
    }

    exportToCSV() {
        const rows = [
            ['Date', 'Type', 'Category', 'Description', 'Amount', 'Customer', 'Transaction No']
        ];

        this.data.rooznamcha.forEach(t => {
            const customer = t.customerId ? this.data.customers.find(c => c.id === t.customerId) : null;
            rows.push([
                new Date(t.date).toLocaleString(),
                t.type.toUpperCase(),
                t.category,
                t.description || '',
                t.amount,
                customer ? customer.name : 'Cash',
                t.transactionNo || ''
            ]);
        });

        let csvContent = "data:text/csv;charset=utf-8," 
            + rows.map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `khata_report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('CSV Report Downloaded!', 'success');
    }

    importData(jsonString) {
        try {
            const imported = JSON.parse(jsonString);
            if (!imported.customers || !imported.rooznamcha) return false;

            const defaults = {
                shopName: 'My Business',
                currency: 'Rs.',
                language: 'en',
                backupFolderPath: null,
                nextKhataNo: 1,
                nextTransactionNo: 1001
            };

            this.data = {
                customers: imported.customers,
                rooznamcha: imported.rooznamcha,
                trash: Array.isArray(imported.trash) ? imported.trash : [],
                settings: { ...defaults, ...(imported.settings || {}) }
            };
            if (!this.data.settings.nextKhataNo) this.data.settings.nextKhataNo = 1;
            if (!this.data.settings.nextTransactionNo) this.data.settings.nextTransactionNo = 1001;
            this.save();
            return true;
        } catch (e) {
            console.error('Import failed', e);
        }
        return false;
    }
}

const db = new DataManager();
const APP_VERSION = document.querySelector('meta[name="application-version"]')?.content || '1.0.0';

function formatMoney(amount, currency) {
    const sym = currency || db.data.settings.currency || 'Rs.';
    return `${sym} ${Number(amount || 0).toLocaleString()}`;
}

function getCashTrendPercent() {
    const today = new Date();
    let current = 0;
    let previous = 0;
    for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        current += db.getFilteredStats(key, key).net;
    }
    for (let i = 7; i < 14; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        previous += db.getFilteredStats(key, key).net;
    }
    if (previous === 0) return current === 0 ? 0 : 100;
    return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

function applySiteConfig() {
    const cfg = window.KHATA_CONFIG || {};
    const siteUrl = cfg.websiteUrl || cfg.desktopDownloadUrl;
    const desktopUrl = cfg.desktopDownloadUrl || cfg.websiteUrl;

    if (siteUrl) {
        const ogUrl = document.querySelector('meta[property="og:url"]');
        if (!ogUrl) {
            const meta = document.createElement('meta');
            meta.setAttribute('property', 'og:url');
            meta.content = siteUrl;
            document.head.appendChild(meta);
        } else {
            ogUrl.content = siteUrl;
        }
    }

    const desktopLink = document.getElementById('link-desktop-app');
    if (desktopLink && desktopUrl) {
        desktopLink.href = desktopUrl;
        desktopLink.hidden = false;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Accounts first — app UI stays hidden until signed in
    if (window.AccountCloud) await AccountCloud.init();
    initApp();
});

let cashflowChart = null;
let distributionChart = null;

async function initApp() {
    applySiteConfig();
    setupNavigation();
    setupThemeToggle();
    setupMobileNav();
    setupModalHandlers();
    setupFilterHandlers();
    setupSearchHandlers();
    setupSettingsHandlers();
    updateProfileDisplay();
    const versionEl = document.getElementById('app-version');
    if (versionEl) versionEl.textContent = `v${APP_VERSION}`;
    initCharts();
    db.applyLanguage();
    const todayStr = new Date().toISOString().split('T')[0];
    const roozDateFilter = document.getElementById('rooznamcha-date-filter');
    if (roozDateFilter && !roozDateFilter.value) roozDateFilter.value = todayStr;
    updateUI();

    // Global Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        // Undo: Ctrl+Z
        if (e.ctrlKey && e.key.toLowerCase() === 'z' && !e.shiftKey) {
            e.preventDefault();
            db.undo();
            updateUI();
        }
        // Redo: Ctrl+Y or Ctrl+Shift+Z
        if ((e.ctrlKey && e.key.toLowerCase() === 'y') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z')) {
            e.preventDefault();
            db.redo();
            updateUI();
        }
    });
}

function renderBackupBanner() {
    document.getElementById('backup-alert-banner')?.remove();
}

function isBackupActive() {
    return !!(window.AccountCloud && AccountCloud.user);
}

async function performAutoBackup() {
    if (window.AccountCloud) await AccountCloud.syncNow(false);
}

function setupWebBanner() {
    // Manual/local backup banner removed — cloud accounts handle sync.
}

/**
 * Chart Management
 */
function initCharts() {
    const cashCtx = document.getElementById('cashflow-chart')?.getContext('2d');
    const distCtx = document.getElementById('distribution-chart')?.getContext('2d');

    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
    const successColor = getComputedStyle(document.documentElement).getPropertyValue('--success').trim();
    const dangerColor = getComputedStyle(document.documentElement).getPropertyValue('--danger').trim();

    if (cashCtx) {
        cashflowChart = new Chart(cashCtx, {
            type: 'line',
            data: { labels: [], datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    }
                },
                scales: { 
                    y: { 
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.05)' }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    }

    if (distCtx) {
        distributionChart = new Chart(distCtx, {
            type: 'doughnut',
            data: { labels: [], datasets: [] },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { usePointStyle: true, padding: 20 }
                    }
                },
                cutout: '70%'
            }
        });
    }
}

function updateCharts() {
    if (!cashflowChart || !distributionChart) return;

    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#6366f1';
    const successColor = getComputedStyle(document.documentElement).getPropertyValue('--success').trim() || '#10b981';
    const dangerColor = getComputedStyle(document.documentElement).getPropertyValue('--danger').trim() || '#ef4444';

    const last7Days = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().split('T')[0];
    });

    const incomeData = last7Days.map(date => db.getFilteredStats(date, date).income);
    const expenseData = last7Days.map(date => db.getFilteredStats(date, date).expense);

    cashflowChart.data.labels = last7Days.map(d => new Date(d).toLocaleDateString(undefined, { weekday: 'short' }));
    cashflowChart.data.datasets = [
        { 
            label: 'Income', 
            data: incomeData, 
            borderColor: successColor, 
            backgroundColor: 'rgba(16, 185, 129, 0.1)', 
            fill: true, 
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: successColor
        },
        { 
            label: 'Expense', 
            data: expenseData, 
            borderColor: dangerColor, 
            backgroundColor: 'rgba(239, 68, 68, 0.1)', 
            fill: true, 
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: dangerColor
        }
    ];
    cashflowChart.update();

    const stats = db.getStats();
    distributionChart.data.labels = ['Cash', 'Receivables', 'Payables'];
    distributionChart.data.datasets = [{
        data: [stats.cashInHand, stats.totalReceivables, stats.totalPayables],
        backgroundColor: [primaryColor, successColor, dangerColor],
        borderWidth: 0
    }];
    distributionChart.update();
}

/**
 * Settings Management
 */
function setupSettingsHandlers() {
    const settingsForm = document.getElementById('settings-form');
    const shopNameInput = document.getElementById('setting-shop-name');
    const currencyInput = document.getElementById('setting-currency');
    const languageInput = document.getElementById('setting-language');
    const resetBtn = document.getElementById('btn-reset-data');

    if (shopNameInput) shopNameInput.value = db.data.settings.shopName || 'My Business';
    if (currencyInput) currencyInput.value = db.data.settings.currency || 'Rs.';
    if (languageInput) languageInput.value = db.data.settings.language || 'en';

    settingsForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        db.updateSettings(shopNameInput.value, currencyInput.value, languageInput.value);
        updateProfileDisplay();
        showToast('Settings saved successfully!', 'success');
        updateUI();
    });

    resetBtn?.addEventListener('click', () => {
        db.resetData();
    });

    if (window.AccountCloud) AccountCloud.updateAccountWidgets();
}

/**
 * Search Management
 */
function setupSearchHandlers() {
    const mainSearch = document.querySelector('.search-bar input');
    const customerSearch = document.getElementById('customer-search');

    mainSearch?.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        
        // If query is empty, just update UI normally
        if (!query) {
            updateUI();
            return;
        }

        // Global Search Logic
        const filteredCustomers = db.data.customers.filter(c => 
            c.name.toLowerCase().includes(query) || 
            c.phone.toLowerCase().includes(query) || 
            c.khataNo.toString().includes(query)
        );

        const filteredTransactions = db.data.rooznamcha.filter(t => 
            t.description.toLowerCase().includes(query) || 
            t.category.toLowerCase().includes(query) ||
            (t.customerId && db.data.customers.find(c => c.id === t.customerId)?.name.toLowerCase().includes(query))
        );

        // Update UI with search results
        updateRooznamchaLists(null, query);
        
        // If we are in Khata view, filter that too
        const khataList = document.getElementById('customers-list');
        if (khataList) {
            const rows = khataList.querySelectorAll('tr');
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(query) ? '' : 'none';
            });
        }
        
        console.log(`Global search for: ${query}`, { customers: filteredCustomers.length, transactions: filteredTransactions.length });
    });

    customerSearch?.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const rows = document.querySelectorAll('#customers-list tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(query) ? '' : 'none';
        });
    });
}

/**
 * Filter Management
 */
function setupFilterHandlers() {
    const roozDateFilter = document.getElementById('rooznamcha-date-filter');
    const reportStart = document.getElementById('report-start-date');
    const reportEnd = document.getElementById('report-end-date');
    const genReportBtn = document.getElementById('btn-generate-filtered-report');

    roozDateFilter?.addEventListener('change', () => {
        updateUI(roozDateFilter.value);
    });

    genReportBtn?.addEventListener('click', () => {
        const start = reportStart?.value || '';
        const end = reportEnd?.value || '';
        if (start && end && start > end) {
            showToast('Start date must be before end date.', 'error');
            return;
        }
        const stats = db.getFilteredStats(start, end);
        const currency = db.data.settings.currency || 'Rs.';
        const summary = document.getElementById('report-filtered-summary');
        const incomeEl = document.getElementById('report-filter-income');
        const expenseEl = document.getElementById('report-filter-expense');
        const netEl = document.getElementById('report-filter-net');

        if (summary) summary.hidden = false;
        if (incomeEl) incomeEl.innerText = formatMoney(stats.income, currency);
        if (expenseEl) expenseEl.innerText = formatMoney(stats.expense, currency);
        if (netEl) {
            netEl.innerText = formatMoney(stats.net, currency);
            netEl.className = `value ${stats.net >= 0 ? 'text-success' : 'text-danger'}`;
        }

        const rangeLabel = `${start || 'Beginning'} â†’ ${end || 'Today'}`;
        showToast(`Filtered report: ${rangeLabel}`, 'success');
    });
}

function setupMobileNav() {
    const menuBtn = document.getElementById('btn-mobile-menu');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!menuBtn || !sidebar) return;

    const closeSidebar = () => {
        sidebar.classList.remove('open');
        if (overlay) {
            overlay.hidden = true;
            overlay.setAttribute('aria-hidden', 'true');
        }
        document.body.classList.remove('sidebar-open');
    };

    const openSidebar = () => {
        sidebar.classList.add('open');
        if (overlay) {
            overlay.hidden = false;
            overlay.setAttribute('aria-hidden', 'false');
        }
        document.body.classList.add('sidebar-open');
    };

    menuBtn.addEventListener('click', () => {
        if (sidebar.classList.contains('open')) closeSidebar();
        else openSidebar();
    });

    overlay?.addEventListener('click', closeSidebar);
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 768) closeSidebar();
        });
    });
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) closeSidebar();
    });
}

function setupWebBanner() {
    // Removed — cloud accounts replace local/web backup banners.
}

function updateProfileDisplay() {
    const shopName = db.data.settings.shopName || 'My Business';
    const initials = shopName
        .split(/\s+/)
        .filter(Boolean)
        .map(word => word[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'KP';

    const nameEl = document.getElementById('profile-name');
    const avatarEl = document.getElementById('profile-avatar');
    if (nameEl) nameEl.textContent = shopName;
    if (avatarEl) avatarEl.textContent = initials;

    document.title = `${shopName} - KhataBook Pro`;
    if (window.AccountCloud) AccountCloud.updateAccountWidgets();
}

function printRoozReport(dateFilter) {
    const allTransactions = db.getFilteredRooznamcha(dateFilter);
    const stats = db.getFilteredStats(dateFilter, dateFilter);
    const currency = db.data.settings.currency || 'Rs.';
    const shopName = db.data.settings.shopName || 'KhataBook Pro';
    
    const incomeEntries = allTransactions.filter(t => t.type === 'income');
    const expenseEntries = allTransactions.filter(t => t.type === 'expense');

    let html = `
        <div class="print-report strong-report">
            <div class="print-header">
                <h1>${shopName}</h1>
                <h2>Daily Cash Book (Rooznamcha)</h2>
                <p>Date: ${new Date(dateFilter).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            </div>
            
            <div class="print-columns">
                <!-- Left Column: INCOME / CASH IN -->
                <div class="print-column">
                    <div class="column-header income-header">CASH IN / INCOME (CREDIT)</div>
                    <table class="print-table compact">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Description</th>
                                <th class="text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${incomeEntries.length > 0 ? incomeEntries.map(t => {
                                const customer = t.customerId ? db.data.customers.find(c => c.id === t.customerId) : null;
                                const khataInfo = customer ? `[${customer.khataNo}] ${customer.name}` : '';
                                const remarks = t.description || t.category;
                                return `
                                    <tr>
                                        <td class="small-text">${t.transactionNo}</td>
                                        <td>
                                            ${khataInfo ? `<div style="font-weight:700; font-size:0.75rem;">${khataInfo}</div>` : ''}
                                            <div style="font-size:0.7rem; color:#333;">${remarks}</div>
                                        </td>
                                        <td class="text-right text-success">${t.amount.toLocaleString()}</td>
                                    </tr>
                                `;
                            }).join('') : '<tr><td colspan="3" class="text-center empty-cell">No Income</td></tr>'}
                        </tbody>
                        <tfoot>
                            <tr class="total-row">
                                <td colspan="2">TOTAL CASH IN</td>
                                <td class="text-right">${stats.income.toLocaleString()}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <!-- Right Column: EXPENSE / CASH OUT -->
                <div class="print-column">
                    <div class="column-header expense-header">CASH OUT / EXPENSE (DEBIT)</div>
                    <table class="print-table compact">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Description</th>
                                <th class="text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${expenseEntries.length > 0 ? expenseEntries.map(t => {
                                const customer = t.customerId ? db.data.customers.find(c => c.id === t.customerId) : null;
                                const khataInfo = customer ? `[${customer.khataNo}] ${customer.name}` : '';
                                const remarks = t.description || t.category;
                                return `
                                    <tr>
                                        <td class="small-text">${t.transactionNo}</td>
                                        <td>
                                            ${khataInfo ? `<div style="font-weight:700; font-size:0.75rem;">${khataInfo}</div>` : ''}
                                            <div style="font-size:0.7rem; color:#333;">${remarks}</div>
                                        </td>
                                        <td class="text-right text-danger">${t.amount.toLocaleString()}</td>
                                    </tr>
                                `;
                            }).join('') : '<tr><td colspan="3" class="text-center empty-cell">No Expenses</td></tr>'}
                        </tbody>
                        <tfoot>
                            <tr class="total-row">
                                <td colspan="2">TOTAL CASH OUT</td>
                                <td class="text-right">${stats.expense.toLocaleString()}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
            
            <div class="print-summary-strong">
                <div class="summary-box">
                    <div class="summary-row">
                        <span>Total Cash In:</span>
                        <span class="text-success">${currency} ${stats.income.toLocaleString()}</span>
                    </div>
                    <div class="summary-row">
                        <span>Total Cash Out:</span>
                        <span class="text-danger">${currency} ${stats.expense.toLocaleString()}</span>
                    </div>
                    <div class="summary-row net-row">
                        <span>NET CASH BALANCE:</span>
                        <span class="${stats.net >= 0 ? 'text-success' : 'text-danger'}">${currency} ${stats.net.toLocaleString()}</span>
                    </div>
                </div>
            </div>
            
            <div class="print-footer-strong">
                <div class="footer-sign">Signature: _______________________</div>
                <div class="footer-time">Generated: ${new Date().toLocaleString()}</div>
            </div>
        </div>
    `;
    
    const container = document.getElementById('ledger-print-container');
    if (container) {
        container.innerHTML = html;
        document.body.classList.add('printing-report');
        window.print();
        // Clear after print
        setTimeout(() => { 
            container.innerHTML = ''; 
            document.body.classList.remove('printing-report');
        }, 1000);
    }
}

/**
 * Navigation & View Management
 */
function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const views = document.querySelectorAll('.view');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetView = link.getAttribute('data-view');
            
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            views.forEach(view => {
                view.classList.remove('active');
                if (view.id === `${targetView}-view`) {
                    view.classList.add('active');
                }
            });

            console.log(`Switched to view: ${targetView}`);
            updateUI();
        });
    });
}

/**
 * Theme Toggle
 */
function setupThemeToggle() {
    const toggleBtn = document.getElementById('theme-toggle');
    const body = document.body;
    const icon = toggleBtn?.querySelector('i');

    const savedTheme = localStorage.getItem('khata-theme') || 'dark';
    if (savedTheme === 'light') {
        body.classList.remove('dark-theme');
        if (icon) icon.className = 'fas fa-sun';
    }

    toggleBtn?.addEventListener('click', () => {
        body.classList.toggle('dark-theme');
        const isDark = body.classList.contains('dark-theme');
        if (icon) icon.className = isDark ? 'fas fa-moon' : 'fas fa-sun';
        localStorage.setItem('khata-theme', isDark ? 'dark' : 'light');
    });
}

/**
 * Modal & Form Management
 */
function setupModalHandlers() {
    const modal = document.getElementById('modal-container');
    const closeBtn = document.querySelector('.btn-close');
    const mainForm = document.getElementById('main-form');

    // Button Listeners
    document.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        if (target.classList.contains('btn-add-customer')) {
            openModal('Add New Customer', 'add-customer');
        } else if (target.classList.contains('btn-add-income')) {
            openModal('Add Income', 'add-income');
        } else if (target.classList.contains('btn-add-expense')) {
            openModal('Add Expense', 'add-expense');
        } else if (target.classList.contains('btn-add-transaction')) {
            openModal('New Daily Entry (Income)', 'add-income');
        } else if (target.classList.contains('btn-edit-customer')) {
            const id = target.dataset.id;
            const customer = db.data.customers.find(c => c.id == id);
            openModal('Edit Customer', 'edit-customer', customer);
        } else if (target.classList.contains('btn-edit-entry')) {
            const id = target.dataset.id;
            const entry = db.data.rooznamcha.find(e => e.id == id);
            openModal(`Edit Transaction #${entry.transactionNo}`, 'edit-entry', entry);
        } else if (target.classList.contains('btn-add-ledger-entry') || target.classList.contains('btn-view-ledger')) {
            const customerId = target.dataset.id;
            if (target.classList.contains('btn-view-ledger')) {
                openModal('Customer Ledger Statement', 'view-ledger');
                renderLedgerStatement(customerId);
            } else {
                const customer = db.data.customers.find(c => c.id === customerId);
                openModal(`Add Entry for ${customer.name}`, 'khata-entry');
                mainForm.dataset.customerId = customerId;
            }
        } else if (target.closest('.btn-whatsapp-direct')) {
            const customerId = target.closest('.btn-whatsapp-direct').dataset.id;
            shareOnWhatsApp(customerId);
        } else if (target.id === 'btn-print-rooznamcha') {
            const dateFilter = document.getElementById('rooznamcha-date-filter')?.value || new Date().toISOString().split('T')[0];
            printRoozReport(dateFilter);
        } else if (target.closest('.btn-print-direct')) {
            const customerId = target.closest('.btn-print-direct').dataset.id;
            openModal('Customer Ledger Statement', 'view-ledger');
            renderLedgerStatement(customerId);
            setTimeout(() => window.print(), 300); // Wait for modal to render
        } else if (target.id === 'btn-global-undo') {
            db.undo();
            updateUI();
        } else if (target.id === 'btn-global-redo') {
            db.redo();
            updateUI();
        } else if (target.id === 'btn-empty-trash') {
            db.emptyTrash();
            updateUI();
        } else if (target.classList.contains('btn-restore-trash')) {
            const trashId = target.dataset.id;
            db.restoreFromTrash(trashId);
            showToast('Item restored from trash!', 'success');
            updateUI();
        } else if (target.closest('.btn-delete-entry')) {
            const entryId = target.closest('.btn-delete-entry').dataset.id;
            if (confirm("CAUTION: Are you sure you want to delete this transaction? You will lose this data forever!")) {
                db.deleteRooznamchaEntry(entryId);
                showUndoToast('Transaction Deleted');
                updateUI();
            }
        } else if (target.closest('.btn-delete-customer')) {
            const customerId = target.closest('.btn-delete-customer').dataset.id;
            if (confirm("CAUTION: Are you sure you want to delete this customer? All their ledger history will be lost!")) {
                db.deleteCustomer(customerId);
                showUndoToast('Customer Deleted');
                updateUI();
            }
        }
    });

    // Backup & Restore
    document.getElementById('btn-export-csv')?.addEventListener('click', () => {
        db.exportToCSV();
    });

    document.getElementById('btn-export-data')?.addEventListener('click', () => {
        const data = db.exportData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `khata_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });

    const importInput = document.getElementById('import-file-input');
    document.getElementById('btn-import-data')?.addEventListener('click', () => importInput.click());
    
    importInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            if (db.importData(event.target.result)) {
                showToast('Data imported successfully!', 'success');
                setTimeout(() => location.reload(), 600);
            } else {
                showToast('Import failed. Please choose a valid Khata backup file.', 'error');
            }
        };
        reader.readAsText(file);
    });

    // Ledger Search
    document.addEventListener('input', (e) => {
        if (e.target.id === 'ledger-search') {
            const query = e.target.value.toLowerCase();
            const rows = document.querySelectorAll('.ledger-statement .data-table tbody tr');
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(query) ? '' : 'none';
            });
        }
    });

    closeBtn?.addEventListener('click', () => {
        modal.classList.remove('active');
        document.body.classList.remove('modal-open');
    });
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
            document.body.classList.remove('modal-open');
        }
    });

    mainForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const success = handleFormSubmit(new FormData(mainForm));
        if (success === false) return; // Validation failed
        
        modal.classList.remove('active');
        document.body.classList.remove('modal-open');
        updateUI();
    });

    // Phone Number Auto-formatter
    document.addEventListener('input', (e) => {
        if (e.target.name === 'phone') {
            let val = e.target.value.replace(/\D/g, ''); // Remove non-digits
            if (val.length > 11) val = val.substring(0, 11); // Limit to 11 digits
            
            // Format as 03xx-xxxxxxx (Pakistan standard)
            if (val.length > 4) {
                val = val.substring(0, 4) + '-' + val.substring(4);
            }
            
            e.target.value = val;
        }
    });
}

function openModal(title, type, data = null) {
    const modal = document.getElementById('modal-container');
    const modalTitle = document.getElementById('modal-title');
    const form = document.getElementById('main-form');
    
    modalTitle.innerText = title;
    form.dataset.type = type;
    if (data && data.id) form.dataset.editId = data.id;
    else delete form.dataset.editId;

    form.innerHTML = renderForm(type, data);
    modal.classList.add('active');
    document.body.classList.add('modal-open');
}

function renderForm(type, data = null) {
    switch(type) {
        case 'add-customer':
        case 'edit-customer':
            const isCustEdit = type === 'edit-customer';
            return `
                <div class="form-group">
                    <label>Customer Name</label>
                    <input type="text" name="name" required placeholder="Enter name" value="${data ? data.name : ''}">
                </div>
                <div class="form-group">
                    <label>Phone Number</label>
                    <input type="text" name="phone" required placeholder="03xx-xxxxxxx" value="${data ? data.phone : ''}">
                </div>
                ${!isCustEdit ? `
                <div class="form-group highlight">
                    <label>Manual Khata No (Optional)</label>
                    <input type="number" name="manualKhataNo" placeholder="Leave empty for auto-assign">
                    <p class="form-hint">If left blank, the app will automatically assign the next available number.</p>
                </div>
                ` : ''}
                <div class="modal-footer">
                    <button type="submit" class="btn btn-primary">${data ? 'Update' : 'Save'} Customer</button>
                </div>
            `;
        case 'add-income':
        case 'add-expense':
        case 'edit-entry':
        case 'income':
        case 'expense':
            const isEdit = type === 'edit-entry';
            const realType = isEdit ? data.type : (type === 'add-income' || type === 'income') ? 'income' : 'expense';
            const customerOptions = db.data.customers.map(c => `<option value="${c.id}" ${data && data.customerId == c.id ? 'selected' : ''}>${c.name} (${c.phone})</option>`).join('');
            
            return `
                <div class="form-header-badge ${realType}">${realType.toUpperCase()} ENTRY</div>
                <input type="hidden" name="entryType" value="${realType}">
                
                <div class="form-row">
                    <div class="form-group flex-1">
                        <label>Transaction Amount</label>
                        <input type="number" name="amount" required placeholder="0.00" autoFocus value="${data ? data.amount : ''}">
                    </div>
                    <div class="form-group flex-1">
                        <label>Category</label>
                        <select name="category">
                            <option value="General" ${data && data.category === 'General' ? 'selected' : ''}>General</option>
                            <option value="Sales" ${data && data.category === 'Sales' ? 'selected' : ''}>Sales / Recovery</option>
                            <option value="Purchase" ${data && data.category === 'Purchase' ? 'selected' : ''}>Purchase / Supplies</option>
                            <option value="Expenses" ${data && data.category === 'Expenses' ? 'selected' : ''}>Daily Expenses</option>
                            <option value="Salary" ${data && data.category === 'Salary' ? 'selected' : ''}>Salary</option>
                        </select>
                    </div>
                </div>

                <div class="form-group highlight">
                    <label>Link to Khata (Customer Name)</label>
                    <select name="customerId">
                        <option value="">-- Cash Transaction (No Khata) --</option>
                        ${customerOptions}
                    </select>
                    <p class="form-hint">Selecting a customer will automatically record this in their manual book (Khata).</p>
                </div>

                <div class="form-group">
                    <label>Short Description / Remarks</label>
                    <input type="text" name="description" placeholder="e.g. Bill #102, Received advance, etc." value="${data ? data.description : ''}">
                </div>
                
                <div class="modal-footer">
                    <button type="submit" class="btn btn-primary full-width">${isEdit ? 'Update' : 'Post'} to Daily Book & Khata</button>
                </div>
            `;
        case 'khata-entry':
            return `
                <div class="form-group">
                    <label>Type</label>
                    <select name="type">
                        <option value="credit">Credit (I will receive)</option>
                        <option value="debit">Debit (I paid/gave)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Amount</label>
                    <input type="number" name="amount" required>
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <input type="text" name="description" placeholder="Details">
                </div>
                <div class="modal-footer">
                    <button type="submit" class="btn btn-primary">Add to Ledger</button>
                </div>
            `;
        case 'view-ledger':
            return `<div id="ledger-print-container"></div>`;
        default: return '';
    }
}

function renderLedgerStatement(customerId) {
    const currency = db.data.settings.currency || 'Rs.';
    const customer = db.data.customers.find(c => c.id == customerId);
    const ledger = db.getCustomerLedger(customerId);
    const container = document.getElementById('ledger-print-container');
    
    if (!customer || !container) return;

    let html = `
        <div class="ledger-statement printable-area">
            <div class="ledger-header-print">
                <h2 style="text-align: center; border-bottom: 1.5px solid #000; padding-bottom: 5px; margin-bottom: 10px; font-size: 1.4rem; text-transform: uppercase;">Ledger Statement</h2>
                <h3 style="text-align: center; margin-bottom: 15px; font-size: 1.1rem; color: #333;">${db.data.settings.shopName}</h3>
            </div>
            
            <div class="no-print" style="margin-bottom: 15px; background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px;">
                <input type="text" id="ledger-search" placeholder="Search transactions..." style="width: 100%; height: 36px; padding: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: white; font-size: 0.9rem;">
            </div>

            <div class="ledger-summary-mini" style="display: flex; justify-content: space-between; margin-bottom: 15px; padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 0.85rem;">
                <div><strong>Khata No:</strong> ${customer.khataNo}</div>
                <div><strong>Customer:</strong> ${customer.name}</div>
                <div><strong>Balance:</strong> <span class="${customer.balance >= 0 ? 'text-success' : 'text-danger'}" style="font-weight: bold;">${currency} ${Math.abs(customer.balance).toLocaleString()} ${customer.balance >= 0 ? '(Receivable)' : '(Payable)'}</span></div>
            </div>
            <div class="table-responsive">
                <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
                    <thead>
                        <tr style="background: #f1f5f9;">
                            <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: left;">Date</th>
                            <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: left;">Trans #</th>
                            <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: left;">Description</th>
                            <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right;">Credit (+)</th>
                            <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right;">Debit (-)</th>
                            <th style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right;">Balance</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(() => {
                            let runningBalance = 0;
                            return ledger.map(t => {
                                runningBalance += (t.type === 'credit' ? t.amount : -t.amount);
                                const original = db.data.rooznamcha.find(r => r.id == t.linkedRooznamchaId);
                                const displayId = original ? `#${original.transactionNo}` : 'Direct';
                                return `
                                    <tr>
                                        <td style="padding: 5px 8px; border: 1px solid #e2e8f0;">${new Date(t.date).toLocaleDateString()}</td>
                                        <td style="padding: 5px 8px; border: 1px solid #e2e8f0; font-family: monospace; font-size: 0.75rem;">${displayId}</td>
                                        <td style="padding: 5px 8px; border: 1px solid #e2e8f0;">${t.description}</td>
                                        <td style="padding: 5px 8px; border: 1px solid #e2e8f0; text-align: right;" class="text-success">${t.type === 'credit' ? currency + ' ' + t.amount.toLocaleString() : '-'}</td>
                                        <td style="padding: 5px 8px; border: 1px solid #e2e8f0; text-align: right;" class="text-danger">${t.type === 'debit' ? currency + ' ' + t.amount.toLocaleString() : '-'}</td>
                                        <td style="padding: 5px 8px; border: 1px solid #e2e8f0; text-align: right; font-weight: 600;">
                                            ${currency} ${Math.abs(runningBalance).toLocaleString()} ${runningBalance >= 0 ? 'Cr' : 'Dr'}
                                        </td>
                                    </tr>
                                `;
                            }).join('');
                        })()}
                        ${ledger.length === 0 ? '<tr><td colspan="6" style="padding: 15px; text-align: center; border: 1px solid #e2e8f0;">No transactions found</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
            <div class="modal-footer no-print" style="margin-top: 15px; display: flex; gap: 10px;">
                <button class="btn btn-secondary" onclick="copyLedgerAsText('${customerId}')" style="flex: 1; height: 40px; font-size: 0.9rem;">
                    <i class="fas fa-copy"></i> Copy as Text
                </button>
                <button class="btn btn-primary" onclick="window.print()" style="flex: 1; height: 40px; font-size: 0.9rem;">
                    <i class="fas fa-print"></i> Print Statement
                </button>
            </div>
        </div>
    `;
    container.innerHTML = html;
}

window.copyLedgerAsText = (customerId) => {
    const customer = db.data.customers.find(c => c.id == customerId);
    if (!customer) return;

    const currency = db.data.settings.currency || 'Rs.';
    const shopName = db.data.settings.shopName || 'Our Shop';
    const balance = Math.abs(customer.balance).toLocaleString();
    const status = customer.balance >= 0 ? 'Receivable' : 'Payable';
    
    let text = `*Ledger Statement: ${customer.name}*\n`;
    text += `*Shop:* ${shopName}\n`;
    text += `*Current Balance:* ${currency} ${balance} (${status})\n\n`;
    text += `*Recent Transactions:*\n`;
    
    const ledger = db.getCustomerLedger(customerId).slice(-5);
    ledger.forEach(t => {
        text += `- ${new Date(t.date).toLocaleDateString()}: ${t.type === 'credit' ? '+' : '-'} ${currency} ${t.amount.toLocaleString()} (${t.description})\n`;
    });

    navigator.clipboard.writeText(text).then(() => {
        showToast('Statement copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Failed to copy:', err);
        showToast('Failed to copy statement.', 'error');
    });
};

function handleFormSubmit(formData) {
    const form = document.getElementById('main-form');
    const type = form.dataset.type;
    const editId = form.dataset.editId;
    
    if (type === 'add-customer' || type === 'edit-customer') {
        const name = formData.get('name')?.trim();
        const phone = formData.get('phone')?.trim();
        const manualKhataNo = formData.get('manualKhataNo')?.trim();
        if (!name || !phone) { showToast('Name and phone are required.', 'error'); return false; }
        
        if (editId) {
            db.updateCustomer(editId, name, phone);
            showToast('Customer updated successfully!', 'success');
        } else {
            db.addCustomer(name, phone, manualKhataNo);
            showToast('New customer added!', 'success');
        }
    } else if (type === 'add-income' || type === 'add-expense' || type === 'edit-entry' || type === 'income' || type === 'expense') {
        const amount = parseFloat(formData.get('amount'));
        if (isNaN(amount) || amount <= 0) { showToast('Enter a valid amount greater than 0.', 'error'); return false; }
        
        const entryType = formData.get('entryType');
        const category = formData.get('category');
        const description = formData.get('description');
        const customerId = formData.get('customerId') || null;
        
        if (editId) {
            db.updateRooznamchaEntry(editId, amount, entryType, category, description, customerId);
            showToast('Transaction updated!', 'success');
        } else {
            db.addRooznamchaEntry(amount, entryType, category, description, customerId);
            showToast(`New ${entryType} recorded!`, 'success');
        }
    } else if (type === 'khata-entry') {
        const amount = parseFloat(formData.get('amount'));
        if (isNaN(amount) || amount <= 0) { showToast('Enter a valid amount greater than 0.', 'error'); return false; }
        db.addKhataEntry(form.dataset.customerId, amount, formData.get('type'), formData.get('description'));
        showToast('Ledger entry added!', 'success');
    }
    return true;
}

function shareOnWhatsApp(customerId) {
    const customer = db.data.customers.find(c => c.id == customerId);
    if (!customer) return;

    const currency = db.data.settings.currency || 'Rs.';
    const shopName = db.data.settings.shopName || 'Our Shop';
    const balance = Math.abs(customer.balance).toLocaleString();
    const status = customer.balance >= 0 ? 'you owe us' : 'we owe you';
    
    const message = `*Khata Statement from ${shopName}*\n\n` +
                    `Dear *${customer.name}*,\n` +
                    `Your current balance is *${currency} ${balance}* (${status}).\n\n` +
                    `Please contact us for details. Thank you!`;

    const encodedMessage = encodeURIComponent(message);
    const phoneNumber = customer.phone.replace(/[^0-9]/g, ''); // Remove non-numeric chars
    
    // Check if phone starts with a country code, if not assume a default or just use the number
    const finalPhone = phoneNumber.startsWith('92') || phoneNumber.length > 10 ? phoneNumber : `92${phoneNumber}`;

    window.open(`https://wa.me/${finalPhone}?text=${encodedMessage}`, '_blank');
}

/**
 * Data Loading & UI Population
 */
function updateUI(dateFilter = null, searchQuery = "") {
    const roozDateFilter = document.getElementById('rooznamcha-date-filter');
    const todayStr = new Date().toISOString().split('T')[0];
    if (roozDateFilter && !roozDateFilter.value) roozDateFilter.value = todayStr;
    const effectiveDateFilter = dateFilter ?? (roozDateFilter?.value || null);

    const stats = db.getStats();
    updateStatsDisplay(stats);
    updateRooznamchaLists(effectiveDateFilter, searchQuery);
    updateCustomerLists();
    updateTrashList();
    updateCharts();
}

function updateTrashList() {
    const trashList = document.getElementById('trash-list');
    if (!trashList) return;

    const currency = db.data.settings.currency || 'Rs.';
    trashList.innerHTML = db.data.trash.slice().reverse().map(item => {
        let details = '';
        if (item.type === 'customer') {
            // Fix: Ensure we use item.data for customer name and khata no
            details = `<strong>Customer:</strong> ${item.data.name} (Khata: ${item.data.khataNo})`;
        } else {
            // Fix: Handle transaction data properly
            const amount = item.data.amount ? item.data.amount.toLocaleString() : '0';
            const type = item.data.type ? item.data.type.toUpperCase() : 'ENTRY';
            details = `<strong>${type}:</strong> ${currency} ${amount} - ${item.data.description || ''}`;
        }

        return `
            <tr>
                <td><span class="badge ${item.type === 'customer' ? 'badge-info' : 'badge-warning'}">${item.type.toUpperCase()}</span></td>
                <td>${details}</td>
                <td>${new Date(item.deletedAt).toLocaleString()}</td>
                <td class="text-right">
                    <button class="btn btn-icon btn-restore-trash" data-id="${item.id}" title="Restore">
                        <i class="fas fa-undo"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    if (db.data.trash.length === 0) {
        trashList.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted);">Trash is empty</td></tr>';
    }
}

function updateStatsDisplay(stats) {
    const currency = db.data.settings.currency || 'Rs.';
    const elements = {
        'total-cash': formatMoney(stats.cashInHand, currency),
        'total-receivables': formatMoney(stats.totalReceivables, currency),
        'total-payables': formatMoney(stats.totalPayables, currency),
        'total-net-today': formatMoney(db.getTodayStats().net, currency),
        'report-cash': formatMoney(stats.cashInHand, currency),
        'report-rec': formatMoney(stats.totalReceivables, currency),
        'report-pay': formatMoney(stats.totalPayables, currency)
    };

    const logoSpan = document.querySelector('.logo span');
    if (logoSpan) logoSpan.innerText = db.data.settings.shopName || 'KhataPro';
    updateProfileDisplay();

    for (const [id, value] of Object.entries(elements)) {
        const el = document.getElementById(id);
        if (el) el.innerText = value;
    }

    const trendEl = document.getElementById('cash-trend');
    const trendValueEl = document.getElementById('cash-trend-value');
    if (trendEl && trendValueEl) {
        const pct = getCashTrendPercent();
        const hasData = db.data.rooznamcha.length > 0;
        if (!hasData) {
            trendEl.hidden = true;
        } else {
            trendEl.hidden = false;
            trendEl.classList.remove('up', 'down', 'neutral');
            if (pct > 0) {
                trendEl.classList.add('up');
                trendEl.querySelector('i').className = 'fas fa-arrow-up';
            } else if (pct < 0) {
                trendEl.classList.add('down');
                trendEl.querySelector('i').className = 'fas fa-arrow-down';
            } else {
                trendEl.classList.add('neutral');
                trendEl.querySelector('i').className = 'fas fa-minus';
            }
            trendValueEl.textContent = `${Math.abs(pct)}%`;
        }
    }
}

function updateRooznamchaLists(dateFilter, searchQuery) {
    const currency = db.data.settings.currency || 'Rs.';
    const recentList = document.getElementById('recent-transactions-list');
    const rooznamchaList = document.getElementById('rooznamcha-list');
    
    if (!recentList && !rooznamchaList) return;

    // Daily Summary Stats
    const displayDate = dateFilter || new Date().toISOString().split('T')[0];
    const todayStats = db.getFilteredStats(displayDate, displayDate);
    const todayIncomeEl = document.getElementById('today-income');
    const todayExpenseEl = document.getElementById('today-expense');
    const todayNetEl = document.getElementById('today-net');

    if (todayIncomeEl) todayIncomeEl.textContent = `${currency} ${todayStats.income.toLocaleString()}`;
    if (todayExpenseEl) todayExpenseEl.textContent = `${currency} ${todayStats.expense.toLocaleString()}`;
    if (todayNetEl) {
        todayNetEl.textContent = `${currency} ${Math.abs(todayStats.net).toLocaleString()}`;
        todayNetEl.className = `value ${todayStats.net >= 0 ? 'positive' : 'negative'}`;
    }

    let roozViewTransactions = db.getFilteredRooznamcha(dateFilter);
    let recentTransactions = db.getFilteredRooznamcha(null);
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const applySearch = (t) => {
            const customer = t.customerId ? db.data.customers.find(c => c.id === t.customerId) : null;
            const searchStr = `${t.description} ${t.category} ${customer ? customer.name : ''}`.toLowerCase();
            return searchStr.includes(q);
        };
        roozViewTransactions = roozViewTransactions.filter(applySearch);
        recentTransactions = recentTransactions.filter(applySearch);
    }

    const renderRoozRow = (t) => {
        const customer = t.customerId ? db.data.customers.find(c => c.id === t.customerId) : null;
        return `
            <tr>
                <td>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">#${t.transactionNo || 'N/A'} (Pg ${t.pageNo || '1'})</div>
                    ${new Date(t.date).toLocaleString()}
                </td>
                <td>
                    <div>${t.description || 'No description'}</div>
                    ${customer ? `
                        <div style="margin-top: 5px;">
                            <span style="background: var(--primary); color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700;">KHATA NO: ${customer.khataNo}</span>
                            <span style="color: var(--primary); font-size: 0.85rem; margin-left: 5px;">${customer.name}</span>
                        </div>
                    ` : ''}
                </td>
                <td><span class="badge ${t.type}">${t.category}</span></td>
                <td class="${t.type === 'income' ? 'text-success' : 'text-danger'}">
                    ${t.type === 'income' ? '+' : '-'} ${currency} ${t.amount.toLocaleString()}
                </td>
                <td>${t.type}</td>
                <td class="no-print">
                    <div class="table-actions">
                        <button class="btn-icon btn-edit-entry" data-id="${t.id}" title="Edit Transaction">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-delete btn-delete-entry" data-id="${t.id}">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    };

    const renderRecentRow = (t) => {
        const customer = t.customerId ? db.data.customers.find(c => c.id === t.customerId) : null;
        return `
            <tr>
                <td>${new Date(t.date).toLocaleDateString()}</td>
                <td>
                    <div>${t.description || 'No description'}</div>
                    ${customer ? `<div style="margin-top: 5px; color: var(--primary); font-size: 0.85rem;">${customer.name}</div>` : ''}
                </td>
                <td><span class="badge ${t.type}">${t.category}</span></td>
                <td class="${t.type === 'income' ? 'text-success' : 'text-danger'}">
                    ${t.type === 'income' ? '+' : '-'} ${currency} ${t.amount.toLocaleString()}
                </td>
            </tr>
        `;
    };

    if (recentList) {
        recentList.innerHTML = recentTransactions.length === 0 ? '<tr><td colspan="4" class="text-center">No recent transactions</td></tr>' : recentTransactions.slice(0, 5).map(renderRecentRow).join('');
    }
    if (rooznamchaList) {
        rooznamchaList.innerHTML = roozViewTransactions.length === 0 ? '<tr><td colspan="6" class="text-center">No transactions recorded</td></tr>' : roozViewTransactions.map(renderRoozRow).join('');
    }
}

function updateCustomerLists() {
    const currency = db.data.settings.currency || 'Rs.';
    const topCustomers = document.getElementById('top-customers-list');
    const khataList = document.getElementById('customers-list');
    
    if (!topCustomers && !khataList) return;

    const customers = [...db.data.customers].sort((a,b) => b.balance - a.balance);
    
    if (topCustomers) {
        const top = customers.slice(0, 5);
        topCustomers.innerHTML = top.length === 0 ? '<p class="empty-state">No customers added yet.</p>' : top.map(c => `
            <div class="customer-item">
                <div class="cust-info">
                    <span class="cust-name">${c.name}</span>
                    <span class="cust-phone">${c.phone}</span>
                </div>
                <span class="cust-balance ${c.balance >= 0 ? 'plus' : 'minus'}">
                    ${currency} ${Math.abs(c.balance).toLocaleString()}
                </span>
            </div>
        `).join('');
    }

    if (khataList) {
        khataList.innerHTML = customers.length === 0 ? '<tr><td colspan="5" class="text-center">No customers found</td></tr>' : customers.map(c => `
            <tr>
                <td><strong>${c.khataNo}</strong></td>
                <td>${c.name}</td>
                <td>${c.phone}</td>
                <td>${c.transactions.length > 0 ? new Date(c.transactions[c.transactions.length-1].date).toLocaleDateString() : 'N/A'}</td>
                <td class="${c.balance >= 0 ? 'text-success' : 'text-danger'}">
                    ${currency} ${Math.abs(c.balance).toLocaleString()} ${c.balance >= 0 ? '(THEY WILL GIVE ME)' : '(I WILL GIVE THEM)'}
                </td>
                <td>
                    <div class="table-actions">
                        <button class="btn-text btn-view-ledger" data-id="${c.id}" title="View Ledger">View</button>
                        <button class="btn-icon btn-whatsapp-direct no-print" data-id="${c.id}" title="Share on WhatsApp">
                            <i class="fab fa-whatsapp"></i>
                        </button>
                        <button class="btn-icon btn-edit-customer no-print" data-id="${c.id}" title="Edit Customer">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon btn-print-direct no-print" data-id="${c.id}" title="Print Statement">
                            <i class="fas fa-print"></i>
                        </button>
                        <button class="btn-delete btn-delete-customer no-print" data-id="${c.id}">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }
}

function showToast(message, type = 'info') {
    let toast = document.querySelector('.toast-container');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast-container';
        document.body.appendChild(toast);
    }
    
    // Immediate force-hide and content update
    toast.classList.remove('show');
    
    let iconClass = 'fas fa-info-circle';
    let iconColor = 'white';
    
    if (type === 'success') { iconClass = 'fas fa-check-circle'; iconColor = 'var(--success)'; }
    else if (type === 'error') { iconClass = 'fas fa-exclamation-circle'; iconColor = 'var(--danger)'; }
    else if (type === 'backup') { iconClass = 'fas fa-cloud-arrow-up'; iconColor = 'var(--primary)'; }

    toast.innerHTML = `
        <i class="${iconClass}" style="color:${iconColor};"></i>
        <span style="font-size: 0.9rem; font-weight: 500;">${message}</span>
        ${type === 'undo' ? '<div class="toast-undo-btn" onclick="undoAction()">Undo</div>' : ''}
    `;
    
    // Trigger layout reflow to ensure animation works
    void toast.offsetWidth;
    
    toast.classList.add('show');
    
    clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

function showUndoToast(message) {
    showToast(message, 'undo');
}

window.undoAction = () => {
    db.undo();
    updateUI();
    const toast = document.querySelector('.toast-container');
    if (toast) toast.classList.remove('show');
};
