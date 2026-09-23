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
        receivables: 'Banam (they owe you)',
        payables: 'Jama (you owe them)',
        newEntry: 'New Entry',
        addCustomer: 'Add Party',
        addIncome: 'Add Income',
        addExpense: 'Add Expense',
        home: 'Home',
        dailyShort: 'Daily',
        khataShort: 'Khata',
        menu: 'Menu',
        stock: 'Stock',
        bills: 'Bills'
    },
    ur: {
        dashboard: 'ÚˆÛŒØ´ Ø¨ÙˆØ±Úˆ',
        khata: 'Ú©Ú¾Ø§ØªÛ Ø¨Ú©',
        rooznamcha: 'Ø±ÙˆØ²Ù†Ø§Ù…Ú†Û',
        reports: 'Ø±Ù¾ÙˆØ±Ù¹Ø³',
        settings: 'Ø³ÛŒÙ¹Ù†Ú¯Ø²',
        trash: 'Ù¹Ø±ÛŒØ´',
        cashInHand: 'نقدی',
        receivables: 'بنام',
        payables: 'جمع',
        newEntry: 'Ù†ÛŒØ§ Ø§Ù†Ø¯Ø±Ø§Ø¬',
        addCustomer: 'Ú¯Ø§ÛÚ© Ø´Ø§Ù…Ù„ Ú©Ø±ÛŒÚº',
        addIncome: 'Ø¢Ù…Ø¯Ù†ÛŒ Ø´Ø§Ù…Ù„ Ú©Ø±ÛŒÚº',
        addExpense: 'Ø§Ø®Ø±Ø§Ø¬Ø§Øª Ø´Ø§Ù…Ù„ Ú©Ø±ÛŒÚº',
        home: 'Home',
        dailyShort: 'Daily',
        khataShort: 'Khata',
        menu: 'Menu',
        stock: 'سٹاک',
        bills: 'بلز'
    }
};

/**
 * Unused folder-handle helpers (manual backup removed).
 */
const HandleStore = {
    async save() {},
    async get() { return null; }
};

class DataManager {
    constructor() {
        this.data = JSON.parse(localStorage.getItem('khata-data')) || {
            customers: [],
            rooznamcha: [],
            stock: [],
            bills: [],
            trash: [], // New Trash collection
            settings: {
                shopName: 'My Business',
                currency: 'Rs.',
                language: 'en',
                backupFolderPath: null,
                nextKhataNo: 1,
                nextTransactionNo: 1001,
                nextBillNo: 1,
                openingCash: 0
            }
        };
        this.undoStack = [];
        this.redoStack = [];
        this.maxStackSize = 50;

        // Ensure defaults...
        if (!this.data.trash) this.data.trash = [];
        if (!Array.isArray(this.data.stock)) this.data.stock = [];
        if (!Array.isArray(this.data.bills)) this.data.bills = [];
        if (!this.data.settings.nextKhataNo) this.data.settings.nextKhataNo = 1;
        if (!this.data.settings.nextTransactionNo) this.data.settings.nextTransactionNo = 1001;
        if (!this.data.settings.nextBillNo) this.data.settings.nextBillNo = 1;
        if (!this.data.settings.language) this.data.settings.language = 'en';
        if (this.data.settings.backupFolderPath === undefined) this.data.settings.backupFolderPath = null;
        if (this.data.settings.openingCash === undefined || this.data.settings.openingCash === null) {
            this.data.settings.openingCash = 0;
        }
        if (this.ensureBillRooznamcha()) this.save(true);
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
        try {
            localStorage.setItem('khata-data', JSON.stringify(this.data));
        } catch (err) {
            console.error('localStorage save failed', err);
            if (typeof showToast === 'function') showToast('Local save failed: storage full or blocked', 'error');
        }
        this.updateUndoRedoButtons();
        if (window.AccountCloud && AccountCloud.user) AccountCloud.queueSync();
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
    addCustomer(name, phone, manualKhataNo = null, extra = {}) {
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

        const role = extra.role === 'supplier' ? 'supplier' : 'customer';
        this.data.customers.push({ id, khataNo, name, phone: phone || '', balance: 0, transactions: [], role });
        const opening = Number(extra.openingAmount) || 0;
        if (opening > 0) {
            const openingType = extra.openingType === 'debit' ? 'debit' : 'credit';
            this.addKhataEntry(id, opening, openingType, 'Opening balance', null, extra.openingDate || null);
        } else {
            this.save();
        }
        return id;
    }

    // Ledger Transactions (Internal)
    addKhataEntry(customerId, amount, type, description, linkedId = null, dateISO = null) {
        const customer = this.data.customers.find(c => c.id == customerId);
        if (customer) {
            const entry = {
                id: Date.now().toString(),
                amount,
                type,
                description,
                date: dateISO || nowStamp(),
                linkedId
            };
            customer.transactions.push(entry);
            customer.balance += (type === 'credit' ? amount : -amount);
            this.save();
        }
    }

    // Rooznamcha Management (Daily Diary)
    addRooznamchaEntry(amount, type, category, description, customerId = null, dateISO = null) {
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
            date: dateISO || nowStamp(),
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
        
        const entry = this.data.rooznamcha[index];
        if (entry.type === 'bill' || entry.linkedBillId) {
            const bill = (this.data.bills || []).find(b => b.id == entry.linkedBillId || b.rooznamchaId == entry.id);
            if (bill) {
                this.deleteBill(bill.id);
                return;
            }
        }
        this.data.rooznamcha.splice(index, 1);
        
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
            const entry = trashItem.data;
            if (entry.customerId && entry.type !== 'bill' && !entry.linkedBillId) {
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
        } else if (trashItem.type === 'stock') {
            if (!Array.isArray(this.data.stock)) this.data.stock = [];
            this.data.stock.push(trashItem.data);
        } else if (trashItem.type === 'bill') {
            this.restoreBillRecord(trashItem.data);
        }
        this.save();
    }

    emptyTrash() {
        if (confirm("Are you sure you want to permanently delete all items in trash?")) {
            this.data.trash = [];
            this.save();
        }
    }

    addStockItem({ name, unit, qty, minQty, buyPrice, sellPrice }) {
        if (!Array.isArray(this.data.stock)) this.data.stock = [];
        const item = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name,
            unit: unit || 'pcs',
            qty: Number(qty) || 0,
            minQty: Number(minQty) || 0,
            buyPrice: Number(buyPrice) || 0,
            sellPrice: Number(sellPrice) || 0,
            createdAt: nowStamp()
        };
        this.data.stock.push(item);
        this.save();
        return item.id;
    }

    updateStockItem(id, fields) {
        const item = this.data.stock.find(s => s.id == id);
        if (!item) return;
        if (fields.name != null) item.name = fields.name;
        if (fields.unit != null) item.unit = fields.unit;
        if (fields.minQty != null) item.minQty = Number(fields.minQty) || 0;
        if (fields.buyPrice != null) item.buyPrice = Number(fields.buyPrice) || 0;
        if (fields.sellPrice != null) item.sellPrice = Number(fields.sellPrice) || 0;
        if (fields.qty != null) item.qty = Number(fields.qty) || 0;
        this.save();
    }

    adjustStock(id, delta, note = '') {
        const item = this.data.stock.find(s => s.id == id);
        if (!item) return false;
        const next = (Number(item.qty) || 0) + Number(delta);
        if (next < 0) return false;
        item.qty = next;
        item.lastMove = { delta: Number(delta), note: note || '', date: nowStamp() };
        this.save();
        return true;
    }

    deleteStockItem(id) {
        if (!Array.isArray(this.data.stock)) return;
        const index = this.data.stock.findIndex(s => s.id == id);
        if (index === -1) return;
        const item = this.data.stock.splice(index, 1)[0];
        this.data.trash.push({
            id: Date.now().toString(),
            originalId: item.id,
            type: 'stock',
            data: item,
            deletedAt: new Date().toISOString()
        });
        this.save();
    }

    addBill({ customerId, date, items, note, entryNo, containerNo, vehicleNo, containerGroupId, skipSave }) {
        if (!Array.isArray(this.data.bills)) this.data.bills = [];
        if (!this.data.settings.nextBillNo) this.data.settings.nextBillNo = 1;
        const customer = this.data.customers.find(c => c.id == customerId);
        if (!customer) return null;

        const cleanItems = (items || []).map(item => {
            const name = String(item.name || item.description || '').trim();
            const unit = normalizeBillUnit(item.unit);
            const ctns = Number(item.ctns) || 0;
            const qty = Number(item.qty) || Number(item.weight) || 0;
            const rate = Number(item.rate ?? item.perKg) || 0;
            const amount = billLineAmount({ name, unit, ctns, qty, rate, weight: qty });
            if (!name || amount <= 0) return null;
            const stock = (this.data.stock || []).find(s => String(s.name).toLowerCase() === name.toLowerCase());
            return {
                name,
                unit,
                ctns,
                qty,
                weight: unit === 'kg' ? qty : 0,
                rate,
                perKg: unit === 'kg' ? rate : 0,
                amount,
                stockId: stock?.id || '',
                stockOut: 0
            };
        }).filter(Boolean);

        const total = cleanItems.reduce((sum, item) => sum + item.amount, 0);
        if (total <= 0) return null;

        cleanItems.forEach(item => {
            if (!item.stockId) return;
            const stock = this.data.stock.find(s => s.id == item.stockId);
            if (!stock) return;
            const take = item.qty || item.weight || item.ctns;
            const next = (Number(stock.qty) || 0) - take;
            if (next < 0) return;
            stock.qty = next;
            item.stockOut = take;
        });

        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const billNo = this.data.settings.nextBillNo++;
        const dateISO = dateToISO(date);
        const summary = cleanItems.slice(0, 3).map(i => i.name).join(', ');
        const entryNoText = String(entryNo || '').trim();
        const containerText = String(containerNo || '').trim();
        const vehicleText = String(vehicleNo || '').trim();
        const khataEntryId = `${id}-khata`;
        const extra = [entryNoText && `B/E ${entryNoText}`, containerText && `Cont ${containerText}`].filter(Boolean).join(' · ');
        customer.transactions.push({
            id: khataEntryId,
            amount: total,
            type: 'credit',
            description: `Bill #${billNo}${summary ? ` — ${summary}` : ''}${extra ? ` (${extra})` : ''}`,
            date: dateISO,
            linkedBillId: id
        });
        customer.balance += total;

        const bill = {
            id,
            billNo,
            customerId,
            date: dateISO,
            items: cleanItems,
            total,
            note: String(note || '').trim(),
            entryNo: entryNoText,
            containerNo: containerText,
            vehicleNo: vehicleText,
            khataEntryId,
            containerGroupId: String(containerGroupId || '').trim(),
            createdAt: nowStamp()
        };
        this.data.bills.push(bill);
        this.postBillToRooznamcha(bill);
        if (!skipSave) this.save();
        return bill;
    }

    deleteBill(id) {
        if (!Array.isArray(this.data.bills)) return;
        const index = this.data.bills.findIndex(b => b.id == id);
        if (index === -1) return;
        const bill = this.data.bills.splice(index, 1)[0];
        this.removeBillFromKhata(bill);
        this.restoreBillStock(bill);
        this.removeBillFromRooznamcha(bill);
        this.data.trash.push({
            id: Date.now().toString(),
            originalId: bill.id,
            type: 'bill',
            data: bill,
            deletedAt: new Date().toISOString()
        });
        this.save();
    }

    removeBillFromKhata(bill) {
        const customer = this.data.customers.find(c => c.id == bill.customerId);
        if (!customer || !Array.isArray(customer.transactions)) return;
        const i = customer.transactions.findIndex(t => t.linkedBillId == bill.id || t.id == bill.khataEntryId);
        if (i === -1) return;
        const entry = customer.transactions[i];
        customer.balance -= (entry.type === 'credit' ? entry.amount : -entry.amount);
        customer.transactions.splice(i, 1);
    }

    restoreBillStock(bill) {
        (bill.items || []).forEach(item => {
            if (!item.stockId || !item.stockOut) return;
            const stock = (this.data.stock || []).find(s => s.id == item.stockId);
            if (stock) stock.qty = (Number(stock.qty) || 0) + Number(item.stockOut);
        });
    }

    restoreBillRecord(bill) {
        if (!Array.isArray(this.data.bills)) this.data.bills = [];
        if (this.data.bills.some(b => b.id == bill.id)) return;
        const customer = this.data.customers.find(c => c.id == bill.customerId);
        if (customer && !customer.transactions.some(t => t.linkedBillId == bill.id)) {
            customer.transactions.push({
                id: bill.khataEntryId || `${bill.id}-khata`,
                amount: Number(bill.total) || 0,
                type: 'credit',
                description: `Bill #${bill.billNo}`,
                date: bill.date,
                linkedBillId: bill.id
            });
            customer.balance += Number(bill.total) || 0;
        }
        (bill.items || []).forEach(item => {
            if (!item.stockId || !item.stockOut) return;
            const stock = (this.data.stock || []).find(s => s.id == item.stockId);
            if (!stock) return;
            const next = (Number(stock.qty) || 0) - Number(item.stockOut);
            stock.qty = next < 0 ? 0 : next;
        });
        this.data.bills.push(bill);
        this.postBillToRooznamcha(bill);
    }

    postBillToRooznamcha(bill) {
        if (!bill) return;
        if (!Array.isArray(this.data.rooznamcha)) this.data.rooznamcha = [];
        const customer = this.data.customers.find(c => c.id == bill.customerId);
        const summary = (bill.items || []).slice(0, 3).map(i => i.name).filter(Boolean).join(', ');
        const extra = [bill.entryNo && `B/E ${bill.entryNo}`, bill.containerNo && `Cont ${bill.containerNo}`].filter(Boolean).join(' · ');
        const description = `Bill #${bill.billNo}${customer ? ` — ${customer.name}` : ''}${summary ? ` — ${summary}` : ''}${extra ? ` (${extra})` : ''}`;
        const existing = this.data.rooznamcha.find(r => r.linkedBillId == bill.id || r.id == bill.rooznamchaId);
        if (existing) {
            existing.amount = Number(bill.total) || 0;
            existing.type = 'bill';
            existing.category = 'Bill';
            existing.description = description;
            existing.date = bill.date;
            existing.customerId = bill.customerId;
            existing.linkedBillId = bill.id;
            bill.rooznamchaId = existing.id;
            return;
        }
        const entry = {
            id: `${bill.id}-rooz`,
            transactionNo: this.data.settings.nextTransactionNo++,
            pageNo: Math.floor(this.data.rooznamcha.length / 20) + 1,
            amount: Number(bill.total) || 0,
            type: 'bill',
            category: 'Bill',
            description,
            date: bill.date,
            customerId: bill.customerId,
            linkedBillId: bill.id
        };
        this.data.rooznamcha.push(entry);
        bill.rooznamchaId = entry.id;
    }

    removeBillFromRooznamcha(bill) {
        if (!bill || !Array.isArray(this.data.rooznamcha)) return;
        this.data.rooznamcha = this.data.rooznamcha.filter(r => r.linkedBillId != bill.id && r.id != bill.rooznamchaId);
    }

    ensureBillRooznamcha() {
        let added = false;
        (this.data.bills || []).forEach(bill => {
            const exists = (this.data.rooznamcha || []).some(r => r.linkedBillId == bill.id || r.id == bill.rooznamchaId);
            if (exists) return;
            this.postBillToRooznamcha(bill);
            added = true;
        });
        return added;
    }

    updateBill(id, { customerId, date, items, note, entryNo, containerNo, vehicleNo }) {
        const bill = (this.data.bills || []).find(b => b.id == id);
        if (!bill) return null;
        const customer = this.data.customers.find(c => c.id == customerId);
        if (!customer) return null;

        const cleanItems = (items || []).map(item => {
            const name = String(item.name || item.description || '').trim();
            const unit = normalizeBillUnit(item.unit);
            const ctns = Number(item.ctns) || 0;
            const qty = Number(item.qty) || Number(item.weight) || 0;
            const rate = Number(item.rate ?? item.perKg) || 0;
            const amount = billLineAmount({ name, unit, ctns, qty, rate, weight: qty });
            if (!name || amount <= 0) return null;
            const stock = (this.data.stock || []).find(s => String(s.name).toLowerCase() === name.toLowerCase());
            return {
                name,
                unit,
                ctns,
                qty,
                weight: unit === 'kg' ? qty : 0,
                rate,
                perKg: unit === 'kg' ? rate : 0,
                amount,
                stockId: stock?.id || '',
                stockOut: 0
            };
        }).filter(Boolean);

        const total = cleanItems.reduce((sum, item) => sum + item.amount, 0);
        if (total <= 0) return null;

        this.removeBillFromKhata(bill);
        this.restoreBillStock(bill);

        cleanItems.forEach(item => {
            if (!item.stockId) return;
            const stock = this.data.stock.find(s => s.id == item.stockId);
            if (!stock) return;
            const take = item.qty || item.weight || item.ctns;
            const next = (Number(stock.qty) || 0) - take;
            if (next < 0) return;
            stock.qty = next;
            item.stockOut = take;
        });

        const dateISO = dateToISO(date);
        const summary = cleanItems.slice(0, 3).map(i => i.name).join(', ');
        const entryNoText = String(entryNo || '').trim();
        const containerText = String(containerNo || '').trim();
        const vehicleText = String(vehicleNo || '').trim();
        const extra = [entryNoText && `B/E ${entryNoText}`, containerText && `Cont ${containerText}`].filter(Boolean).join(' · ');
        const khataEntryId = bill.khataEntryId || `${bill.id}-khata`;
        customer.transactions.push({
            id: khataEntryId,
            amount: total,
            type: 'credit',
            description: `Bill #${bill.billNo}${summary ? ` — ${summary}` : ''}${extra ? ` (${extra})` : ''}`,
            date: dateISO,
            linkedBillId: bill.id
        });
        customer.balance += total;

        bill.customerId = customerId;
        bill.date = dateISO;
        bill.items = cleanItems;
        bill.total = total;
        bill.note = String(note || '').trim();
        bill.entryNo = entryNoText;
        bill.containerNo = containerText;
        bill.vehicleNo = vehicleText;
        bill.khataEntryId = khataEntryId;
        this.postBillToRooznamcha(bill);
        this.save();
        return bill;
    }

    getBillStats() {
        const list = Array.isArray(this.data.bills) ? this.data.bills : [];
        const total = list.reduce((sum, bill) => sum + (Number(bill.total) || 0), 0);
        return { count: list.length, total };
    }

    getStockStats() {
        const list = Array.isArray(this.data.stock) ? this.data.stock : [];
        let value = 0;
        let low = 0;
        let out = 0;
        list.forEach(item => {
            const qty = Number(item.qty) || 0;
            const minQty = Number(item.minQty) || 0;
            const buy = Number(item.buyPrice) || 0;
            value += qty * buy;
            if (qty <= 0) out += 1;
            else if (minQty > 0 && qty <= minQty) low += 1;
        });
        return { count: list.length, value, low, out };
    }

    // Calculations
    getStats() {
        const totalReceivables = this.data.customers.reduce((sum, c) => sum + (c.balance > 0 ? c.balance : 0), 0);
        const totalPayables = this.data.customers.reduce((sum, c) => sum + (c.balance < 0 ? Math.abs(c.balance) : 0), 0);
        
        let cashInHand = Number(this.data.settings.openingCash) || 0;
        this.data.rooznamcha.forEach(entry => {
            const amount = Number(entry.amount) || 0;
            if (entry.type === 'income') cashInHand += amount;
            else if (entry.type === 'expense') cashInHand -= amount;
        });
        return { totalReceivables, totalPayables, cashInHand };
    }

    getTodayStats() {
        const today = localISODate();
        return this.getFilteredStats(today, today);
    }

    getFilteredStats(startDate, endDate) {
        let income = 0;
        let expense = 0;
        
        this.data.rooznamcha.forEach(entry => {
            const entryDate = entryLocalDate(entry.date);
            if ((!startDate || entryDate >= startDate) && (!endDate || entryDate <= endDate)) {
                if (entry.type === 'income') income += Number(entry.amount) || 0;
                else if (entry.type === 'expense') expense += Number(entry.amount) || 0;
            }
        });
        
        return { income, expense, net: income - expense };
    }

    getFilteredRooznamcha(dateFilter) {
        const list = [...this.data.rooznamcha].reverse();
        if (!dateFilter) return list;
        return list.filter(entry => entryLocalDate(entry.date) === dateFilter);
    }

    getRangeRooznamcha(startDate, endDate) {
        return this.data.rooznamcha.filter(entry => {
            const entryDate = entryLocalDate(entry.date);
            if (startDate && entryDate < startDate) return false;
            if (endDate && entryDate > endDate) return false;
            return true;
        }).slice().reverse();
    }

    getCustomerLedger(customerId) {
        const customer = this.data.customers.find(c => c.id == customerId);
        if (!customer) return [];
        return customer.transactions;
    }

    // Deletion & Undo
    updateCustomer(id, name, phone, role) {
        const customer = this.data.customers.find(c => c.id == id);
        if (customer) {
            customer.name = name;
            customer.phone = phone || '';
            if (role === 'supplier' || role === 'customer') customer.role = role;
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

    updateSettings(shopName, currency, language, openingCash) {
        this.data.settings.shopName = shopName;
        this.data.settings.currency = currency;
        this.data.settings.language = language;
        this.data.settings.openingCash = Number(openingCash) || 0;
        this.save();
        this.applyLanguage();
    }

    applyLanguage() {
        const lang = this.data.settings.language || 'en';
        const t = translations[lang];
        
        // Update Sidebar + bottom nav
        const setNavText = (view, text) => {
            document.querySelectorAll(`.nav-link[data-view="${view}"] span`).forEach(el => { el.innerText = text; });
        };
        setNavText('dashboard', t.dashboard);
        setNavText('khata', t.khata);
        setNavText('rooznamcha', t.rooznamcha);
        setNavText('reports', t.reports);
        setNavText('stock', t.stock || 'Stock');
        setNavText('bills', t.bills || 'Bills');
        setNavText('settings', t.settings);
        setNavText('trash', t.trash);

        const setBottomText = (view, text) => {
            document.querySelectorAll(`.bottom-nav-item[data-view="${view}"] span`).forEach(el => { el.innerText = text; });
        };
        setBottomText('dashboard', t.home || 'Home');
        setBottomText('khata', t.khataShort || 'Khata');
        setBottomText('bills', t.bills || 'Bills');
        setBottomText('rooznamcha', t.dailyShort || t.rooznamcha);
        const menuSpan = document.querySelector('#btn-bottom-menu span');
        if (menuSpan) menuSpan.innerText = t.menu || 'Menu';

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
        if (confirm('Delete ALL parties and Daily Book entries? Dashboard totals will become 0. This cannot be undone.')) {
            this.data = {
                customers: [],
                rooznamcha: [],
                stock: [],
                bills: [],
                trash: [],
                settings: {
                    shopName: this.data.settings.shopName || 'My Business',
                    currency: this.data.settings.currency || 'Rs.',
                    language: this.data.settings.language || 'en',
                    backupFolderPath: null,
                    nextKhataNo: 1,
                    nextTransactionNo: 1001,
                    nextBillNo: 1,
                    openingCash: 0
                }
            };
            this.undoStack = [];
            this.redoStack = [];
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

    exportToCSV(startDate = '', endDate = '') {
        const rows = [
            ['Date', 'Type', 'Category', 'Description', 'Amount', 'Customer', 'Transaction No']
        ];

        const list = (startDate || endDate)
            ? this.getRangeRooznamcha(startDate, endDate)
            : [...this.data.rooznamcha];

        list.forEach(t => {
            const customer = t.customerId ? this.data.customers.find(c => c.id === t.customerId) : null;
            rows.push([
                new Date(t.date).toLocaleString(),
                (t.type || '').toUpperCase(),
                t.category,
                t.description || '',
                t.amount,
                customer ? customer.name : 'Cash',
                t.transactionNo || ''
            ]);
        });

        const csvContent = "data:text/csv;charset=utf-8,"
            + rows.map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        const stamp = startDate || endDate
            ? `${startDate || 'start'}_${endDate || 'today'}`
            : localISODate();
        link.setAttribute("download", `khata_report_${stamp}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast(list.length ? `Excel downloaded (${list.length} entries)` : 'Excel downloaded (no entries in this period)', 'success');
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
                nextTransactionNo: 1001,
                nextBillNo: 1,
                openingCash: 0
            };

            this.data = {
                customers: imported.customers,
                rooznamcha: imported.rooznamcha,
                stock: Array.isArray(imported.stock) ? imported.stock : [],
                bills: Array.isArray(imported.bills) ? imported.bills : [],
                trash: Array.isArray(imported.trash) ? imported.trash : [],
                settings: { ...defaults, ...(imported.settings || {}) }
            };
            if (!this.data.settings.nextKhataNo) this.data.settings.nextKhataNo = 1;
            if (!this.data.settings.nextTransactionNo) this.data.settings.nextTransactionNo = 1001;
            if (!this.data.settings.nextBillNo) this.data.settings.nextBillNo = 1;
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

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatDisplayDate(value) {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatAmount(amount) {
    return Number(amount || 0).toLocaleString();
}

function balanceWords(balance, name = '') {
    if (balance > 0) return name ? `Banam — ${name} has to pay you` : 'Banam — they have to pay you';
    if (balance < 0) return name ? `Jama — you have to pay ${name}` : 'Jama — you have to pay them';
    return 'Account is clear';
}

function balanceHint(balance) {
    if (balance > 0) return 'Banam';
    if (balance < 0) return 'Jama';
    return 'Clear';
}

function banamJamaStatus(balance) {
    if (balance > 0) return 'Banam';
    if (balance < 0) return 'Jama';
    return 'Clear';
}

function statementResult(model) {
    const { closing, customer, currency } = model;
    const amount = `${currency} ${formatAmount(Math.abs(closing))}`;
    if (closing > 0) {
        return {
            tone: 'due',
            label: `Banam — pending from ${customer.name}`,
            amount,
            explain: `${customer.name} has to pay you (Banam).`
        };
    }
    if (closing < 0) {
        return {
            tone: 'pay',
            label: `Jama — you have to pay ${customer.name}`,
            amount,
            explain: `You have to pay ${customer.name} (Jama).`
        };
    }
    return {
        tone: 'clear',
        label: 'Account is clear',
        amount,
        explain: 'Nothing is pending on this khata.'
    };
}

function getLedgerStatementModel(customerId) {
    const customer = db.data.customers.find(c => c.id == customerId);
    if (!customer) return null;
    const currency = db.data.settings.currency || 'Rs.';
    const shopName = db.data.settings.shopName || 'My Business';
    const ledger = [...(db.getCustomerLedger(customerId) || [])].sort((a, b) => {
        const da = new Date(a.date).getTime();
        const dbTime = new Date(b.date).getTime();
        if (da !== dbTime) return da - dbTime;
        return String(a.id).localeCompare(String(b.id));
    });
    let runningBalance = 0;
    let totalGave = 0;
    let totalGot = 0;
    const rows = ledger.map(t => {
        const isGave = t.type === 'credit';
        const amount = Number(t.amount) || 0;
        if (isGave) totalGave += amount;
        else totalGot += amount;
        runningBalance += isGave ? amount : -amount;
        const original = t.linkedRooznamchaId
            ? db.data.rooznamcha.find(r => r.id == t.linkedRooznamchaId)
            : null;
        return {
            date: formatDisplayDate(t.date),
            ref: original?.transactionNo ? String(original.transactionNo) : '',
            description: String(t.description || 'No details').replace(/^\[Rooznamcha\]\s*/i, ''),
            gave: isGave ? amount : 0,
            got: isGave ? 0 : amount,
            kind: isGave ? 'gave' : 'got',
            kindLabel: t.linkedBillId ? 'Bill' : (isGave ? 'Banam' : 'Jama'),
            balance: runningBalance,
            hint: balanceHint(runningBalance)
        };
    });
    const closing = rows.length ? rows[rows.length - 1].balance : 0;
    const period = rows.length
        ? `${rows[0].date} – ${rows[rows.length - 1].date}`
        : formatDisplayDate(new Date());
    return {
        customer,
        currency,
        shopName,
        rows,
        totalGave,
        totalGot,
        closing,
        period
    };
}

function buildLedgerText(customerId, maxRows = 0) {
    const model = getLedgerStatementModel(customerId);
    if (!model) return '';
    const { customer, currency, shopName, rows, totalGave, totalGot, period } = model;
    const result = statementResult(model);
    const shown = maxRows > 0 && rows.length > maxRows ? rows.slice(-maxRows) : rows;
    const skipped = rows.length - shown.length;
    const lines = [
        `Account Statement — ${shopName}`,
        `Customer: ${customer.name}`,
        `Khata No: ${customer.khataNo}${customer.phone ? `  |  Phone: ${customer.phone}` : ''}`,
        `Period: ${period}`,
        '',
        `${result.label}: ${result.amount}`,
        result.explain,
        ''
    ];
    if (skipped > 0) lines.push(`(...${skipped} earlier entries)`);
    shown.forEach(row => {
        const money = formatAmount(row.gave || row.got);
        lines.push(`${row.date}  ${row.kindLabel} ${currency} ${money}  — ${row.description}`);
        lines.push(`   Balance: ${currency} ${formatAmount(Math.abs(row.balance))} (${row.hint})`);
    });
    if (!rows.length) lines.push('No transactions on this account yet.');
    lines.push('');
    lines.push(`Total Banam: ${currency} ${formatAmount(totalGave)}`);
    lines.push(`Total Jama: ${currency} ${formatAmount(totalGot)}`);
    lines.push(`${result.label}: ${result.amount}`);
    return lines.join('\n');
}

function localISODate(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function entryLocalDate(value) {
    if (!value) return '';
    const s = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const parsed = new Date(s);
    if (!Number.isNaN(parsed.getTime())) return localISODate(parsed);
    const part = s.split('T')[0];
    return /^\d{4}-\d{2}-\d{2}$/.test(part) ? part : '';
}

function nowStamp() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${localISODate(d)}T${hh}:${mm}:${ss}`;
}

function weekdayFromKey(key) {
    const [y, m, day] = String(key).split('-').map(Number);
    if (!y || !m || !day) return '';
    return new Date(y, m - 1, day).toLocaleDateString(undefined, { weekday: 'short' });
}

function partyRole(party) {
    return party?.role === 'supplier' ? 'supplier' : 'customer';
}

function partyRoleLabel(party) {
    return partyRole(party) === 'supplier' ? 'Supplier' : 'Customer';
}

function dateToISO(dateValue) {
    if (!dateValue) return nowStamp();
    if (String(dateValue).includes('T')) return dateValue;
    return `${dateValue}T12:00:00`;
}

function getCashTrendPercent() {
    const today = new Date();
    let current = 0;
    let previous = 0;
    for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = localISODate(d);
        current += db.getFilteredStats(key, key).net;
    }
    for (let i = 7; i < 14; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = localISODate(d);
        previous += db.getFilteredStats(key, key).net;
    }
    if (previous === 0) return null;
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
let khataPartyFilter = 'all';
let stockFilter = 'all';
let roozRangeMode = 'day';

async function initApp() {
    applySiteConfig();
    setupNavigation();
    setupThemeToggle();
    setupMobileNav();
    setupMobileFab();
    setupVoiceEntry();
    setupModalHandlers();
    setupFilterHandlers();
    setupPrintPreview();
    setupSearchHandlers();
    setupSettingsHandlers();
    updateProfileDisplay();
    const versionEl = document.getElementById('app-version');
    if (versionEl) versionEl.textContent = `v${APP_VERSION}`;
    initCharts();
    db.applyLanguage();
    const todayStr = localISODate();
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
        return localISODate(d);
    });

    const incomeData = last7Days.map(date => db.getFilteredStats(date, date).income);
    const expenseData = last7Days.map(date => db.getFilteredStats(date, date).expense);

    cashflowChart.data.labels = last7Days.map(weekdayFromKey);
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
    const cashSlice = Math.max(0, Number(stats.cashInHand) || 0);
    const recSlice = Math.max(0, Number(stats.totalReceivables) || 0);
    const paySlice = Math.max(0, Number(stats.totalPayables) || 0);
    distributionChart.data.labels = ['Cash', 'Receivables', 'Payables'];
    distributionChart.data.datasets = [{
        data: [cashSlice, recSlice, paySlice],
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
    const openingCashInput = document.getElementById('setting-opening-cash');
    const resetBtn = document.getElementById('btn-reset-data');

    if (shopNameInput) shopNameInput.value = db.data.settings.shopName || 'My Business';
    if (currencyInput) currencyInput.value = db.data.settings.currency || 'Rs.';
    if (languageInput) languageInput.value = db.data.settings.language || 'en';
    if (openingCashInput) openingCashInput.value = db.data.settings.openingCash ?? 0;

    settingsForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        db.updateSettings(shopNameInput.value, currencyInput.value, languageInput.value, openingCashInput?.value);
        updateProfileDisplay();
        showToast('Settings saved successfully!', 'success');
        updateUI();
    });

    resetBtn?.addEventListener('click', () => {
        db.resetData();
    });

    const openCashSettings = () => {
        switchView('settings');
        requestAnimationFrame(() => document.getElementById('setting-opening-cash')?.focus());
    };
    const cashCard = document.getElementById('card-cash-in-hand');
    cashCard?.addEventListener('click', openCashSettings);
    cashCard?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openCashSettings();
        }
    });

    if (window.AccountCloud) AccountCloud.updateAccountWidgets();
}

function filterPartyList(query) {
    const q = (query || '').toLowerCase();
    document.querySelectorAll('#customers-list .party-item').forEach(row => {
        row.style.display = !q || row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
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
            filterPartyList(query);
        }
        filterStockList(query);
        
        console.log(`Global search for: ${query}`, { customers: filteredCustomers.length, transactions: filteredTransactions.length });
    });

    customerSearch?.addEventListener('input', (e) => {
        filterPartyList(e.target.value.toLowerCase());
    });

    document.getElementById('khata-filters')?.addEventListener('click', (e) => {
        const chip = e.target.closest('[data-khata-filter]');
        if (!chip) return;
        khataPartyFilter = chip.dataset.khataFilter || 'all';
        document.querySelectorAll('#khata-filters [data-khata-filter]').forEach(btn => {
            btn.classList.toggle('active', btn === chip);
        });
        updateCustomerLists();
        const query = document.getElementById('customer-search')?.value?.toLowerCase();
        if (query) filterPartyList(query);
    });

    document.getElementById('stock-search')?.addEventListener('input', (e) => {
        filterStockList(e.target.value.toLowerCase());
    });

    document.getElementById('bills-search')?.addEventListener('input', (e) => {
        filterBillsList(e.target.value.toLowerCase());
    });

    document.getElementById('stock-filters')?.addEventListener('click', (e) => {
        const chip = e.target.closest('[data-stock-filter]');
        if (!chip) return;
        stockFilter = chip.dataset.stockFilter || 'all';
        document.querySelectorAll('#stock-filters [data-stock-filter]').forEach(btn => {
            btn.classList.toggle('active', btn === chip);
        });
        updateStockList();
        const query = document.getElementById('stock-search')?.value?.toLowerCase();
        if (query) filterStockList(query);
    });
}

/**
 * Filter Management
 */
function getReportDateRange() {
    return {
        start: document.getElementById('report-start-date')?.value || '',
        end: document.getElementById('report-end-date')?.value || ''
    };
}

function formatReportRangeLabel(start, end, preset) {
    if (preset === 'today') return 'Today';
    if (preset === 'week') return 'Last 7 days';
    if (preset === 'month') return 'This month';
    if (preset === 'year') return 'This year';
    if (preset === 'all' || (!start && !end)) return 'All time';
    const nice = (iso) => iso ? new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    if (start && end) return `${nice(start)} – ${nice(end)}`;
    if (start) return `From ${nice(start)}`;
    if (end) return `Until ${nice(end)}`;
    return 'Selected period';
}

function applyReportPreset(preset) {
    const today = new Date();
    const startEl = document.getElementById('report-start-date');
    const endEl = document.getElementById('report-end-date');
    let start = '';
    let end = localISODate(today);

    if (preset === 'today') {
        start = end;
    } else if (preset === 'week') {
        const d = new Date(today);
        d.setDate(d.getDate() - 6);
        start = localISODate(d);
    } else if (preset === 'month') {
        start = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
    } else if (preset === 'year') {
        start = `${today.getFullYear()}-01-01`;
    } else if (preset === 'all') {
        start = '';
        end = '';
    }

    if (startEl) startEl.value = start;
    if (endEl) endEl.value = end;
    document.querySelectorAll('.preset-chip').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.preset === preset);
    });
    updateReportsPage(preset);
}

function updateReportsPage(preset) {
    const rangeLabel = document.getElementById('report-range-label');
    const catList = document.getElementById('report-category-list');
    const khataList = document.getElementById('report-khata-list');
    const entriesList = document.getElementById('report-entries-list');
    const countEl = document.getElementById('report-entry-count');
    if (!catList && !entriesList) return;

    const { start, end } = getReportDateRange();
    const activePreset = preset || document.querySelector('.preset-chip.active')?.dataset.preset || 'custom';
    if (rangeLabel) rangeLabel.textContent = formatReportRangeLabel(start, end, activePreset);

    const currency = db.data.settings.currency || 'Rs.';
    const stats = db.getFilteredStats(start, end);
    const entries = db.getRangeRooznamcha(start, end);

    const incomeEl = document.getElementById('report-filter-income');
    const expenseEl = document.getElementById('report-filter-expense');
    const netEl = document.getElementById('report-filter-net');
    if (incomeEl) incomeEl.textContent = formatMoney(stats.income, currency);
    if (expenseEl) expenseEl.textContent = formatMoney(stats.expense, currency);
    if (netEl) {
        netEl.textContent = formatMoney(stats.net, currency);
        netEl.className = `value ${stats.net >= 0 ? 'positive' : 'negative'}`;
    }
    if (countEl) countEl.textContent = `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`;

    const categories = {};
    entries.forEach(t => {
        if (t.type !== 'income' && t.type !== 'expense') return;
        const key = t.category || 'General';
        if (!categories[key]) categories[key] = { income: 0, expense: 0 };
        if (t.type === 'income') categories[key].income += t.amount;
        else categories[key].expense += t.amount;
    });
    const catRows = Object.entries(categories)
        .map(([name, v]) => ({ name, ...v, total: v.income + v.expense }))
        .sort((a, b) => b.total - a.total);

    if (catList) {
        catList.innerHTML = catRows.length === 0
            ? '<p class="empty-state">No entries in this period.</p>'
            : catRows.map(c => `
                <div class="report-cat-row">
                    <div class="report-cat-name">${c.name}</div>
                    <div class="report-cat-figures">
                        <span class="text-success">+ ${formatMoney(c.income, currency)}</span>
                        <span class="text-danger">- ${formatMoney(c.expense, currency)}</span>
                    </div>
                </div>
            `).join('');
    }

    const owing = [...db.data.customers]
        .filter(c => c.balance !== 0)
        .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
        .slice(0, 8);

    if (khataList) {
        khataList.innerHTML = owing.length === 0
            ? '<p class="empty-state">All khata balances are clear.</p>'
            : owing.map(c => `
                <div class="customer-item" data-id="${c.id}" role="button" tabindex="0">
                    <div class="cust-info">
                        <span class="cust-name">${c.name}</span>
                        <span class="cust-phone">${banamJamaStatus(c.balance)}</span>
                    </div>
                    <span class="cust-balance ${c.balance >= 0 ? 'plus' : 'minus'}">
                        ${formatMoney(Math.abs(c.balance), currency)}
                    </span>
                </div>
            `).join('');
    }

    if (entriesList) {
        entriesList.innerHTML = entries.length === 0
            ? '<p class="empty-state">No transactions in this period.</p>'
            : entries.map(t => {
                const customer = t.customerId ? db.data.customers.find(c => c.id === t.customerId) : null;
                const when = new Date(t.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
                const meta = roozRowMeta(t);
                return `
                    <button type="button" class="report-entry ${meta.kind}" data-id="${t.id}">
                        <div class="report-entry-main">
                            <strong>${t.description || t.category || 'Entry'}</strong>
                            <small>${when}${customer ? ` · ${customer.name}` : ''} · ${t.category || ''}</small>
                        </div>
                        <span class="${meta.amountClass}">
                            ${meta.sign ? `${meta.sign} ` : ''}${formatMoney(t.amount, currency)}
                        </span>
                    </button>
                `;
            }).join('');
    }
}

function printPartyChip(customer) {
    if (!customer) return '<span class="print-cash-tag">Cash</span>';
    return `<span class="print-khata-no">#${escapeHtml(customer.khataNo)}</span><span class="print-party-name">${escapeHtml(customer.name)}</span>`;
}

function printReportRow(transaction) {
    const customer = transaction.customerId
        ? db.data.customers.find(c => c.id === transaction.customerId)
        : null;
    const remarks = escapeHtml(transaction.description || transaction.category || '');
    const amountClass = transaction.type === 'expense' ? 'text-danger' : 'text-success';
    return `
        <tr>
            <td class="print-ref">${escapeHtml(transaction.transactionNo || '')}</td>
            <td>
                <div class="print-party-line">${customer ? printPartyChip(customer) : '<span class="print-cash-tag">Cash</span>'}</div>
                ${remarks ? `<div class="print-remarks">${remarks}</div>` : ''}
            </td>
            <td class="text-right print-amt ${amountClass}">${Number(transaction.amount || 0).toLocaleString()}</td>
        </tr>
    `;
}

function setupPrintPreview() {
    document.getElementById('btn-print-preview-close')?.addEventListener('click', closePrintPreview);
    document.getElementById('btn-print-preview-print')?.addEventListener('click', runPrintFromPreview);
}

function showPrintPreview(html, title, hint) {
    const overlay = document.getElementById('print-preview-overlay');
    const container = document.getElementById('ledger-print-container');
    const titleEl = document.getElementById('print-preview-title');
    const hintEl = document.getElementById('print-preview-hint');
    if (!overlay || !container) return;
    container.innerHTML = html;
    if (titleEl) titleEl.textContent = title || 'Print Preview';
    if (hintEl) hintEl.textContent = hint || 'Check, then tap Print';
    overlay.hidden = false;
    document.body.classList.add('print-preview-open');
    overlay.querySelector('.print-preview-scroll')?.scrollTo({ top: 0 });
}

function closePrintPreview() {
    const overlay = document.getElementById('print-preview-overlay');
    const container = document.getElementById('ledger-print-container');
    if (overlay) overlay.hidden = true;
    if (container) container.innerHTML = '';
    document.body.classList.remove('print-preview-open', 'printing-report');
}

function runPrintFromPreview() {
    const container = document.getElementById('ledger-print-container');
    if (!container?.innerHTML.trim()) return;
    document.body.classList.add('printing-report');
    const cleanup = () => document.body.classList.remove('printing-report');
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
    setTimeout(cleanup, 2500);
}

function printFullReport() {
    const { start, end } = getReportDateRange();
    const currency = db.data.settings.currency || 'Rs.';
    const shopName = db.data.settings.shopName || 'KhataBook Pro';
    const periodStats = db.getFilteredStats(start, end);
    const account = db.getStats();
    const entries = db.getRangeRooznamcha(start, end);
    const preset = document.querySelector('.preset-chip.active')?.dataset.preset;
    const periodLabel = formatReportRangeLabel(start, end, preset);
    const incomeEntries = entries.filter(t => t.type === 'income');
    const expenseEntries = entries.filter(t => t.type === 'expense');

    const html = `
        <div class="print-report strong-report">
            <div class="print-header">
                <h1>${escapeHtml(shopName)}</h1>
                <h2>Business Report</h2>
                <p>${escapeHtml(periodLabel)}</p>
            </div>
            <div class="print-summary-strong">
                <div class="summary-box">
                    <div class="summary-row"><span>Pending from customers</span><span class="text-success">${formatMoney(account.totalReceivables, currency)}</span></div>
                    <div class="summary-row"><span>You have to pay</span><span class="text-danger">${formatMoney(account.totalPayables, currency)}</span></div>
                    <div class="summary-row"><span>Cash in hand</span><span>${formatMoney(account.cashInHand, currency)}</span></div>
                    <div class="summary-row"><span>Period cash in</span><span class="text-success">${formatMoney(periodStats.income, currency)}</span></div>
                    <div class="summary-row"><span>Period cash out</span><span class="text-danger">${formatMoney(periodStats.expense, currency)}</span></div>
                    <div class="summary-row net-row"><span>Period net</span><span class="${periodStats.net >= 0 ? 'text-success' : 'text-danger'}">${formatMoney(periodStats.net, currency)}</span></div>
                </div>
            </div>
            <div class="print-columns">
                <div class="print-column">
                    <div class="column-header income-header">Cash In <span class="print-count">${incomeEntries.length}</span></div>
                    <table class="print-table compact">
                        <thead><tr><th>No</th><th>Details</th><th class="text-right">Amount</th></tr></thead>
                        <tbody>
                            ${incomeEntries.length ? incomeEntries.map(printReportRow).join('') : '<tr><td colspan="3" class="text-center empty-cell">No income</td></tr>'}
                        </tbody>
                        <tfoot><tr class="total-row"><td colspan="2">Total cash in</td><td class="text-right">${periodStats.income.toLocaleString()}</td></tr></tfoot>
                    </table>
                </div>
                <div class="print-column">
                    <div class="column-header expense-header">Cash Out <span class="print-count">${expenseEntries.length}</span></div>
                    <table class="print-table compact">
                        <thead><tr><th>No</th><th>Details</th><th class="text-right">Amount</th></tr></thead>
                        <tbody>
                            ${expenseEntries.length ? expenseEntries.map(printReportRow).join('') : '<tr><td colspan="3" class="text-center empty-cell">No expense</td></tr>'}
                        </tbody>
                        <tfoot><tr class="total-row"><td colspan="2">Total cash out</td><td class="text-right">${periodStats.expense.toLocaleString()}</td></tr></tfoot>
                    </table>
                </div>
            </div>
            <div class="print-footer-strong">
                <div class="footer-sign">Signature</div>
                <div class="footer-time">Printed ${escapeHtml(new Date().toLocaleString())}</div>
            </div>
        </div>
    `;

    showPrintPreview(html, 'Business Report');
}

function getRoozViewFilter(passed) {
    if (roozRangeMode === 'all') return null;
    if (passed) return passed;
    return document.getElementById('rooznamcha-date-filter')?.value || localISODate();
}

function syncRoozRangeButtons() {
    const dateEl = document.getElementById('rooznamcha-date-filter');
    const isAll = roozRangeMode === 'all';
    const isToday = !isAll && dateEl?.value === localISODate();
    document.querySelector('[data-rooz-range="day"]')?.classList.toggle('active', isToday);
    document.querySelector('[data-rooz-range="all"]')?.classList.toggle('active', isAll);
    if (dateEl) dateEl.disabled = isAll;
}

function setRoozRangeMode(mode) {
    roozRangeMode = mode === 'all' ? 'all' : 'day';
    const dateEl = document.getElementById('rooznamcha-date-filter');
    if (roozRangeMode === 'day' && dateEl) dateEl.value = localISODate();
    syncRoozRangeButtons();
    updateUI(getRoozViewFilter());
}

function setupFilterHandlers() {
    const roozDateFilter = document.getElementById('rooznamcha-date-filter');
    const reportStart = document.getElementById('report-start-date');
    const reportEnd = document.getElementById('report-end-date');

    roozDateFilter?.addEventListener('change', () => {
        roozRangeMode = 'day';
        syncRoozRangeButtons();
        updateUI(roozDateFilter.value);
    });

    document.querySelectorAll('[data-rooz-range]').forEach(btn => {
        btn.addEventListener('click', () => setRoozRangeMode(btn.dataset.roozRange));
    });

    const onCustomDates = () => {
        const start = reportStart?.value || '';
        const end = reportEnd?.value || '';
        if (start && end && start > end) {
            showToast('Start date must be before end date.', 'error');
            return;
        }
        document.querySelectorAll('.preset-chip').forEach(btn => btn.classList.remove('active'));
        updateReportsPage('custom');
    };
    reportStart?.addEventListener('change', onCustomDates);
    reportEnd?.addEventListener('change', onCustomDates);

    document.querySelectorAll('.preset-chip').forEach(btn => {
        btn.addEventListener('click', () => applyReportPreset(btn.dataset.preset));
    });

    document.getElementById('btn-print-full-report')?.addEventListener('click', printFullReport);
    document.getElementById('btn-report-open-khata')?.addEventListener('click', () => switchView('khata'));

    applyReportPreset('month');
}

function setupMobileNav() {
    const menuBtn = document.getElementById('btn-mobile-menu');
    const overlay = document.getElementById('sidebar-overlay');

    menuBtn?.addEventListener('click', () => {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar?.classList.contains('open')) closeSidebar();
        else openSidebar();
    });
    document.getElementById('btn-close-sidebar')?.addEventListener('click', closeSidebar);
    overlay?.addEventListener('click', closeSidebar);
    window.addEventListener('resize', () => {
        if (!isMobileApp()) {
            closeSidebar();
            closeFabMenu();
        }
    });

    if (window.visualViewport) {
        const onViewport = () => {
            const keyboardOpen = window.innerHeight - window.visualViewport.height > 140;
            document.body.classList.toggle('keyboard-open', keyboardOpen);
        };
        window.visualViewport.addEventListener('resize', onViewport);
        window.visualViewport.addEventListener('scroll', onViewport);
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (document.body.classList.contains('voice-open')) {
                closeVoiceEntry();
                return;
            }
            if (document.body.classList.contains('print-preview-open')) {
                closePrintPreview();
                return;
            }
            closeSidebar();
            closeFabMenu();
            closeModal();
        }
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
    const showingAll = !dateFilter;
    const allTransactions = db.getFilteredRooznamcha(dateFilter);
    const stats = showingAll
        ? db.getFilteredStats(null, null)
        : db.getFilteredStats(dateFilter, dateFilter);
    const currency = db.data.settings.currency || 'Rs.';
    const shopName = db.data.settings.shopName || 'KhataBook Pro';
    const incomeEntries = allTransactions.filter(t => t.type === 'income');
    const expenseEntries = allTransactions.filter(t => t.type === 'expense');
    const billEntries = allTransactions.filter(t => t.type === 'bill' || t.linkedBillId);
    const billTotal = billEntries.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const dateLabel = showingAll
        ? 'All transactions'
        : new Date(dateFilter).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

    const html = `
        <div class="print-report strong-report">
            <div class="print-header">
                <h1>${escapeHtml(shopName)}</h1>
                <h2>${showingAll ? 'All Transactions' : 'Daily Book'}</h2>
                <p>${escapeHtml(dateLabel)}</p>
            </div>
            <div class="invoice-kpis">
                <div><span>Cash in</span><strong class="text-success">${escapeHtml(currency)} ${stats.income.toLocaleString()}</strong></div>
                <div><span>Cash out</span><strong class="text-danger">${escapeHtml(currency)} ${stats.expense.toLocaleString()}</strong></div>
                <div><span>Bills Banam</span><strong>${escapeHtml(currency)} ${billTotal.toLocaleString()}</strong></div>
                <div><span>Cash net</span><strong class="${stats.net >= 0 ? 'text-success' : 'text-danger'}">${escapeHtml(currency)} ${stats.net.toLocaleString()}</strong></div>
            </div>
            <div class="print-columns">
                <div class="print-column">
                    <div class="column-header income-header">Cash In <span class="print-count">${incomeEntries.length}</span></div>
                    <table class="print-table compact">
                        <thead>
                            <tr>
                                <th>No</th>
                                <th>Details</th>
                                <th class="text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${incomeEntries.length ? incomeEntries.map(printReportRow).join('') : '<tr><td colspan="3" class="text-center empty-cell">No income</td></tr>'}
                        </tbody>
                        <tfoot>
                            <tr class="total-row">
                                <td colspan="2">Total cash in</td>
                                <td class="text-right">${stats.income.toLocaleString()}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <div class="print-column">
                    <div class="column-header expense-header">Cash Out <span class="print-count">${expenseEntries.length}</span></div>
                    <table class="print-table compact">
                        <thead>
                            <tr>
                                <th>No</th>
                                <th>Details</th>
                                <th class="text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${expenseEntries.length ? expenseEntries.map(printReportRow).join('') : '<tr><td colspan="3" class="text-center empty-cell">No expense</td></tr>'}
                        </tbody>
                        <tfoot>
                            <tr class="total-row">
                                <td colspan="2">Total cash out</td>
                                <td class="text-right">${stats.expense.toLocaleString()}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
            ${billEntries.length ? `
            <div class="print-columns" style="margin-top:1rem;">
                <div class="print-column">
                    <div class="column-header">Bills Banam <span class="print-count">${billEntries.length}</span></div>
                    <table class="print-table compact">
                        <thead>
                            <tr>
                                <th>No</th>
                                <th>Details</th>
                                <th class="text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${billEntries.map(printReportRow).join('')}
                        </tbody>
                        <tfoot>
                            <tr class="total-row">
                                <td colspan="2">Total billed Banam</td>
                                <td class="text-right">${billTotal.toLocaleString()}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>` : ''}
            <div class="print-summary-strong">
                <div class="summary-box">
                    <div class="summary-row">
                        <span>Total cash in</span>
                        <span class="text-success">${escapeHtml(currency)} ${stats.income.toLocaleString()}</span>
                    </div>
                    <div class="summary-row">
                        <span>Total cash out</span>
                        <span class="text-danger">${escapeHtml(currency)} ${stats.expense.toLocaleString()}</span>
                    </div>
                    <div class="summary-row net-row">
                        <span>Net cash</span>
                        <span class="${stats.net >= 0 ? 'text-success' : 'text-danger'}">${escapeHtml(currency)} ${stats.net.toLocaleString()}</span>
                    </div>
                    ${billEntries.length ? `<div class="summary-row"><span>Bills Banam</span><span>${escapeHtml(currency)} ${billTotal.toLocaleString()}</span></div>` : ''}
                </div>
            </div>
            <div class="print-footer-strong">
                <div class="footer-sign">Signature</div>
                <div class="footer-time">Printed ${escapeHtml(new Date().toLocaleString())}</div>
            </div>
        </div>
    `;

    showPrintPreview(html, showingAll ? 'All Transactions' : 'Daily Book', 'Cash in, cash out, and bill Banam — then Print');
}

function printLedgerStatement(customerId) {
    const model = getLedgerStatementModel(customerId);
    const container = document.getElementById('ledger-print-container');
    if (!model || !container) return;

    const { customer, currency, shopName, rows, totalGave, totalGot, closing, period } = model;
    const result = statementResult(model);
    const generated = new Date().toLocaleString();
    const closingAbs = formatAmount(Math.abs(closing));

    const rowHtml = rows.length
        ? rows.map((row, i) => `
            <tr class="${i % 2 ? 'alt' : ''}">
                <td>${escapeHtml(row.date)}</td>
                <td class="particulars">
                    <strong>${escapeHtml(row.kindLabel)}</strong>
                    ${row.ref ? `<span class="ref">#${escapeHtml(row.ref)}</span>` : ''}
                    <div>${escapeHtml(row.description)}</div>
                </td>
                <td class="num">${row.gave ? formatAmount(row.gave) : '—'}</td>
                <td class="num">${row.got ? formatAmount(row.got) : '—'}</td>
                <td class="num">
                    ${formatAmount(Math.abs(row.balance))}
                    <small>${escapeHtml(row.hint)}</small>
                </td>
            </tr>
        `).join('')
        : '<tr><td colspan="5" class="empty-cell">No transactions on this account yet.</td></tr>';

    const html = `
        <div class="print-report ledger-print-report">
            <div class="ledger-print-top">
                <div>
                    <div class="ledger-print-shop">${escapeHtml(shopName)}</div>
                    <div class="ledger-print-title">Account Statement</div>
                    <div class="ledger-print-period">From ${escapeHtml(period)}</div>
                </div>
                <div class="ledger-print-issued">
                    <div>Printed: ${escapeHtml(formatDisplayDate(new Date()))}</div>
                    <div class="print-khata-line">${printPartyChip(customer)}</div>
                </div>
            </div>
            <div class="ledger-print-party">
                <div>
                    <span>Customer</span>
                    <strong>${escapeHtml(customer.name)}</strong>
                    <em>${escapeHtml(customer.phone || '')}</em>
                </div>
                <div class="ledger-print-totals-mini">
                    <div><span>Banam</span><strong>${escapeHtml(currency)} ${formatAmount(totalGave)}</strong></div>
                    <div><span>Jama</span><strong>${escapeHtml(currency)} ${formatAmount(totalGot)}</strong></div>
                </div>
            </div>
            <div class="ledger-print-result ${result.tone}">
                <span>${escapeHtml(result.label)}</span>
                <strong>${escapeHtml(result.amount)}</strong>
                <em>${escapeHtml(result.explain)}</em>
            </div>
            <table class="ledger-print-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Details</th>
                        <th class="num">Banam</th>
                        <th class="num">Jama</th>
                        <th class="num">Balance</th>
                    </tr>
                </thead>
                <tbody>${rowHtml}</tbody>
                <tfoot>
                    <tr>
                        <td colspan="2">Total · ${escapeHtml(currency)}</td>
                        <td class="num">${formatAmount(totalGave)}</td>
                        <td class="num">${formatAmount(totalGot)}</td>
                        <td class="num">${closingAbs}</td>
                    </tr>
                </tfoot>
            </table>
            <p class="ledger-print-legend">Banam = you gave, they owe you. Jama = you received, they paid you.</p>
            <div class="ledger-print-signs">
                <div>
                    <div class="sign-line"></div>
                    <span>Customer signature</span>
                </div>
                <div>
                    <div class="sign-line"></div>
                    <span>Shop signature</span>
                </div>
                <div class="generated">Printed: ${escapeHtml(generated)}</div>
            </div>
        </div>
    `;

    showPrintPreview(html, 'Account Statement', 'Banam they owe you. Jama they paid. Then Print');
}

window.printLedgerStatement = printLedgerStatement;

/**
 * Navigation & View Management
 */
function closeSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar?.classList.remove('open');
    if (overlay) {
        overlay.hidden = true;
        overlay.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('sidebar-open');
}

function openSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar?.classList.add('open');
    if (overlay) {
        overlay.hidden = false;
        overlay.setAttribute('aria-hidden', 'false');
    }
    document.body.classList.add('sidebar-open');
}

function isMobileApp() {
    return window.matchMedia('(max-width: 768px)').matches;
}

function switchView(targetView) {
    if (!targetView || targetView === 'menu') return;
    const views = document.querySelectorAll('.view');
    document.querySelectorAll('.nav-link').forEach(l => {
        l.classList.toggle('active', l.getAttribute('data-view') === targetView);
    });
    document.querySelectorAll('.bottom-nav-item').forEach(l => {
        l.classList.toggle('active', l.getAttribute('data-view') === targetView);
    });
    views.forEach(view => {
        view.classList.toggle('active', view.id === `${targetView}-view`);
    });
    document.querySelector('.main-content')?.scrollTo({ top: 0, behavior: 'auto' });
    closeFabMenu();
    if (isMobileApp()) closeSidebar();
    updateUI();
}

function setupNavigation() {
    document.querySelectorAll('.nav-link, .bottom-nav-item').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetView = link.getAttribute('data-view');
            if (link.id === 'btn-bottom-menu' || targetView === 'menu') {
                const sidebar = document.querySelector('.sidebar');
                if (sidebar?.classList.contains('open')) closeSidebar();
                else openSidebar();
                return;
            }
            switchView(targetView);
        });
    });
}

function closeFabMenu() {
    const wrap = document.getElementById('mobile-fab-wrap');
    const backdrop = document.getElementById('fab-backdrop');
    const fab = document.getElementById('btn-mobile-fab');
    wrap?.classList.remove('open');
    if (backdrop) {
        backdrop.hidden = true;
        backdrop.classList.remove('show');
    }
    if (fab) fab.setAttribute('aria-expanded', 'false');
}

function setupMobileFab() {
    const fab = document.getElementById('btn-mobile-fab');
    const wrap = document.getElementById('mobile-fab-wrap');
    const backdrop = document.getElementById('fab-backdrop');
    if (!fab || !wrap) return;

    fab.addEventListener('click', () => {
        const opening = !wrap.classList.contains('open');
        wrap.classList.toggle('open', opening);
        fab.setAttribute('aria-expanded', opening ? 'true' : 'false');
        if (backdrop) {
            backdrop.hidden = !opening;
            backdrop.classList.toggle('show', opening);
        }
    });

    backdrop?.addEventListener('click', closeFabMenu);
    wrap.querySelectorAll('.fab-action').forEach(btn => {
        btn.addEventListener('click', closeFabMenu);
    });
}

let voiceRecognition = null;
let voiceContext = { customerId: '' };
let voiceSession = 0;
let voiceListenTimer = null;
let voiceFallback = false;

const VOICE_NUMBER_WORDS = {
    zero: 0, ek: 1, aik: 1, one: 1, do: 2, two: 2, teen: 3, three: 3,
    char: 4, four: 4, chaar: 4, panch: 5, paanch: 5, five: 5, che: 6, chhe: 6, chay: 6, six: 6,
    saat: 7, seven: 7, aath: 8, ath: 8, eight: 8, nau: 9, nine: 9,
    das: 10, ten: 10, gyarah: 11, eleven: 11, barah: 12, twelve: 12,
    bees: 20, twenty: 20, tees: 30, thirty: 30, chalis: 40, chaalis: 40, forty: 40,
    pachas: 50, fifty: 50, saath: 60, sixty: 60, sattar: 70, seventy: 70,
    assi: 80, eighty: 80, nabbe: 90, ninety: 90,
    sau: 100, so: 100, hundred: 100, hazar: 1000, hazaar: 1000, thousand: 1000,
    lakh: 100000, lac: 100000
};

const URDU_VOICE_SWAP = [
    [/بنام/g, ' banam '], [/جمع/g, ' jama '],
    [/دیئے|دیے|دئے|دیا|دیے ہیں|دئے ہیں/g, ' diye '],
    [/لیئے|لیے|لئے|لیا|لے لیے|لے لیا/g, ' liye '],
    [/وصول|وسول/g, ' wasool '],
    [/ادھار|اُدھار/g, ' udhaar '],
    [/آمدنی|آمدن|کمائی/g, ' income '],
    [/خرچہ|خرچ/g, ' expense '],
    [/روپے|روپیہ|رقم/g, ' rupees '],
    [/لاکھ/g, ' lakh '], [/ہزار/g, ' hazar '], [/(^|\s)سو(\s|$)/g, '$1 sau $2'],
    [/صفر/g, ' zero '], [/ایک/g, ' ek '], [/دو/g, ' do '], [/تین/g, ' teen '],
    [/چار/g, ' char '], [/پانچ/g, ' panch '], [/چھ/g, ' che '], [/سات/g, ' saat '],
    [/آٹھ|اٹھ/g, ' aath '], [/نو/g, ' nau '], [/دس/g, ' das '],
    [/بیس/g, ' bees '], [/تیس/g, ' tees '], [/چالیس/g, ' chalis '],
    [/پچاس/g, ' pachas '], [/ساٹھ/g, ' saath '], [/ستر/g, ' sattar '],
    [/اسی/g, ' assi '], [/نوے|نبے/g, ' nabbe '],
    [/(^|\s)سے(\s|$)/g, '$1 se $2'], [/(^|\s)کو(\s|$)/g, '$1 ko $2'],
    [/(^|\s)(کی|کے|کا)(\s|$)/g, '$1 ke $3'],
];

const URDU_LETTER_MAP = {
    ا: 'a', آ: 'a', ب: 'b', پ: 'p', ت: 't', ٹ: 't', ث: 's', ج: 'j', چ: 'ch',
    ح: 'h', خ: 'kh', د: 'd', ڈ: 'd', ذ: 'z', ر: 'r', ڑ: 'r', ز: 'z', ژ: 'zh',
    س: 's', ش: 'sh', ص: 's', ض: 'z', ط: 't', ظ: 'z', ع: 'a', غ: 'gh', ف: 'f',
    ق: 'q', ک: 'k', گ: 'g', ل: 'l', م: 'm', ن: 'n', ں: 'n', و: 'o', ہ: 'h',
    ھ: 'h', ء: '', ی: 'i', ئ: 'i', ے: 'e', ۃ: 'h'
};

const VOICE_HINTS = {
    roman: 'Try: Ahmad ko 500 diye · Ali se 1000 liye · Income 2000',
    en: 'Try: Gave Ahmad 500 · Received 1000 from Ali · Expense 300',
    ur: 'کوشش کریں: احمد کو 500 دیے · علی سے 1000 لیے · آمدن 2000'
};

function getSpeechRecognition() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function getVoiceMode() {
    const saved = localStorage.getItem('khata-voice-lang');
    if (saved === 'roman' || saved === 'en' || saved === 'ur') return saved;
    return (db.data.settings.language || 'en') === 'ur' ? 'ur' : 'roman';
}

function setVoiceMode(mode) {
    const next = mode === 'en' || mode === 'ur' ? mode : 'roman';
    localStorage.setItem('khata-voice-lang', next);
    document.querySelectorAll('[data-voice-lang]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.voiceLang === next);
    });
    const hint = document.getElementById('voice-hint');
    if (hint) hint.textContent = VOICE_HINTS[next];
    return next;
}

function voiceLangFallbacks(mode = getVoiceMode()) {
    if (mode === 'ur') return ['ur-PK', 'ur', 'hi-IN', 'en-IN'];
    if (mode === 'en') return ['en-US', 'en-IN', 'en-GB'];
    return ['en-IN', 'en-PK', 'ur-PK', 'en-GB', 'en-US'];
}

function romanizeUrduLetters(text) {
    return String(text || '').replace(/[\u0600-\u06FF]/g, ch => URDU_LETTER_MAP[ch] ?? '');
}

function foldVoiceName(text) {
    return romanizeUrduLetters(text)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');
}

function normalizeVoiceText(text) {
    let out = String(text || '')
        .replace(/[٠-٩]/g, ch => String(ch.charCodeAt(0) - 0x0660))
        .replace(/[۰-۹]/g, ch => String(ch.charCodeAt(0) - 0x06F0))
        .replace(/[,،]/g, ' ');
    URDU_VOICE_SWAP.forEach(([pattern, value]) => {
        out = out.replace(pattern, value);
    });
    return out.replace(/\s+/g, ' ').trim();
}

function extractVoiceAmount(raw) {
    const text = normalizeVoiceText(raw).toLowerCase();
    const scaled = text.match(/(\d+(?:\.\d+)?)\s*(lakh|lac|hazar|hazaar|thousand|sau|so|hundred)\b/);
    if (scaled) {
        const n = parseFloat(scaled[1]);
        const unit = scaled[2];
        if (unit === 'lakh' || unit === 'lac') return n * 100000;
        if (unit === 'hazar' || unit === 'hazaar' || unit === 'thousand') return n * 1000;
        return n * 100;
    }
    const digits = text.match(/(\d+(?:\.\d+)?)/);
    if (digits) return parseFloat(digits[1]);

    const tokens = romanizeUrduLetters(text).toLowerCase().split(/[^a-z]+/).filter(Boolean);
    let total = 0;
    let current = 0;
    let found = false;
    tokens.forEach(word => {
        const value = VOICE_NUMBER_WORDS[word];
        if (value == null) return;
        found = true;
        if (value >= 1000) {
            total += (current || 1) * value;
            current = 0;
        } else if (value === 100) {
            current = (current || 1) * 100;
        } else {
            current += value;
        }
    });
    total += current;
    return found && total > 0 ? total : 0;
}

function matchVoiceParty(raw, preferredId) {
    if (preferredId) {
        const preferred = db.data.customers.find(c => c.id == preferredId);
        if (preferred) return preferred;
    }
    const text = normalizeVoiceText(raw).toLowerCase();
    const foldedText = foldVoiceName(text);
    const beforeMarker = text.match(/^(.+?)\s+(?:ko|kay|ke|ki|se|say|to|from)\b/i);
    const hint = (beforeMarker ? beforeMarker[1] : text)
        .replace(/\b(diye|dia|diya|deya|de|dena|liye|lia|liya|le|lena|banam|banaam|jama|jamaa|income|expense|rupees|rupee|rupay|rs|amount|please|and|the|gave|give|given|got|received|paid|pay|udhar|udhaar|wasool|wasul)\b/gi, ' ')
        .replace(/\d+(?:\.\d+)?/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const foldedHint = foldVoiceName(hint);

    let best = null;
    let bestScore = 0;
    db.data.customers.forEach(customer => {
        const name = String(customer.name || '').toLowerCase().trim();
        if (!name) return;
        const first = name.split(/\s+/)[0];
        const foldedName = foldVoiceName(name);
        const foldedFirst = foldVoiceName(first);
        let score = 0;
        if (text.includes(name) && name.length > 1) score = name.length + 12;
        else if (foldedName.length > 2 && foldedText.includes(foldedName)) score = foldedName.length + 10;
        else if (hint && name.includes(hint) && hint.length > 1) score = hint.length + 8;
        else if (hint && hint.includes(name) && name.length > 1) score = name.length + 6;
        else if (foldedHint.length > 2 && foldedName.includes(foldedHint)) score = foldedHint.length + 7;
        else if (foldedHint.length > 2 && foldedHint.includes(foldedName)) score = foldedName.length + 5;
        else if (first.length > 2 && text.includes(first)) score = first.length;
        else if (foldedFirst.length > 2 && foldedText.includes(foldedFirst)) score = foldedFirst.length;
        if (String(customer.khataNo) && (text.includes(`khata ${customer.khataNo}`) || text.includes(`#${customer.khataNo}`))) {
            score += 8;
        }
        if (score > bestScore) {
            best = customer;
            bestScore = score;
        }
    });
    return bestScore >= 3 ? best : null;
}

function parseVoiceTranscript(raw, preferredId) {
    const heard = String(raw || '').trim();
    const text = normalizeVoiceText(raw);
    const lower = `${text} ${romanizeUrduLetters(text)}`.toLowerCase();
    const amount = extractVoiceAmount(text);
    const party = matchVoiceParty(text, preferredId);
    const gave = /\b(diye|dia|diya|deya|de diye|de diya|udhar|udhaar|banam|banaam|ba naam|gave|given|give|credit|paid to)\b/.test(lower);
    const got = /\b(liye|lia|liya|le liye|le lia|wasool|wasul|vasool|jama|jamaa|received|got|collect|collection|debit)\b/.test(lower);
    const income = /\b(income|sale|sales|cash in|kamai|kamaai|collection)\b/.test(lower);
    const expense = /\b(expense|kharcha|kharch|petrol|cash out)\b/.test(lower);

    let kind = 'banam';
    if (got && !gave) kind = 'jama';
    else if (gave) kind = 'banam';
    else if (income && !party) kind = 'income';
    else if (expense && !party) kind = 'expense';
    else if (income) kind = 'jama';
    else if (expense) kind = 'banam';
    else if (!party) kind = 'income';

    const note = text
        .replace(/\d+(?:\.\d+)?/g, ' ')
        .replace(/\b(diye|dia|diya|deya|liye|lia|liya|banam|banaam|jama|jamaa|income|expense|ko|se|say|kay|ke|ki|rupees|rupee|rupay|rs|hazar|hazaar|sau|so|thousand|hundred|lakh|lac|gave|give|given|got|received|paid|from|to|udhar|udhaar|wasool)\b/gi, ' ')
        .replace(party ? new RegExp(party.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig') : /$^/, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    return { amount, party, kind, note, heard: heard || text };
}

function scoreVoiceParse(parsed) {
    let score = 0;
    if (parsed.amount) score += 6;
    if (parsed.party) score += 5;
    if (parsed.kind === 'jama' || parsed.kind === 'banam') score += 1;
    return score;
}

function bestVoiceParse(transcripts, preferredId) {
    const unique = [...new Set((transcripts || []).map(t => String(t || '').trim()).filter(Boolean))];
    if (!unique.length) return parseVoiceTranscript('', preferredId);
    let best = null;
    let bestScore = -1;
    unique.forEach(text => {
        const parsed = parseVoiceTranscript(text, preferredId);
        const score = scoreVoiceParse(parsed);
        if (score > bestScore) {
            best = parsed;
            bestScore = score;
        }
    });
    return best;
}

function fillVoicePartySelect(selectedId) {
    const select = document.getElementById('voice-party');
    if (!select) return;
    const options = ['<option value="">Cash only — no party</option>']
        .concat(db.data.customers.map(c => (
            `<option value="${c.id}" ${String(c.id) === String(selectedId) ? 'selected' : ''}>${escapeHtml(c.name)} · #${escapeHtml(c.khataNo)}</option>`
        )));
    select.innerHTML = options.join('');
}

function setVoiceType(kind) {
    document.querySelectorAll('[data-voice-type]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.voiceType === kind);
    });
    const wrap = document.getElementById('voice-party-wrap');
    if (wrap) wrap.hidden = kind === 'income' || kind === 'expense';
}

function showVoicePreview(parsed) {
    const preview = document.getElementById('voice-preview');
    const heard = document.getElementById('voice-heard');
    const amount = document.getElementById('voice-amount');
    const note = document.getElementById('voice-note');
    if (heard) {
        heard.hidden = !parsed.heard;
        heard.textContent = parsed.heard ? `Heard: ${parsed.heard}` : '';
    }
    fillVoicePartySelect(parsed.party?.id || voiceContext.customerId || '');
    setVoiceType(parsed.kind || 'banam');
    if (amount) amount.value = parsed.amount || '';
    if (note) note.value = parsed.note || '';
    if (preview) preview.hidden = false;
}

function setVoiceStatus(message, listening) {
    const status = document.getElementById('voice-status');
    const mic = document.getElementById('btn-voice-mic');
    if (status) status.textContent = message;
    mic?.classList.toggle('listening', !!listening);
}

function stopVoiceListen() {
    voiceSession += 1;
    voiceFallback = false;
    if (voiceListenTimer) {
        clearTimeout(voiceListenTimer);
        voiceListenTimer = null;
    }
    const rec = voiceRecognition;
    voiceRecognition = null;
    try { rec?.abort(); } catch (_) {
        try { rec?.stop(); } catch (__) { /* ignore */ }
    }
    document.getElementById('btn-voice-mic')?.classList.remove('listening');
}

async function ensureMicAccess() {
    if (!navigator.mediaDevices?.getUserMedia) return true;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
    } catch (_) {
        return false;
    }
}

function collectVoiceTranscripts(event) {
    const joined = [];
    const alts = [];
    let interim = '';
    for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) {
            joined.push(result[0]?.transcript || '');
            for (let a = 0; a < result.length; a += 1) {
                const chunk = result[a]?.transcript || '';
                if (chunk.trim()) alts.push(chunk.trim());
            }
        } else {
            interim += result[0]?.transcript || '';
        }
    }
    const combined = joined.join(' ').trim();
    const finals = combined ? [combined, ...alts] : alts;
    return { finals, interim: interim.trim() };
}

function finishVoiceListen(rec, session) {
    if (session !== voiceSession || voiceRecognition !== rec) return;
    try { rec.stop(); } catch (_) { /* ignore */ }
}

function startVoiceEngine(Speech, langs, index, session) {
    if (session !== voiceSession) return;
    const rec = new Speech();
    rec.lang = langs[index];
    rec.interimResults = true;
    rec.maxAlternatives = 5;
    rec.continuous = true;
    voiceFallback = false;
    voiceRecognition = rec;
    setVoiceStatus('Listening… speak now', true);

    rec.onresult = (event) => {
        if (session !== voiceSession) return;
        const { finals, interim } = collectVoiceTranscripts(event);
        const live = (finals[0] || interim).trim();
        if (live) setVoiceStatus(live, true);
        if (!finals.length) {
            if (voiceListenTimer) clearTimeout(voiceListenTimer);
            voiceListenTimer = setTimeout(() => finishVoiceListen(rec, session), 2200);
            return;
        }
        const parsed = bestVoiceParse(finals, voiceContext.customerId);
        showVoicePreview(parsed);
        setVoiceStatus(parsed.amount
            ? 'Check and save, or listen again.'
            : 'I heard you. Please type the amount if it is missing.');
        finishVoiceListen(rec, session);
    };

    rec.onerror = (event) => {
        if (session !== voiceSession) return;
        const err = event.error;
        if (err === 'aborted' || err === 'cancelled') return;
        const retryNetwork = err === 'network' && !/^en-/i.test(langs[index]);
        const retryable = err === 'language-not-supported' || retryNetwork;
        if (retryable && index + 1 < langs.length) {
            voiceFallback = true;
            return;
        }
        if (err === 'not-allowed' || err === 'service-not-allowed') {
            setVoiceStatus('Microphone permission is blocked. Allow mic for this site.');
        } else if (err === 'no-speech') {
            setVoiceStatus('No speech heard. Tap the mic and try again.');
        } else if (err === 'network') {
            setVoiceStatus('Voice needs internet in Chrome or Edge. Try again on the website.');
        } else {
            setVoiceStatus('Could not hear that. Tap Roman Urdu, English, or اردو, then try again.');
        }
    };

    rec.onend = () => {
        if (session !== voiceSession) return;
        if (voiceFallback && index + 1 < langs.length) {
            voiceFallback = false;
            startVoiceEngine(Speech, langs, index + 1, session);
            return;
        }
        if (voiceRecognition === rec) voiceRecognition = null;
        document.getElementById('btn-voice-mic')?.classList.remove('listening');
        if (voiceListenTimer) {
            clearTimeout(voiceListenTimer);
            voiceListenTimer = null;
        }
    };

    try {
        rec.start();
        if (voiceListenTimer) clearTimeout(voiceListenTimer);
        voiceListenTimer = setTimeout(() => finishVoiceListen(rec, session), 12000);
    } catch (_) {
        if (index + 1 < langs.length) {
            startVoiceEngine(Speech, langs, index + 1, session);
            return;
        }
        setVoiceStatus('Mic is busy. Close other apps and try again.');
    }
}

async function startVoiceListen() {
    const Speech = getSpeechRecognition();
    if (!Speech) {
        setVoiceStatus('Voice needs Chrome or Edge on your phone.');
        showToast('Voice works in Chrome or Edge. Please type the entry.', 'error');
        return;
    }
    stopVoiceListen();
    const session = voiceSession;
    setVoiceStatus('Allow microphone, then speak…', true);
    const allowed = await ensureMicAccess();
    if (session !== voiceSession) return;
    if (!allowed) {
        setVoiceStatus('Microphone permission is blocked. Allow mic for this site.');
        showToast('Allow microphone to use voice entry.', 'error');
        return;
    }
    startVoiceEngine(Speech, voiceLangFallbacks(), 0, session);
}

function openVoiceEntry(opts = {}) {
    const overlay = document.getElementById('voice-overlay');
    if (!overlay) return;
    closeFabMenu();
    voiceContext = { customerId: opts.customerId || '' };
    overlay.hidden = false;
    document.body.classList.add('voice-open');
    document.getElementById('voice-preview')?.setAttribute('hidden', '');
    const heard = document.getElementById('voice-heard');
    if (heard) {
        heard.hidden = true;
        heard.textContent = '';
    }
    setVoiceMode(getVoiceMode());
    fillVoicePartySelect(voiceContext.customerId);
    setVoiceType(voiceContext.customerId ? 'banam' : 'income');
    setVoiceStatus(getSpeechRecognition()
        ? 'Tap the mic, then speak in Roman Urdu, English, or Urdu.'
        : 'Voice needs Chrome or Edge on your phone.');
    startVoiceListen();
}

function closeVoiceEntry() {
    stopVoiceListen();
    const overlay = document.getElementById('voice-overlay');
    if (overlay) overlay.hidden = true;
    document.body.classList.remove('voice-open');
    voiceContext = { customerId: '' };
}

function saveVoiceEntry() {
    const kindBtn = document.querySelector('[data-voice-type].active');
    const kind = kindBtn?.dataset.voiceType || 'banam';
    const amount = parseFloat(document.getElementById('voice-amount')?.value);
    const note = (document.getElementById('voice-note')?.value || '').trim();
    const partyId = document.getElementById('voice-party')?.value || '';
    if (!amount || amount <= 0) {
        showToast('Enter a valid amount greater than 0.', 'error');
        return;
    }
    if ((kind === 'banam' || kind === 'jama') && !partyId) {
        showToast('Pick a party for Banam or Jama.', 'error');
        return;
    }
    const customer = db.data.customers.find(c => c.id == partyId);
    if (kind === 'banam' || kind === 'jama') {
        const entryType = kind === 'jama' ? 'debit' : 'credit';
        db.addKhataEntry(partyId, amount, entryType, note || (kind === 'banam' ? 'Banam' : 'Jama'));
        showToast(kind === 'banam' ? 'Banam saved from voice.' : 'Jama saved from voice.', 'success');
        closeVoiceEntry();
        updateUI();
        openModal('Account Statement', 'view-ledger');
        renderLedgerStatement(partyId);
        return;
    }
    const cashType = kind === 'expense' ? 'expense' : 'income';
    const label = note || (customer ? customer.name : 'Voice entry');
    db.addRooznamchaEntry(amount, cashType, kind === 'expense' ? 'Expenses' : 'General', label, partyId || null);
    showToast(kind === 'expense' ? 'Expense saved from voice.' : 'Income saved from voice.', 'success');
    closeVoiceEntry();
    updateUI();
}

function setupVoiceEntry() {
    document.getElementById('btn-voice-close')?.addEventListener('click', closeVoiceEntry);
    document.getElementById('btn-voice-mic')?.addEventListener('click', startVoiceListen);
    document.getElementById('btn-voice-again')?.addEventListener('click', startVoiceListen);
    document.getElementById('btn-voice-save')?.addEventListener('click', saveVoiceEntry);
    document.getElementById('voice-overlay')?.addEventListener('click', (e) => {
        if (e.target.id === 'voice-overlay') closeVoiceEntry();
    });
    document.querySelectorAll('[data-voice-type]').forEach(btn => {
        btn.addEventListener('click', () => setVoiceType(btn.dataset.voiceType));
    });
    document.querySelectorAll('[data-voice-lang]').forEach(btn => {
        btn.addEventListener('click', () => {
            setVoiceMode(btn.dataset.voiceLang);
            startVoiceListen();
        });
    });
}

window.openVoiceEntry = openVoiceEntry;

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
        const typeBtn = e.target.closest('[data-khata-type]');
        if (typeBtn) {
            e.preventDefault();
            setKhataEntryKind(typeBtn.dataset.khataType);
            return;
        }
        const roleBtn = e.target.closest('[data-party-role]');
        if (roleBtn) {
            e.preventDefault();
            const input = document.getElementById('party-role-input');
            if (input) input.value = roleBtn.dataset.partyRole;
            document.querySelectorAll('[data-party-role]').forEach(btn => {
                btn.classList.toggle('active', btn === roleBtn);
            });
            return;
        }

        const partyItem = e.target.closest('.party-item');
        if (partyItem?.dataset.id) {
            openModal('Account Statement', 'view-ledger');
            renderLedgerStatement(partyItem.dataset.id);
            return;
        }

        const billItem = e.target.closest('.bill-item');
        if (billItem?.dataset.id && !e.target.closest('button, a')) {
            printBill(billItem.dataset.id);
            return;
        }

        const reportEntry = e.target.closest('.report-entry');
        if (reportEntry?.dataset.id) {
            const entry = db.data.rooznamcha.find(en => en.id == reportEntry.dataset.id);
            openRoozOrBillEditor(entry);
            return;
        }

        const interactive = e.target.closest('button, a, input, select, textarea, .table-actions');
        if (!interactive) {
            const miniCust = e.target.closest('.customer-item');
            if (miniCust?.dataset.id) {
                openModal('Account Statement', 'view-ledger');
                renderLedgerStatement(miniCust.dataset.id);
                return;
            }
            const customerRow = e.target.closest('tr.customer-row, .party-item');
            if (customerRow?.dataset.id) {
                openModal('Account Statement', 'view-ledger');
                renderLedgerStatement(customerRow.dataset.id);
                return;
            }
            const entryRow = e.target.closest('tr.entry-row');
            if (entryRow?.dataset.id) {
                const entry = db.data.rooznamcha.find(en => en.id == entryRow.dataset.id);
                openRoozOrBillEditor(entry);
                return;
            }
        }

        const target = e.target.closest('button');
        if (!target) return;

        if (target.classList.contains('btn-add-customer')) {
            openModal('Add Party', 'add-customer');
        } else if (target.classList.contains('btn-add-stock')) {
            openModal('Add Item', 'stock-item');
        } else if (target.classList.contains('btn-add-bill')) {
            if (!db.data.customers.length) {
                showToast('Add a party first, then make a bill.', 'error');
                return;
            }
            openModal('New Bill', 'create-bill');
        } else if (target.classList.contains('btn-edit-bill')) {
            openBillEditor(target.dataset.id);
        } else if (target.classList.contains('btn-print-bill') || target.classList.contains('btn-view-bill')) {
            printBill(target.dataset.id);
        } else if (target.classList.contains('btn-print-container')) {
            printBills(String(target.dataset.ids || '').split(',').filter(Boolean), 'Container bills');
        } else if (target.classList.contains('btn-edit-stock')) {
            const item = db.data.stock.find(s => s.id == target.dataset.id);
            if (item) openModal('Edit Item', 'stock-item', item);
        } else if (target.classList.contains('btn-stock-in')) {
            const item = db.data.stock.find(s => s.id == target.dataset.id);
            if (item) openModal(`Stock In — ${item.name}`, 'stock-move', { ...item, direction: 'in' });
        } else if (target.classList.contains('btn-stock-out')) {
            const item = db.data.stock.find(s => s.id == target.dataset.id);
            if (item) openModal(`Stock Out — ${item.name}`, 'stock-move', { ...item, direction: 'out' });
        } else if (target.classList.contains('btn-voice-entry') || target.id === 'btn-voice-form') {
            const form = document.getElementById('main-form');
            openVoiceEntry({
                customerId: form?.dataset.customerId || target.dataset.customerId || ''
            });
        } else if (target.classList.contains('btn-add-income')) {
            openModal('Add Income', 'add-income');
        } else if (target.classList.contains('btn-add-expense')) {
            openModal('Add Expense', 'add-expense');
        } else if (target.classList.contains('btn-add-transaction')) {
            openModal('New Daily Entry (Income)', 'add-income');
        } else if (target.classList.contains('btn-edit-customer')) {
            const id = target.dataset.id;
            const customer = db.data.customers.find(c => c.id == id);
            openModal('Edit Party', 'edit-customer', customer);
        } else if (target.classList.contains('btn-edit-entry')) {
            const id = target.dataset.id;
            const entry = db.data.rooznamcha.find(e => e.id == id);
            if (entry?.linkedBillId || entry?.type === 'bill') {
                openBillEditor(entry.linkedBillId || id);
                return;
            }
            openModal(`Edit Transaction #${entry.transactionNo}`, 'edit-entry', entry);
        } else if (target.classList.contains('btn-add-ledger-entry') || target.classList.contains('btn-view-ledger')) {
            const customerId = target.dataset.id;
            if (target.classList.contains('btn-view-ledger')) {
                openModal('Account Statement', 'view-ledger');
                renderLedgerStatement(customerId);
            } else {
                openKhataQuick(customerId, target.dataset.kind || 'credit');
            }
        } else if (target.closest('.btn-whatsapp-direct')) {
            const customerId = target.closest('.btn-whatsapp-direct').dataset.id;
            shareOnWhatsApp(customerId);
        } else if (target.id === 'btn-print-rooznamcha' || target.id === 'btn-print-rooznamcha-mobile') {
            const dateFilter = getRoozViewFilter();
            printRoozReport(dateFilter);
        } else if (target.closest('.btn-print-direct')) {
            const customerId = target.closest('.btn-print-direct').dataset.id;
            printLedgerStatement(customerId);
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
            const entry = db.data.rooznamcha.find(e => e.id == entryId);
            const isBill = entry?.type === 'bill' || entry?.linkedBillId;
            const ok = confirm(isBill
                ? 'Delete this bill from Daily Book? Banam will also be removed from the party khata.'
                : 'CAUTION: Are you sure you want to delete this transaction? You will lose this data forever!');
            if (ok) {
                db.deleteRooznamchaEntry(entryId);
                showUndoToast(isBill ? 'Bill deleted' : 'Transaction Deleted');
                updateUI();
            }
        } else if (target.closest('.btn-delete-customer')) {
            const customerId = target.closest('.btn-delete-customer').dataset.id;
            if (confirm("Delete this party and their khata history?")) {
                db.deleteCustomer(customerId);
                showUndoToast('Party deleted');
                closeModal();
                updateUI();
            }
        } else if (target.closest('.btn-delete-stock')) {
            const stockId = target.closest('.btn-delete-stock').dataset.id;
            if (confirm('Delete this stock item?')) {
                db.deleteStockItem(stockId);
                showUndoToast('Item deleted');
                updateUI();
            }
        } else if (target.closest('.btn-delete-bill')) {
            const billId = target.closest('.btn-delete-bill').dataset.id;
            if (confirm('Delete this bill? Banam will be removed from khata and Daily Book.')) {
                db.deleteBill(billId);
                showUndoToast('Bill deleted');
                updateUI();
            }
        }
    });

    // Backup & Restore
    document.getElementById('btn-export-csv')?.addEventListener('click', () => {
        const { start, end } = getReportDateRange();
        db.exportToCSV(start, end);
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
            document.querySelectorAll('.ledger-statement tbody tr, .ledger-entry-card').forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(query) ? '' : 'none';
            });
        }
    });

    closeBtn?.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    mainForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const success = handleFormSubmit(new FormData(mainForm));
        if (success === false) return; // Validation failed
        
        closeModal();
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

function setKhataEntryKind(kind) {
    const type = kind === 'debit' ? 'debit' : 'credit';
    const hidden = document.getElementById('khata-entry-type');
    if (hidden) hidden.value = type;
    document.querySelectorAll('[data-khata-type]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.khataType === type);
    });
    const hint = document.getElementById('khata-entry-hint');
    const cashLabel = document.getElementById('khata-cash-label');
    const cash = document.querySelector('#main-form [name="alsoCash"]');
    const save = document.getElementById('khata-save-btn');
    if (type === 'credit') {
        if (hint) hint.textContent = 'Banam: goods or cash you gave. They will owe you more.';
        if (cashLabel) cashLabel.textContent = 'This was cash given (add to Daily Book)';
        if (cash) cash.checked = false;
        if (save) save.textContent = 'Save Banam';
    } else {
        if (hint) hint.textContent = 'Jama: cash this party paid you, or goods they gave you.';
        if (cashLabel) cashLabel.textContent = 'Also add cash in Daily Book';
        if (cash) cash.checked = false;
        if (save) save.textContent = 'Save Jama';
    }
}

function closeModal() {
    const modal = document.getElementById('modal-container');
    modal?.classList.remove('active');
    document.body.classList.remove('modal-open');
}

function openModal(title, type, data = null) {
    const modal = document.getElementById('modal-container');
    const modalTitle = document.getElementById('modal-title');
    const form = document.getElementById('main-form');
    closeFabMenu();
    closeSidebar();
    
    modalTitle.innerText = title;
    form.dataset.type = type;
    if (type === 'khata-entry' && data?.customerId) {
        form.dataset.customerId = data.customerId;
        delete form.dataset.editId;
    } else if (data && data.id) {
        form.dataset.editId = data.id;
        delete form.dataset.customerId;
    } else {
        delete form.dataset.editId;
        if (type !== 'khata-entry') delete form.dataset.customerId;
    }

    form.innerHTML = renderForm(type, data);
    modal.querySelector('.modal-card')?.classList.toggle('modal-wide', type === 'view-ledger' || type === 'create-bill' || type === 'view-bill');
    modal.classList.add('active');
    document.body.classList.add('modal-open');
    if (type === 'create-bill') wireBillForm(form);
}

function renderForm(type, data = null) {
    switch(type) {
        case 'add-customer':
        case 'edit-customer':
            const isCustEdit = type === 'edit-customer';
            const role = partyRole(data);
            return `
                <div class="form-group">
                    <label>Party type</label>
                    <div class="gave-got-toggle role-toggle">
                        <button type="button" class="gave-got-btn ${role === 'customer' ? 'active' : ''}" data-party-role="customer">Customer</button>
                        <button type="button" class="gave-got-btn ${role === 'supplier' ? 'active' : ''}" data-party-role="supplier">Supplier</button>
                    </div>
                    <input type="hidden" name="role" id="party-role-input" value="${role}">
                </div>
                <div class="form-group">
                    <label>Name</label>
                    <input type="text" name="name" autocomplete="name" required placeholder="Enter name" value="${data ? escapeHtml(data.name) : ''}">
                </div>
                <div class="form-group">
                    <label>Phone Number</label>
                    <input type="tel" name="phone" inputmode="numeric" autocomplete="tel" placeholder="03xx-xxxxxxx (optional)" value="${data ? escapeHtml(data.phone || '') : ''}">
                </div>
                ${!isCustEdit ? `
                <div class="form-group">
                    <label>Manual Khata No (Optional)</label>
                    <input type="number" name="manualKhataNo" placeholder="Leave empty for auto-assign">
                </div>
                <div class="form-row">
                    <div class="form-group flex-1">
                        <label>Opening balance</label>
                        <input type="number" name="openingAmount" inputmode="decimal" step="0.01" min="0" placeholder="0">
                    </div>
                    <div class="form-group flex-1">
                        <label>Opening type</label>
                        <select name="openingType">
                            <option value="credit">They already owe you</option>
                            <option value="debit">You already owe them</option>
                        </select>
                    </div>
                </div>
                ` : ''}
                <div class="modal-footer">
                    <button type="submit" class="btn btn-primary">${data ? 'Update' : 'Save'} Party</button>
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
                <button type="button" class="voice-inline-btn" id="btn-voice-form">
                    <i class="fas fa-microphone"></i> Speak this entry
                </button>
                <input type="hidden" name="entryType" value="${realType}">
                
                <div class="form-row">
                    <div class="form-group flex-1">
                        <label>Transaction Amount</label>
                        <input type="number" name="amount" inputmode="decimal" step="0.01" min="0" required placeholder="0.00" autoFocus value="${data ? data.amount : ''}">
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
                    <label>Link to Khata (Party)</label>
                    <select name="customerId">
                        <option value="">-- Cash only (no party) --</option>
                        ${customerOptions}
                    </select>
                    <p class="form-hint">${realType === 'income'
                        ? 'If you select a party, their khata is posted as Jama (they paid you).'
                        : 'If you select a party, their khata is posted as Banam (you gave them cash).'}</p>
                </div>

                <div class="form-group">
                    <label>Short Description / Remarks</label>
                    <input type="text" name="description" placeholder="e.g. Bill #102, Received advance, etc." value="${data ? data.description : ''}">
                </div>
                
                <div class="modal-footer">
                    <button type="submit" class="btn btn-primary full-width">${isEdit ? 'Update' : 'Post'} to Daily Book & Khata</button>
                </div>
            `;
        case 'khata-entry': {
            const kind = data?.kind === 'debit' ? 'debit' : 'credit';
            const today = localISODate();
            return `
                <div class="gave-got-toggle" role="group" aria-label="Banam or Jama">
                    <button type="button" class="gave-got-btn gave ${kind === 'credit' ? 'active' : ''}" data-khata-type="credit">Banam</button>
                    <button type="button" class="gave-got-btn got ${kind === 'debit' ? 'active' : ''}" data-khata-type="debit">Jama</button>
                </div>
                <button type="button" class="voice-inline-btn" id="btn-voice-form">
                    <i class="fas fa-microphone"></i> Speak amount
                </button>
                <input type="hidden" name="type" id="khata-entry-type" value="${kind}">
                <p class="form-hint" id="khata-entry-hint">${kind === 'credit'
                    ? 'Banam: goods or cash you gave. They will owe you more.'
                    : 'Jama: cash this party paid you, or goods they gave you.'}</p>
                <div class="form-group">
                    <label>Amount</label>
                    <input type="number" name="amount" inputmode="decimal" step="0.01" min="0" required placeholder="0.00" autofocus>
                </div>
                <div class="form-group">
                    <label>Details</label>
                    <input type="text" name="description" placeholder="Bill no, item, or note">
                </div>
                <div class="form-group">
                    <label>Date</label>
                    <input type="date" name="entryDate" value="${today}" required>
                </div>
                <label class="check-row">
                    <input type="checkbox" name="alsoCash">
                    <span id="khata-cash-label">${kind === 'debit' ? 'Also add cash in Daily Book' : 'This was cash given (add to Daily Book)'}</span>
                </label>
                <div class="modal-footer">
                    <button type="submit" class="btn btn-primary full-width" id="khata-save-btn">${kind === 'credit' ? 'Save Banam' : 'Save Jama'}</button>
                </div>
            `;
        }
        case 'view-ledger':
            return `<div id="ledger-statement-view"></div>`;
        case 'create-bill':
            return renderCreateBillForm(data);
        case 'view-bill':
            return `<div id="bill-view-card"></div>`;
        case 'stock-item': {
            const isEdit = !!(data && data.id);
            const unit = data?.unit || 'pcs';
            return `
                <div class="form-group">
                    <label>Item name</label>
                    <input type="text" name="name" required placeholder="e.g. Sugar, Oil, Cement" value="${data ? escapeHtml(data.name) : ''}" autofocus>
                </div>
                <div class="form-row">
                    <div class="form-group flex-1">
                        <label>Unit</label>
                        <select name="unit">
                            <option value="pcs" ${unit === 'pcs' ? 'selected' : ''}>Pcs</option>
                            <option value="kg" ${unit === 'kg' ? 'selected' : ''}>Kg</option>
                            <option value="ltr" ${unit === 'ltr' ? 'selected' : ''}>Litre</option>
                            <option value="box" ${unit === 'box' ? 'selected' : ''}>Box</option>
                            <option value="mtr" ${unit === 'mtr' ? 'selected' : ''}>Meter</option>
                        </select>
                    </div>
                    <div class="form-group flex-1">
                        <label>${isEdit ? 'Current qty' : 'Opening qty'}</label>
                        <input type="number" name="qty" inputmode="decimal" step="0.01" min="0" placeholder="0" value="${data ? data.qty : ''}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group flex-1">
                        <label>Low stock alert</label>
                        <input type="number" name="minQty" inputmode="decimal" step="0.01" min="0" placeholder="0" value="${data ? data.minQty : ''}">
                    </div>
                    <div class="form-group flex-1">
                        <label>Buy price</label>
                        <input type="number" name="buyPrice" inputmode="decimal" step="0.01" min="0" placeholder="0" value="${data ? data.buyPrice : ''}">
                    </div>
                </div>
                <div class="form-group">
                    <label>Sell price (optional)</label>
                    <input type="number" name="sellPrice" inputmode="decimal" step="0.01" min="0" placeholder="0" value="${data ? data.sellPrice : ''}">
                </div>
                <div class="modal-footer">
                    <button type="submit" class="btn btn-primary">${isEdit ? 'Update Item' : 'Save Item'}</button>
                </div>
            `;
        }
        case 'stock-move': {
            const goingIn = data?.direction !== 'out';
            const unit = data?.unit || 'pcs';
            return `
                <p class="form-hint">Now in stock: <strong>${formatAmount(data?.qty || 0)} ${escapeHtml(unit)}</strong></p>
                <div class="form-group">
                    <label>${goingIn ? 'Qty in' : 'Qty out'}</label>
                    <input type="number" name="qty" inputmode="decimal" step="0.01" min="0.01" required placeholder="0" autofocus>
                    <input type="hidden" name="direction" value="${goingIn ? 'in' : 'out'}">
                </div>
                <div class="form-group">
                    <label>Note (optional)</label>
                    <input type="text" name="note" placeholder="Bill no, supplier, or reason">
                </div>
                <div class="modal-footer">
                    <button type="submit" class="btn btn-primary">${goingIn ? 'Add to stock' : 'Take from stock'}</button>
                </div>
            `;
        }
        default: return '';
    }
}

function normalizeBillUnit(unit) {
    const value = String(unit || 'kg').toLowerCase();
    if (value === 'pair' || value === 'pcs' || value === 'cbm') return value;
    return 'kg';
}

function billRateLabel(unit) {
    return {
        kg: 'Per KGS',
        pair: 'Per Pair',
        pcs: 'Per PCS',
        cbm: 'Per CBM'
    }[normalizeBillUnit(unit)];
}

function billQtyLabel(unit) {
    return {
        kg: 'KGS',
        pair: 'Pairs',
        pcs: 'PCS',
        cbm: 'CBM'
    }[normalizeBillUnit(unit)];
}

function billUnitOptions(selected) {
    const current = normalizeBillUnit(selected);
    return ['kg', 'pair', 'pcs', 'cbm'].map(unit => (
        `<option value="${unit}" ${unit === current ? 'selected' : ''}>${billRateLabel(unit)}</option>`
    )).join('');
}

function billLineAmount(item) {
    const unit = normalizeBillUnit(item.unit);
    const rate = Number(item.rate ?? item.perKg) || 0;
    const qty = Number(item.qty) || (unit === 'kg' ? Number(item.weight) : 0) || 0;
    if (qty > 0 && rate > 0) return qty * rate;
    const ctns = Number(item.ctns) || 0;
    if (ctns > 0 && rate > 0) return ctns * rate;
    return 0;
}

function billItemView(item) {
    const unit = normalizeBillUnit(item?.unit || ((item?.weight || item?.perKg) ? 'kg' : 'kg'));
    const qty = Number(item?.qty) || Number(item?.weight) || 0;
    const rate = Number(item?.rate ?? item?.perKg) || 0;
    return {
        name: item?.name || item?.description || '',
        unit,
        unitLabel: billRateLabel(unit),
        qtyLabel: billQtyLabel(unit),
        ctns: Number(item?.ctns) || 0,
        qty,
        weight: unit === 'kg' ? qty : Number(item?.weight) || 0,
        rate,
        amount: Number(item?.amount) || billLineAmount({ ...item, unit, qty, rate })
    };
}

function stockOptionsList() {
    return (db.data.stock || []).map(s => `<option value="${escapeHtml(s.name)}"></option>`).join('');
}

function partyOptionsHtml(selected) {
    return [...(db.data.customers || [])]
        .sort((a, b) => String(a.name).localeCompare(String(b.name)))
        .map(c => `<option value="${c.id}" ${String(c.id) === String(selected || '') ? 'selected' : ''}>${escapeHtml(c.name)} · #${escapeHtml(c.khataNo)}</option>`)
        .join('');
}

function billLineHtml(item) {
    const view = item ? billItemView(item) : null;
    const unit = view?.unit || 'kg';
    const name = view?.name || '';
    const ctns = view?.ctns ? String(view.ctns) : '';
    const qty = view?.qty ? String(view.qty) : '';
    const rate = view?.rate ? String(view.rate) : '';
    return `
        <div class="bill-line">
            <input type="text" name="itemName[]" list="bill-stock-list" placeholder="Goods" autocomplete="off" value="${escapeHtml(name)}">
            <input type="number" name="itemCtns[]" inputmode="decimal" step="0.01" min="0" placeholder="CTNS" value="${escapeHtml(ctns)}">
            <input type="number" name="itemQty[]" inputmode="decimal" step="0.01" min="0" placeholder="${billQtyLabel(unit)}" value="${escapeHtml(qty)}">
            <select name="itemUnit[]">${billUnitOptions(unit)}</select>
            <input type="number" name="itemRate[]" inputmode="decimal" step="0.01" min="0" placeholder="Rate" value="${escapeHtml(rate)}">
            <span class="bill-line-amt">0</span>
            <button type="button" class="btn-icon btn-remove-bill-line" aria-label="Remove item">&times;</button>
        </div>
    `;
}

function billPartyBlockHtml(bill) {
    const items = bill?.items?.length ? bill.items : [null];
    return `
        <div class="bill-party-block open">
            <div class="bill-party-head">
                <span class="bill-party-num">1</span>
                <select name="customerId[]">
                    <option value="">Select party</option>
                    ${partyOptionsHtml(bill?.customerId)}
                </select>
                <strong class="bill-party-subtotal">0</strong>
                <button type="button" class="btn-icon btn-toggle-bill-party" aria-label="Open or close this party"><i class="fas fa-chevron-down"></i></button>
                <button type="button" class="btn-icon btn-remove-bill-party" aria-label="Remove party" hidden>&times;</button>
            </div>
            <div class="bill-party-body">
                <div class="bill-line-head">
                    <span>Goods</span>
                    <span>CTNS</span>
                    <span>Qty</span>
                    <span>Rate type</span>
                    <span>Rate</span>
                    <span>How much</span>
                    <span></span>
                </div>
                <div class="bill-party-lines">${items.map(item => billLineHtml(item)).join('')}</div>
                <div class="bill-party-foot">
                    <button type="button" class="btn-text btn-add-bill-line">+ Item</button>
                </div>
            </div>
        </div>
    `;
}

function billFormMode(form) {
    return form?.dataset.billMode === 'many' ? 'many' : 'one';
}

function openBillPartyBlock(form, block) {
    if (!form || !block) return;
    if (billFormMode(form) === 'many') {
        form.querySelectorAll('.bill-party-block').forEach(row => {
            row.classList.toggle('open', row === block);
        });
    } else {
        block.classList.add('open');
    }
}

function syncBillPartyBlocks(form) {
    if (!form) return;
    const many = billFormMode(form) === 'many';
    const blocks = [...form.querySelectorAll('.bill-party-block')];
    blocks.forEach((block, i) => {
        const num = block.querySelector('.bill-party-num');
        if (num) num.textContent = String(i + 1);
        const remove = block.querySelector('.btn-remove-bill-party');
        if (remove) remove.hidden = !many || blocks.length <= 1;
        if (!many) block.classList.add('open');
    });
    if (many && blocks.length && !blocks.some(b => b.classList.contains('open'))) {
        blocks[blocks.length - 1].classList.add('open');
    }
}

function setBillFormMode(form, mode) {
    if (!form) return;
    const next = mode === 'many' ? 'many' : 'one';
    form.dataset.billMode = next;
    form.querySelectorAll('.bill-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.billMode === next);
    });
    const many = next === 'many';
    const addParty = form.querySelector('#btn-add-bill-party');
    if (addParty) addParty.hidden = !many;
    if (!many) {
        [...form.querySelectorAll('.bill-party-block')].slice(1).forEach(block => block.remove());
    }
    const hint = form.querySelector('#bill-mode-hint');
    if (hint) {
        hint.textContent = many
            ? 'Same container. Only one party stays open — tap a row to edit that party.'
            : 'Qty × Rate. CTNS is cartons only.';
    }
    const save = form.querySelector('#bill-save-btn');
    if (save) save.textContent = many ? 'Save bills as Banam' : 'Save bill as Banam';
    syncBillPartyBlocks(form);
    if (many) {
        const blocks = form.querySelectorAll('.bill-party-block');
        openBillPartyBlock(form, blocks[blocks.length - 1]);
    }
    recalcBillForm(form);
}

function renderCreateBillForm(bill = null) {
    const isEdit = !!(bill && bill.id);
    return `
        <div class="bill-create${isEdit ? ' is-edit' : ''}">
            ${isEdit ? '' : `
            <div class="bill-mode-toggle" role="tablist">
                <button type="button" class="bill-mode-btn active" data-bill-mode="one">1 Party</button>
                <button type="button" class="bill-mode-btn" data-bill-mode="many">1 Container, many parties</button>
            </div>`}
            <p class="form-hint" id="bill-mode-hint">${isEdit ? 'Update this bill. Banam and Daily Book will change with it.' : 'Qty × Rate. CTNS is cartons only.'}</p>
            <div class="bill-ship-grid">
                <label>Date
                    <input type="date" name="billDate" value="${escapeHtml(bill?.date ? (entryLocalDate(bill.date) || localISODate()) : localISODate())}" required>
                </label>
                <label>B/E No
                    <input type="text" name="entryNo" placeholder="GD / B/E" value="${escapeHtml(bill?.entryNo || '')}">
                </label>
                <label>Container
                    <input type="text" name="containerNo" placeholder="MSKU 1234567" value="${escapeHtml(bill?.containerNo || '')}">
                </label>
                <label>Vehicle
                    <input type="text" name="vehicleNo" placeholder="Truck no" value="${escapeHtml(bill?.vehicleNo || '')}">
                </label>
            </div>
            <div id="bill-parties">${billPartyBlockHtml(bill)}</div>
            <datalist id="bill-stock-list">${stockOptionsList()}</datalist>
            <button type="button" class="btn btn-secondary" id="btn-add-bill-party" hidden>
                <i class="fas fa-user-plus"></i> Add party on this container
            </button>
            <label class="bill-note-label">Note
                <input type="text" name="note" placeholder="Optional remarks" value="${escapeHtml(bill?.note || '')}">
            </label>
            <div class="modal-footer">
                <div class="bill-form-total">
                    <span id="bill-form-counts">0 CTNS</span>
                    <strong id="bill-form-total">0</strong>
                </div>
                <button type="submit" class="btn btn-primary full-width" id="bill-save-btn">${isEdit ? 'Update bill' : 'Save bill as Banam'}</button>
            </div>
        </div>
    `;
}

function recalcBillForm(form) {
    if (!form) return;
    const currency = db.data.settings.currency || 'Rs.';
    let total = 0;
    let ctns = 0;
    const qtyByUnit = { kg: 0, pair: 0, pcs: 0, cbm: 0 };
    form.querySelectorAll('.bill-party-block').forEach(block => {
        let sub = 0;
        block.querySelectorAll('.bill-line').forEach(row => {
            const item = {
                ctns: row.querySelector('[name="itemCtns[]"]')?.value,
                qty: row.querySelector('[name="itemQty[]"]')?.value,
                unit: row.querySelector('[name="itemUnit[]"]')?.value,
                rate: row.querySelector('[name="itemRate[]"]')?.value
            };
            const unit = normalizeBillUnit(item.unit);
            const amount = billLineAmount(item);
            sub += amount;
            total += amount;
            ctns += Number(item.ctns) || 0;
            qtyByUnit[unit] += Number(item.qty) || 0;
            const amt = row.querySelector('.bill-line-amt');
            if (amt) amt.textContent = amount ? formatAmount(amount) : '0';
            const qtyInput = row.querySelector('[name="itemQty[]"]');
            if (qtyInput) qtyInput.placeholder = billQtyLabel(unit);
        });
        const subEl = block.querySelector('.bill-party-subtotal');
        if (subEl) subEl.textContent = sub ? formatMoney(sub, currency) : formatMoney(0, currency);
    });
    const totalEl = form.querySelector('#bill-form-total');
    const countsEl = form.querySelector('#bill-form-counts');
    if (totalEl) totalEl.textContent = formatMoney(total, currency);
    const parts = [];
    if (billFormMode(form) === 'many') parts.push(`${form.querySelectorAll('.bill-party-block').length} parties`);
    parts.push(`${formatAmount(ctns)} CTNS`);
    if (qtyByUnit.kg) parts.push(`${formatAmount(qtyByUnit.kg)} KGS`);
    if (qtyByUnit.pair) parts.push(`${formatAmount(qtyByUnit.pair)} Pair`);
    if (qtyByUnit.pcs) parts.push(`${formatAmount(qtyByUnit.pcs)} PCS`);
    if (qtyByUnit.cbm) parts.push(`${formatAmount(qtyByUnit.cbm)} CBM`);
    if (countsEl) countsEl.textContent = parts.join(' · ');
    const save = form.querySelector('#bill-save-btn');
    if (save && billFormMode(form) === 'many') {
        const n = form.querySelectorAll('.bill-party-block').length;
        save.textContent = n > 1 ? `Save ${n} bills as Banam` : 'Save bills as Banam';
    }
}

function wireBillForm(form) {
    if (!form) return;
    form.dataset.billMode = 'one';
    recalcBillForm(form);
    form.addEventListener('click', (e) => {
        const modeBtn = e.target.closest('.bill-mode-btn');
        if (modeBtn) {
            setBillFormMode(form, modeBtn.dataset.billMode);
            return;
        }
        if (e.target.closest('#btn-add-bill-party')) {
            form.querySelector('#bill-parties')?.insertAdjacentHTML('beforeend', billPartyBlockHtml());
            setBillFormMode(form, 'many');
            const added = form.querySelector('.bill-party-block:last-child');
            openBillPartyBlock(form, added);
            added?.querySelector('[name="customerId[]"]')?.focus();
            return;
        }
        const toggleParty = e.target.closest('.btn-toggle-bill-party, .bill-party-num');
        if (toggleParty) {
            const block = toggleParty.closest('.bill-party-block');
            if (!block) return;
            if (block.classList.contains('open') && billFormMode(form) === 'many') {
                block.classList.remove('open');
            } else {
                openBillPartyBlock(form, block);
            }
            return;
        }
        const addLine = e.target.closest('.btn-add-bill-line');
        if (addLine) {
            addLine.closest('.bill-party-block')?.querySelector('.bill-party-lines')?.insertAdjacentHTML('beforeend', billLineHtml());
            recalcBillForm(form);
            return;
        }
        const removeParty = e.target.closest('.btn-remove-bill-party');
        if (removeParty) {
            const blocks = form.querySelectorAll('.bill-party-block');
            if (blocks.length <= 1) return;
            removeParty.closest('.bill-party-block')?.remove();
            setBillFormMode(form, billFormMode(form));
            return;
        }
        const removeLine = e.target.closest('.btn-remove-bill-line');
        if (!removeLine) return;
        const block = removeLine.closest('.bill-party-block');
        const rows = block?.querySelectorAll('.bill-line') || [];
        if (rows.length <= 1) return;
        removeLine.closest('.bill-line')?.remove();
        recalcBillForm(form);
    });
    form.addEventListener('input', (e) => {
        const row = e.target.closest('.bill-line');
        if (e.target.name === 'itemName[]' && row) {
            const stock = (db.data.stock || []).find(s => String(s.name).toLowerCase() === e.target.value.toLowerCase());
            const rateInput = row.querySelector('[name="itemRate[]"]');
            if (stock && rateInput && !rateInput.value) {
                rateInput.value = stock.sellPrice || stock.buyPrice || '';
            }
        }
        recalcBillForm(form);
    });
    form.addEventListener('change', () => recalcBillForm(form));
}

function collectBillItems(root) {
    return [...root.querySelectorAll('.bill-line')].map(row => ({
        name: row.querySelector('[name="itemName[]"]')?.value || '',
        ctns: row.querySelector('[name="itemCtns[]"]')?.value,
        qty: row.querySelector('[name="itemQty[]"]')?.value,
        unit: row.querySelector('[name="itemUnit[]"]')?.value,
        rate: row.querySelector('[name="itemRate[]"]')?.value
    }));
}

function collectBillParties(form) {
    return [...form.querySelectorAll('.bill-party-block')].map(block => ({
        customerId: block.querySelector('[name="customerId[]"]')?.value || '',
        items: collectBillItems(block)
    }));
}

function renderLedgerStatement(customerId) {
    const model = getLedgerStatementModel(customerId);
    const container = document.getElementById('ledger-statement-view');
    if (!model || !container) return;

    const { customer, currency, shopName, rows, totalGave, totalGot, period } = model;
    const result = statementResult(model);
    const tel = String(customer.phone || '').replace(/[^0-9+]/g, '');
    const rowHtml = rows.length
        ? rows.map(row => `
            <tr>
                <td>${escapeHtml(row.date)}</td>
                <td>
                    <div class="ledger-kind ${row.kind}">${escapeHtml(row.kindLabel)}</div>
                    <div>${escapeHtml(row.description)}</div>
                </td>
                <td class="num ledger-gave">${row.gave ? formatAmount(row.gave) : '—'}</td>
                <td class="num ledger-got">${row.got ? formatAmount(row.got) : '—'}</td>
                <td class="num">
                    ${formatAmount(Math.abs(row.balance))}
                    <span class="cell-balance-hint">${escapeHtml(row.hint)}</span>
                </td>
            </tr>
        `).join('')
        : '<tr><td colspan="5" class="text-center">No transactions yet on this khata.</td></tr>';

    const cardHtml = rows.length
        ? rows.map(row => `
            <article class="ledger-entry-card ${row.kind}">
                <div class="ledger-entry-top">
                    <span>${escapeHtml(row.date)}</span>
                    <span class="ledger-kind ${row.kind}">${escapeHtml(row.kindLabel)}</span>
                </div>
                <div class="ledger-entry-desc">${escapeHtml(row.description)}</div>
                <div class="ledger-entry-amt ${row.kind}">${escapeHtml(currency)} ${formatAmount(row.gave || row.got)}</div>
                <div class="ledger-entry-bal">Balance ${escapeHtml(currency)} ${formatAmount(Math.abs(row.balance))} · ${escapeHtml(row.hint)}</div>
            </article>
        `).join('')
        : '<p class="empty-state">No transactions yet on this khata.</p>';

    container.innerHTML = `
        <div class="ledger-statement">
            <div class="ledger-result ${result.tone}">
                <span class="ledger-result-label">${escapeHtml(result.label)}</span>
                <strong>${escapeHtml(result.amount)}</strong>
                <p>${escapeHtml(result.explain)}</p>
            </div>
            <div class="ledger-quick no-print">
                <button type="button" class="ledger-quick-btn gave" onclick="openKhataQuick('${customerId}','credit')">Banam</button>
                <button type="button" class="ledger-quick-btn got" onclick="openKhataQuick('${customerId}','debit')">Jama</button>
                <button type="button" class="ledger-quick-btn voice" onclick="openVoiceEntry({customerId:'${customerId}'})">Speak</button>
            </div>
            ${result.tone !== 'clear' ? `
            <button type="button" class="btn btn-secondary ledger-remind no-print" onclick="remindOnWhatsApp('${customerId}')">
                <i class="fab fa-whatsapp"></i> ${result.tone === 'due' ? 'Remind to pay' : 'Send balance on WhatsApp'}
            </button>` : ''}
            <div class="ledger-party-card">
                <div>
                    <span class="ledger-party-label">${escapeHtml(partyRoleLabel(customer))}</span>
                    <div class="ledger-party-value">${escapeHtml(customer.name)}</div>
                    <div class="ledger-party-sub">${escapeHtml(customer.phone || shopName)}</div>
                </div>
                <div>
                    <span class="ledger-party-label">Khata No</span>
                    <div class="ledger-party-value">${escapeHtml(customer.khataNo)}</div>
                    <div class="ledger-party-sub">${escapeHtml(period)}</div>
                </div>
                <div>
                    <span class="ledger-party-label">Banam</span>
                    <div class="ledger-party-value ledger-gave">${escapeHtml(currency)} ${formatAmount(totalGave)}</div>
                    <div class="ledger-party-sub">Jama ${escapeHtml(currency)} ${formatAmount(totalGot)}</div>
                </div>
            </div>
            <div class="no-print ledger-search-wrap">
                <input type="text" id="ledger-search" placeholder="Search date or details...">
            </div>
            <div class="table-responsive ledger-table-wrap ledger-desktop">
                <table class="ledger-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Details</th>
                            <th class="num">Banam</th>
                            <th class="num">Jama</th>
                            <th class="num">Balance</th>
                        </tr>
                    </thead>
                    <tbody>${rowHtml}</tbody>
                    <tfoot>
                        <tr>
                            <td colspan="2">Total</td>
                            <td class="num">${formatAmount(totalGave)}</td>
                            <td class="num">${formatAmount(totalGot)}</td>
                            <td class="num">${escapeHtml(result.amount)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            <div class="ledger-cards ledger-mobile">${cardHtml}</div>
            <div class="modal-footer no-print ledger-actions">
                ${tel ? `<a class="btn btn-secondary" href="tel:${tel}">Call</a>` : ''}
                <button type="button" class="btn btn-secondary btn-edit-customer" data-id="${customerId}">Edit</button>
                <button type="button" class="btn btn-secondary" onclick="shareOnWhatsApp('${customerId}')">WhatsApp</button>
                <button type="button" class="btn btn-primary" onclick="printLedgerStatement('${customerId}')">Print</button>
                <button type="button" class="btn-text btn-delete-customer" data-id="${customerId}">Delete</button>
            </div>
        </div>
    `;
}

window.copyLedgerAsText = (customerId) => {
    const text = buildLedgerText(customerId);
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        showToast('Full statement copied.', 'success');
    }).catch(err => {
        console.error('Failed to copy:', err);
        showToast('Failed to copy statement.', 'error');
    });
};

window.openKhataQuick = (customerId, kind) => {
    const customer = db.data.customers.find(c => c.id == customerId);
    if (!customer) return;
    const type = kind === 'debit' ? 'debit' : 'credit';
    const title = type === 'credit' ? `Banam — ${customer.name}` : `Jama — ${customer.name}`;
    openModal(title, 'khata-entry', { customerId, kind: type });
};

function openWhatsAppText(customer, text) {
    const phoneNumber = String(customer?.phone || '').replace(/[^0-9]/g, '');
    const finalPhone = !phoneNumber
        ? ''
        : (phoneNumber.startsWith('92') || phoneNumber.length > 10 ? phoneNumber : `92${phoneNumber}`);
    const url = finalPhone
        ? `https://wa.me/${finalPhone}?text=${encodeURIComponent(text)}`
        : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
}

window.remindOnWhatsApp = (customerId) => {
    const model = getLedgerStatementModel(customerId);
    if (!model) return;
    const result = statementResult(model);
    const { customer, shopName } = model;
    let text;
    if (model.closing > 0) {
        text = `Assalamualaikum ${customer.name},\n\nYour pending amount with ${shopName} is *${result.amount}*.\nPlease pay soon. Thank you.\n\nAap ka pending amount ${result.amount} hai. Shukriya.`;
    } else if (model.closing < 0) {
        text = `Assalamualaikum ${customer.name},\n\n${shopName} has to pay you *${result.amount}*.`;
    } else {
        text = `Assalamualaikum ${customer.name},\n\nYour khata with ${shopName} is clear. Shukriya.`;
    }
    openWhatsAppText(customer, text);
};

function shareOnWhatsApp(customerId) {
    const customer = db.data.customers.find(c => c.id == customerId);
    if (!customer) return;
    const text = buildLedgerText(customerId, 20);
    if (!text) return;
    openWhatsAppText(customer, text);
}
window.shareOnWhatsApp = shareOnWhatsApp;

function handleFormSubmit(formData) {
    const form = document.getElementById('main-form');
    const type = form.dataset.type;
    const editId = form.dataset.editId;
    
    if (type === 'add-customer' || type === 'edit-customer') {
        const name = formData.get('name')?.trim();
        const phone = formData.get('phone')?.trim();
        const manualKhataNo = formData.get('manualKhataNo')?.trim();
        const role = formData.get('role') === 'supplier' ? 'supplier' : 'customer';
        if (!name) { showToast('Name is required.', 'error'); return false; }
        
        if (editId) {
            db.updateCustomer(editId, name, phone, role);
            showToast('Party updated successfully!', 'success');
        } else {
            db.addCustomer(name, phone, manualKhataNo, {
                role,
                openingAmount: formData.get('openingAmount'),
                openingType: formData.get('openingType')
            });
            showToast('New party added!', 'success');
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
        const customerId = form.dataset.customerId;
        const customer = db.data.customers.find(c => c.id == customerId);
        if (!customer) { showToast('Party not found.', 'error'); return false; }
        const entryType = formData.get('type') === 'debit' ? 'debit' : 'credit';
        const description = (formData.get('description') || '').trim() || (entryType === 'credit' ? 'Banam' : 'Jama');
        const dateISO = dateToISO(formData.get('entryDate'));
        db.addKhataEntry(customerId, amount, entryType, description, null, dateISO);
        if (formData.get('alsoCash')) {
            const cashType = entryType === 'debit' ? 'income' : 'expense';
            db.addRooznamchaEntry(amount, cashType, 'Khata', `${customer.name}: ${description}`, null, dateISO);
        }
        showToast(entryType === 'credit' ? 'Banam saved.' : 'Jama saved.', 'success');
        updateUI();
        openModal('Account Statement', 'view-ledger');
        renderLedgerStatement(customerId);
        return false;
    } else if (type === 'stock-item') {
        const name = formData.get('name')?.trim();
        if (!name) { showToast('Item name is required.', 'error'); return false; }
        const payload = {
            name,
            unit: formData.get('unit') || 'pcs',
            qty: formData.get('qty'),
            minQty: formData.get('minQty'),
            buyPrice: formData.get('buyPrice'),
            sellPrice: formData.get('sellPrice')
        };
        if (editId) {
            db.updateStockItem(editId, payload);
            showToast('Item updated.', 'success');
        } else {
            db.addStockItem(payload);
            showToast('Item added to stock.', 'success');
        }
    } else if (type === 'stock-move') {
        const qty = parseFloat(formData.get('qty'));
        if (isNaN(qty) || qty <= 0) { showToast('Enter a quantity greater than 0.', 'error'); return false; }
        const itemId = form.dataset.editId;
        const goingIn = formData.get('direction') !== 'out';
        const ok = db.adjustStock(itemId, goingIn ? qty : -qty, formData.get('note')?.trim() || '');
        if (!ok) {
            showToast('Not enough stock for this out.', 'error');
            return false;
        }
        showToast(goingIn ? 'Stock in saved.' : 'Stock out saved.', 'success');
    } else if (type === 'create-bill') {
        const parties = collectBillParties(form).filter(p => p.customerId);
        if (!parties.length) { showToast('Select a party for this bill.', 'error'); return false; }
        const shared = {
            date: formData.get('billDate'),
            note: formData.get('note'),
            entryNo: formData.get('entryNo'),
            containerNo: formData.get('containerNo'),
            vehicleNo: formData.get('vehicleNo')
        };
        const editId = form.dataset.editId;
        if (editId) {
            const party = parties[0];
            const bill = db.updateBill(editId, {
                ...shared,
                customerId: party.customerId,
                items: party.items
            });
            if (!bill) {
                showToast('Add goods with qty and rate, then update.', 'error');
                return false;
            }
            const partyName = db.data.customers.find(c => c.id == bill.customerId)?.name || 'khata';
            showToast(`Bill #${bill.billNo} updated. Banam and Daily Book saved.`, 'success');
            updateUI();
            closeModal();
            switchView('bills');
            return false;
        }
        if (billFormMode(form) === 'many' && parties.length > 1 && !String(shared.containerNo || '').trim()) {
            showToast('Enter the container number so these parties stay together.', 'error');
            return false;
        }
        const groupId = parties.length > 1
            ? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
            : '';
        const created = [];
        parties.forEach(party => {
            const bill = db.addBill({
                ...shared,
                customerId: party.customerId,
                items: party.items,
                containerGroupId: groupId,
                skipSave: true
            });
            if (bill) created.push(bill);
        });
        if (!created.length) {
            showToast('Add goods with qty and rate for each party.', 'error');
            return false;
        }
        db.save();
        const names = created.map(bill => db.data.customers.find(c => c.id == bill.customerId)?.name).filter(Boolean);
        if (created.length === 1) {
            const party = names[0] || 'khata';
            showToast(`Bill #${created[0].billNo} saved. Banam posted on ${party} and Daily Book.`, 'success');
        } else {
            showToast(`${created.length} bills saved. Banam posted on each khata and Daily Book.`, 'success');
        }
        updateUI();
        closeModal();
        switchView('bills');
        if (created.length === 1) printBill(created[0].id);
        else printBills(created.map(b => b.id), shared.containerNo ? `Container ${shared.containerNo}` : 'Container bills');
        return false;
    }
    return true;
}

/**
 * Data Loading & UI Population
 */
function updateUI(dateFilter = null, searchQuery = "") {
    if (typeof db !== 'undefined' && db.ensureBillRooznamcha()) db.save(true);
    const roozDateFilter = document.getElementById('rooznamcha-date-filter');
    const todayStr = localISODate();
    if (roozDateFilter && !roozDateFilter.value) roozDateFilter.value = todayStr;
    const effectiveDateFilter = getRoozViewFilter(dateFilter);
    syncRoozRangeButtons();

    const stats = db.getStats();
    updateStatsDisplay(stats);
    updateRooznamchaLists(effectiveDateFilter, searchQuery);
    updateCustomerLists();
    updateStockList();
    updateBillsList();
    updateTrashList();
    updateCharts();
    updateReportsPage();
}

function updateTrashList() {
    const trashList = document.getElementById('trash-list');
    if (!trashList) return;

    const currency = db.data.settings.currency || 'Rs.';
    trashList.innerHTML = db.data.trash.slice().reverse().map(item => {
        let details = '';
        if (item.type === 'customer') {
            details = `<strong>Customer:</strong> ${item.data.name} (Khata: ${item.data.khataNo})`;
        } else if (item.type === 'stock') {
            details = `<strong>Stock:</strong> ${item.data.name || 'Item'} (${item.data.qty || 0} ${item.data.unit || 'pcs'})`;
        } else if (item.type === 'bill') {
            details = `<strong>Bill #${item.data.billNo || ''}:</strong> ${currency} ${(Number(item.data.total) || 0).toLocaleString()}`;
        } else {
            // Fix: Handle transaction data properly
            const amount = item.data.amount ? item.data.amount.toLocaleString() : '0';
            const type = item.data.type ? item.data.type.toUpperCase() : 'ENTRY';
            details = `<strong>${type}:</strong> ${currency} ${amount} - ${item.data.description || ''}`;
        }

        return `
            <tr>
                <td class="cell-sub"><span class="badge ${item.type === 'customer' ? 'badge-info' : 'badge-warning'}">${item.type.toUpperCase()}</span></td>
                <td class="cell-title">${details}</td>
                <td class="cell-meta">${new Date(item.deletedAt).toLocaleString()}</td>
                <td class="cell-actions text-right">
                    <button class="btn btn-icon btn-restore-trash" data-id="${item.id}" title="Restore">
                        <i class="fas fa-undo"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    if (db.data.trash.length === 0) {
        trashList.innerHTML = '<tr class="empty-row"><td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted);">Trash is empty</td></tr>';
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
        const hasData = db.data.rooznamcha.length > 0 && pct !== null;
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

function openBillEditor(billId) {
    const bills = db.data.bills || [];
    const bill = bills.find(b => b.id == billId)
        || bills.find(b => b.rooznamchaId == billId)
        || bills.find(b => `${b.id}-rooz` == billId);
    if (!bill) {
        showToast('Bill not found.', 'error');
        return;
    }
    openModal(`Edit Bill #${bill.billNo}`, 'create-bill', bill);
}

function openRoozOrBillEditor(entry) {
    if (!entry) return;
    if (entry.linkedBillId || entry.type === 'bill') {
        openBillEditor(entry.linkedBillId || entry.id);
        return;
    }
    openModal(`Edit Transaction #${entry.transactionNo}`, 'edit-entry', entry);
}

function roozRowMeta(t) {
    if (t?.type === 'bill' || t?.linkedBillId) {
        return { kind: 'bill', badge: 'banam', badgeText: 'Banam', amountClass: '', sign: '', typeLabel: 'bill' };
    }
    if (t?.type === 'income') {
        return { kind: 'income', badge: 'jama', badgeText: 'Jama', amountClass: 'text-success', sign: '+', typeLabel: 'income' };
    }
    return { kind: 'expense', badge: 'banam', badgeText: 'Banam', amountClass: 'text-danger', sign: '-', typeLabel: 'expense' };
}

function roozListTotals(entries) {
    let income = 0;
    let expense = 0;
    let bills = 0;
    (entries || []).forEach(t => {
        const amount = Number(t.amount) || 0;
        if (t.type === 'income') income += amount;
        else if (t.type === 'expense') expense += amount;
        else if (t.type === 'bill' || t.linkedBillId) bills += amount;
    });
    return { income, expense, bills, net: income - expense };
}

function updateRooznamchaLists(dateFilter, searchQuery) {
    const currency = db.data.settings.currency || 'Rs.';
    const recentList = document.getElementById('recent-transactions-list');
    const rooznamchaList = document.getElementById('rooznamcha-list');
    
    if (!recentList && !rooznamchaList) return;

    const showingAll = !dateFilter;
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

    const periodStats = roozListTotals(roozViewTransactions);
    const todayIncomeEl = document.getElementById('today-income');
    const todayExpenseEl = document.getElementById('today-expense');
    const todayBillsEl = document.getElementById('today-bills');
    const todayNetEl = document.getElementById('today-net');
    const incomeLabel = document.getElementById('rooz-income-label');
    const expenseLabel = document.getElementById('rooz-expense-label');
    const billsLabel = document.getElementById('rooz-bills-label');
    const netLabel = document.getElementById('rooz-net-label');
    const periodName = showingAll
        ? 'All'
        : (dateFilter === localISODate() ? "Today's" : formatDisplayDate(dateFilter));
    if (incomeLabel) incomeLabel.textContent = `${periodName} Income`;
    if (expenseLabel) expenseLabel.textContent = `${periodName} Out`;
    if (billsLabel) billsLabel.textContent = `${periodName} Bills Banam`;
    if (netLabel) netLabel.textContent = `${periodName} Cash Net`;

    if (todayIncomeEl) todayIncomeEl.textContent = `${currency} ${periodStats.income.toLocaleString()}`;
    if (todayExpenseEl) todayExpenseEl.textContent = `${currency} ${periodStats.expense.toLocaleString()}`;
    if (todayBillsEl) todayBillsEl.textContent = `${currency} ${periodStats.bills.toLocaleString()}`;
    if (todayNetEl) {
        todayNetEl.textContent = `${currency} ${Math.abs(periodStats.net).toLocaleString()}`;
        todayNetEl.className = `value ${periodStats.net >= 0 ? 'positive' : 'negative'}`;
    }

    const renderRoozRow = (t) => {
        const customer = t.customerId ? db.data.customers.find(c => c.id === t.customerId) : null;
        const meta = roozRowMeta(t);
        return `
            <tr class="entry-row" data-id="${t.id}">
                <td class="cell-meta">
                    <div style="font-size: 0.75rem; color: var(--text-muted);">#${t.transactionNo || 'N/A'} · Pg ${t.pageNo || '1'}</div>
                    ${formatDisplayDate(t.date)}
                </td>
                <td class="cell-title">
                    <div>${t.description || 'No description'}</div>
                    ${customer ? `
                        <div style="margin-top: 5px;">
                            <span class="khata-side-badge ${meta.badge}">${meta.badgeText}</span>
                            <span class="print-khata-no">#${escapeHtml(customer.khataNo)}</span>
                            <span style="color: var(--primary); font-size: 0.85rem; margin-left: 5px;">${escapeHtml(customer.name)}</span>
                        </div>
                    ` : meta.kind === 'bill' ? `<div style="margin-top: 5px;"><span class="khata-side-badge banam">Banam</span></div>` : ''}
                </td>
                <td class="cell-sub"><span class="badge ${meta.kind}">${t.category}</span></td>
                <td class="cell-amount ${meta.amountClass}">
                    ${meta.sign ? `${meta.sign} ` : ''}${currency} ${t.amount.toLocaleString()}
                </td>
                <td class="cell-muted">${meta.typeLabel}</td>
                <td class="cell-actions no-print">
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
        const meta = roozRowMeta(t);
        return `
            <tr class="entry-row" data-id="${t.id}">
                <td class="cell-meta">${formatDisplayDate(t.date)}</td>
                <td class="cell-title">
                    <div>${t.description || 'No description'}</div>
                    ${customer ? `<div style="margin-top: 5px; color: var(--primary); font-size: 0.85rem;"><span class="khata-side-badge ${meta.badge}">${meta.badgeText}</span> ${customer.name}</div>` : ''}
                </td>
                <td class="cell-sub"><span class="badge ${meta.kind}">${t.category}</span></td>
                <td class="cell-amount ${meta.amountClass}">
                    ${meta.sign ? `${meta.sign} ` : ''}${currency} ${t.amount.toLocaleString()}
                </td>
                <td class="cell-actions no-print">
                    <button type="button" class="btn-delete btn-delete-entry" data-id="${t.id}" title="Delete" aria-label="Delete entry">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            </tr>
        `;
    };

    if (recentList) {
        recentList.innerHTML = recentTransactions.length === 0 ? '<tr class="empty-row"><td colspan="5" class="text-center">No recent transactions</td></tr>' : recentTransactions.slice(0, 5).map(renderRecentRow).join('');
    }
    if (rooznamchaList) {
        rooznamchaList.innerHTML = roozViewTransactions.length === 0 ? '<tr class="empty-row"><td colspan="6" class="text-center">No transactions recorded</td></tr>' : roozViewTransactions.map(renderRoozRow).join('');
    }
}

function updateCustomerLists() {
    const currency = db.data.settings.currency || 'Rs.';
    const topCustomers = document.getElementById('top-customers-list');
    const khataList = document.getElementById('customers-list');
    
    if (!topCustomers && !khataList) return;

    const customers = [...db.data.customers].sort((a,b) => Math.abs(b.balance) - Math.abs(a.balance));
    const visible = customers.filter(c => {
        if (khataPartyFilter === 'collect') return c.balance > 0;
        if (khataPartyFilter === 'pay') return c.balance < 0;
        if (khataPartyFilter === 'customer') return partyRole(c) === 'customer';
        if (khataPartyFilter === 'supplier') return partyRole(c) === 'supplier';
        return true;
    });
    
    if (topCustomers) {
        const top = customers.filter(c => c.balance !== 0).slice(0, 5);
        topCustomers.innerHTML = top.length === 0 ? '<p class="empty-state">No pending khata yet.</p>' : top.map(c => `
            <div class="customer-item" data-id="${c.id}" role="button" tabindex="0">
                <div class="cust-info">
                    <span class="cust-name">${escapeHtml(c.name)}</span>
                    <span class="cust-phone">${banamJamaStatus(c.balance)}</span>
                </div>
                <div class="cust-side">
                    <span class="cust-balance ${c.balance >= 0 ? 'plus' : 'minus'}">
                        ${currency} ${Math.abs(c.balance).toLocaleString()}
                    </span>
                    <button type="button" class="btn-delete btn-delete-customer" data-id="${c.id}" title="Delete party" aria-label="Delete party">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    if (khataList) {
        khataList.innerHTML = visible.length === 0 ? '<p class="empty-state">No parties found.</p>' : visible.map(c => {
            const status = banamJamaStatus(c.balance);
            const tone = c.balance > 0 ? 'due' : c.balance < 0 ? 'pay' : 'clear';
            return `
            <button type="button" class="party-item customer-row" data-id="${c.id}">
                <div class="party-item-info">
                    <span class="party-item-name">${escapeHtml(c.name)}</span>
                    <span class="party-item-sub">${escapeHtml(c.phone || partyRoleLabel(c))} · Khata #${escapeHtml(c.khataNo)}</span>
                </div>
                <div class="party-item-balance ${tone}">
                    <strong>${escapeHtml(currency)} ${formatAmount(Math.abs(c.balance))}</strong>
                    <span>${status}</span>
                </div>
            </button>
        `;
        }).join('');
    }
}

function stockStatus(item) {
    const qty = Number(item.qty) || 0;
    const minQty = Number(item.minQty) || 0;
    if (qty <= 0) return 'out';
    if (minQty > 0 && qty <= minQty) return 'low';
    return 'ok';
}

function filterStockList(query) {
    const q = (query || '').toLowerCase();
    document.querySelectorAll('#stock-list .stock-item').forEach(row => {
        row.style.display = !q || row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
}

function updateStockList() {
    const listEl = document.getElementById('stock-list');
    if (!listEl) return;
    const currency = db.data.settings.currency || 'Rs.';
    const stats = db.getStockStats();
    const countEl = document.getElementById('stock-count');
    const valueEl = document.getElementById('stock-value');
    const alertsEl = document.getElementById('stock-alerts');
    if (countEl) countEl.textContent = String(stats.count);
    if (valueEl) valueEl.textContent = formatMoney(stats.value, currency);
    if (alertsEl) alertsEl.textContent = String(stats.low + stats.out);

    const items = [...(db.data.stock || [])].sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const visible = items.filter(item => {
        const status = stockStatus(item);
        if (stockFilter === 'low') return status === 'low';
        if (stockFilter === 'out') return status === 'out';
        return true;
    });

    if (!visible.length) {
        listEl.innerHTML = '<p class="empty-state">No stock items yet. Tap Add Item to start.</p>';
        return;
    }

    listEl.innerHTML = visible.map(item => {
        const qty = Number(item.qty) || 0;
        const unit = item.unit || 'pcs';
        const status = stockStatus(item);
        const value = qty * (Number(item.buyPrice) || 0);
        const badge = status === 'out' ? 'Out' : status === 'low' ? 'Low' : 'In stock';
        return `
            <div class="stock-item ${status}">
                <div class="stock-item-main">
                    <div class="stock-item-top">
                        <strong class="stock-item-name">${escapeHtml(item.name)}</strong>
                        <span class="stock-badge ${status}">${badge}</span>
                    </div>
                    <div class="stock-item-meta">
                        Buy ${escapeHtml(currency)} ${formatAmount(item.buyPrice || 0)}
                        ${item.sellPrice ? ` · Sell ${escapeHtml(currency)} ${formatAmount(item.sellPrice)}` : ''}
                        ${value ? ` · Value ${escapeHtml(currency)} ${formatAmount(value)}` : ''}
                    </div>
                </div>
                <div class="stock-item-qty">
                    <strong>${formatAmount(qty)}</strong>
                    <span>${escapeHtml(unit)}</span>
                </div>
                <div class="stock-item-actions">
                    <button type="button" class="btn-stock-in" data-id="${item.id}">In</button>
                    <button type="button" class="btn-stock-out" data-id="${item.id}">Out</button>
                    <button type="button" class="btn-icon btn-edit-stock" data-id="${item.id}" title="Edit" aria-label="Edit item"><i class="fas fa-pen"></i></button>
                    <button type="button" class="btn-delete btn-delete-stock" data-id="${item.id}" title="Delete" aria-label="Delete item"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
        `;
    }).join('');
}

function filterBillsList(query) {
    const q = (query || '').toLowerCase();
    document.querySelectorAll('#bills-list .bill-group, #bills-list .bill-item').forEach(row => {
        if (row.closest('.bill-group') && row.classList.contains('bill-item')) return;
        row.style.display = !q || row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
}

function billGroupKey(bill) {
    if (bill.containerGroupId) return `g:${bill.containerGroupId}`;
    const container = String(bill.containerNo || '').trim().toLowerCase();
    if (!container) return `b:${bill.id}`;
    return `c:${bill.date || ''}|${container}|${String(bill.entryNo || '').trim().toLowerCase()}`;
}

function billListRowHtml(bill, currency, { compact } = {}) {
    const party = db.data.customers.find(c => c.id == bill.customerId);
    const items = (bill.items || []).map(i => billItemView(i).name).filter(Boolean).slice(0, 2).join(', ');
    const meta = compact
        ? `#${bill.billNo}${items ? ` · ${items}` : ''}`
        : [
            `#${bill.billNo}`,
            formatDisplayDate(bill.date),
            bill.entryNo && `B/E ${bill.entryNo}`,
            bill.containerNo && `Cont ${bill.containerNo}`,
            items
        ].filter(Boolean).join(' · ');
    return `
        <div class="bill-item${compact ? ' compact' : ''}" data-id="${bill.id}" role="button" tabindex="0">
            <div class="bill-item-main">
                <div class="bill-item-top">
                    <strong>${escapeHtml(party?.name || 'Party removed')}</strong>
                    <span class="bill-item-meta">${escapeHtml(meta)}</span>
                </div>
            </div>
            <div class="bill-item-total">
                <strong>${escapeHtml(currency)} ${formatAmount(bill.total)}</strong>
            </div>
            <div class="bill-item-actions">
                <button type="button" class="btn-icon btn-edit-bill" data-id="${bill.id}" title="Edit bill" aria-label="Edit bill"><i class="fas fa-pen"></i></button>
                <button type="button" class="btn-icon btn-view-bill" data-id="${bill.id}" title="View / Print" aria-label="View bill"><i class="fas fa-print"></i></button>
                <button type="button" class="btn-delete btn-delete-bill" data-id="${bill.id}" title="Delete bill" aria-label="Delete bill"><i class="fas fa-trash-alt"></i></button>
            </div>
        </div>
    `;
}

function updateBillsList() {
    const listEl = document.getElementById('bills-list');
    if (!listEl) return;
    const currency = db.data.settings.currency || 'Rs.';
    const stats = db.getBillStats();
    const countEl = document.getElementById('bills-count');
    const totalEl = document.getElementById('bills-total');
    if (countEl) countEl.textContent = String(stats.count);
    if (totalEl) totalEl.textContent = formatMoney(stats.total, currency);

    const bills = [...(db.data.bills || [])].sort((a, b) => (Number(b.billNo) || 0) - (Number(a.billNo) || 0));
    if (!bills.length) {
        listEl.innerHTML = '<p class="empty-state">No bills yet. Tap New Bill. One container with many parties can be billed together.</p>';
        return;
    }

    const groups = [];
    const index = new Map();
    bills.forEach(bill => {
        const key = billGroupKey(bill);
        if (!index.has(key)) {
            const group = { key, bills: [] };
            index.set(key, group);
            groups.push(group);
        }
        index.get(key).bills.push(bill);
    });

    listEl.innerHTML = groups.map(group => {
        const list = group.bills.sort((a, b) => (Number(a.billNo) || 0) - (Number(b.billNo) || 0));
        if (list.length === 1) return billListRowHtml(list[0], currency);
        const first = list[0];
        const total = list.reduce((sum, bill) => sum + (Number(bill.total) || 0), 0);
        const ids = list.map(bill => bill.id).join(',');
        return `
            <div class="bill-group">
                <div class="bill-group-head">
                    <div class="bill-item-top">
                        <strong>${escapeHtml(first.containerNo || 'Container')}</strong>
                        <span class="bill-item-meta">${escapeHtml([
                            formatDisplayDate(first.date),
                            first.entryNo && `B/E ${first.entryNo}`,
                            `${list.length} parties`
                        ].filter(Boolean).join(' · '))}</span>
                    </div>
                    <div class="bill-item-total">
                        <strong>${escapeHtml(currency)} ${formatAmount(total)}</strong>
                    </div>
                    <button type="button" class="btn-icon btn-print-container" data-ids="${ids}" title="Print all" aria-label="Print all bills"><i class="fas fa-print"></i></button>
                </div>
                <div class="bill-group-body">
                    ${list.map(bill => billListRowHtml(bill, currency, { compact: true })).join('')}
                </div>
            </div>
        `;
    }).join('');
}

function billPrintHtml(bill) {
    const party = db.data.customers.find(c => c.id == bill.customerId);
    const currency = db.data.settings.currency || 'Rs.';
    const shopName = db.data.settings.shopName || 'My Business';
    const items = (bill.items || []).map(billItemView);
    let totalCtns = 0;
    const rows = items.length
        ? items.map((item, i) => {
            totalCtns += item.ctns;
            const meta = [
                item.ctns ? `${formatAmount(item.ctns)} cartons` : '',
                item.qty ? `${formatAmount(item.qty)} ${item.qtyLabel}` : '',
                item.rate ? `${formatAmount(item.rate)} ${item.unitLabel}` : ''
            ].filter(Boolean).join(' · ');
            return `
            <tr class="${i % 2 ? 'alt' : ''}">
                <td class="goods">
                    <strong>${escapeHtml(item.name)}</strong>
                    ${meta ? `<div class="goods-meta">${escapeHtml(meta)}</div>` : ''}
                </td>
                <td class="num hide-phone">${item.ctns ? formatAmount(item.ctns) : '—'}</td>
                <td class="num hide-phone">${item.qty ? `${formatAmount(item.qty)} ${escapeHtml(item.qtyLabel)}` : '—'}</td>
                <td class="num hide-phone">${item.rate ? `${formatAmount(item.rate)} ${escapeHtml(item.unitLabel)}` : '—'}</td>
                <td class="num amount">${escapeHtml(currency)} ${formatAmount(item.amount)}</td>
            </tr>`;
        }).join('')
        : '<tr><td class="goods" colspan="5">No goods on this bill</td></tr>';

    const ship = [
        ['Date', formatDisplayDate(bill.date)],
        bill.entryNo ? ['Bill of Entry', bill.entryNo] : null,
        bill.containerNo ? ['Container', bill.containerNo] : null,
        bill.vehicleNo ? ['Vehicle', bill.vehicleNo] : null
    ].filter(Boolean);

    return `
        <article class="print-report invoice-print">
            <header class="invoice-head">
                <div class="invoice-brand">
                    <div class="invoice-shop">${escapeHtml(shopName)}</div>
                    <div class="invoice-tag">INVOICE</div>
                </div>
                <div class="invoice-meta">
                    <div><span>Bill No</span><strong>#${escapeHtml(bill.billNo)}</strong></div>
                    <div><span>Date</span><strong>${escapeHtml(formatDisplayDate(bill.date))}</strong></div>
                </div>
            </header>
            <section class="invoice-who">
                <div>
                    <span>Bill to</span>
                    <strong>${escapeHtml(party?.name || 'Party')}</strong>
                    <em>${[
                        party?.khataNo ? `Khata #${party.khataNo}` : '',
                        party?.phone || ''
                    ].filter(Boolean).map(escapeHtml).join(' · ')}</em>
                </div>
                <div class="invoice-total-box">
                    <span>Total</span>
                    <strong>${escapeHtml(currency)} ${formatAmount(bill.total)}</strong>
                    <em>Banam on this khata</em>
                </div>
            </section>
            ${ship.length ? `<section class="invoice-ship">${ship.map(([label, value]) => `
                <div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>
            `).join('')}</section>` : ''}
            <table class="invoice-goods">
                <thead>
                    <tr>
                        <th>Goods</th>
                        <th class="num hide-phone">Cartons</th>
                        <th class="num hide-phone">Qty</th>
                        <th class="num hide-phone">Rate</th>
                        <th class="num">Amount</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            <div class="invoice-grand">
                <span>Grand total</span>
                <strong>${escapeHtml(currency)} ${formatAmount(bill.total)}</strong>
            </div>
            ${totalCtns ? `<p class="invoice-note">Cartons in this bill: ${formatAmount(totalCtns)}</p>` : ''}
            ${bill.note ? `<p class="invoice-note">Note: ${escapeHtml(bill.note)}</p>` : ''}
            <p class="invoice-banam">This ${escapeHtml(currency)} ${formatAmount(bill.total)} is Banam on ${escapeHtml(party?.name || 'the party')}'s khata. They owe this amount.</p>
            <div class="invoice-signs">
                <div>
                    <div class="sign-line"></div>
                    <span>Customer sign</span>
                </div>
                <div>
                    <div class="sign-line"></div>
                    <span>Shop sign</span>
                </div>
            </div>
        </article>
    `;
}

function containerPrintCoverHtml(bills) {
    const list = bills || [];
    if (!list.length) return '';
    const first = list[0];
    const currency = db.data.settings.currency || 'Rs.';
    const shopName = db.data.settings.shopName || 'My Business';
    const total = list.reduce((sum, bill) => sum + (Number(bill.total) || 0), 0);
    const rows = list.map((bill, i) => {
        const party = db.data.customers.find(c => c.id == bill.customerId);
        return `
            <tr class="${i % 2 ? 'alt' : ''}">
                <td>${escapeHtml(party?.name || 'Party')}</td>
                <td>Bill #${escapeHtml(bill.billNo)}</td>
                <td class="num">${escapeHtml(currency)} ${formatAmount(bill.total)}</td>
            </tr>`;
    }).join('');
    const ship = [
        first.containerNo ? ['Container', first.containerNo] : ['Container', '—'],
        first.entryNo ? ['Bill of Entry', first.entryNo] : null,
        ['Date', formatDisplayDate(first.date)],
        ['Parties', String(list.length)]
    ].filter(Boolean);

    return `
        <article class="print-report invoice-print invoice-cover">
            <header class="invoice-head">
                <div class="invoice-brand">
                    <div class="invoice-shop">${escapeHtml(shopName)}</div>
                    <div class="invoice-tag">CONTAINER</div>
                </div>
                <div class="invoice-meta">
                    <div><span>Parties</span><strong>${list.length}</strong></div>
                    <div><span>Date</span><strong>${escapeHtml(formatDisplayDate(first.date))}</strong></div>
                </div>
            </header>
            <section class="invoice-ship">${ship.map(([label, value]) => `
                <div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>
            `).join('')}</section>
            <table class="invoice-goods">
                <thead>
                    <tr>
                        <th>Party</th>
                        <th>Bill</th>
                        <th class="num">Amount</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            <div class="invoice-grand">
                <span>Container total</span>
                <strong>${escapeHtml(currency)} ${formatAmount(total)}</strong>
            </div>
            <p class="invoice-banam">Each party bill below is Banam on that khata. Next pages are the invoices.</p>
        </article>
    `;
}

function printBill(billId) {
    const bill = (db.data.bills || []).find(b => b.id == billId);
    if (!bill) return;
    showPrintPreview(billPrintHtml(bill), `Invoice #${bill.billNo}`, 'Check the bill, then tap Print');
}

function printBills(ids, title) {
    const list = (ids || [])
        .map(id => (db.data.bills || []).find(b => b.id == id))
        .filter(Boolean);
    if (!list.length) return;
    if (list.length === 1) {
        printBill(list[0].id);
        return;
    }
    showPrintPreview(
        containerPrintCoverHtml(list) + list.map(billPrintHtml).join(''),
        title || `Container · ${list.length} invoices`,
        'First page is the container total. Next pages are each party invoice.'
    );
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
    }, 2500);
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
