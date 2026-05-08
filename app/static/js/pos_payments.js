/**
 * pos_payments.js — Payment processing for Atlas POS
 *
 * Extracted from pos.html. Handles cash, card, transfer, and mixed payment
 * modals, plus finalizeSale() (the main sale-submission function).
 *
 * Dependencies (must be loaded before this file):
 *   - pos_core.js       (CartManager, PaymentManager, POSFormatters, SalesApi)
 *   - pos_printing.js   (window.handlePrinting)
 *   - pos_session.js    (window.fetchCloudCommandas)
 *
 * Globals consumed via window:
 *   window.cartManager, window.paymentManager
 *   window.showModal, window.hideModal, window.showAlert, window.askQuantity
 *   window.CURRENT_CASH_SESSION_ID, window.CURRENT_PENDING_SALE_ID
 *   window.CURRENT_CUSTOMER, window.handlePrinting, window.fetchCloudCommandas
 */
(function (window) {
    'use strict';

    // ── Private state ──────────────────────────────────────────────────────
    let currentMixedMethod = 'CASH';
    let _isProcessingSale = false;

    // ── Cart helper ────────────────────────────────────────────────────────

    async function editCartItemQty(lineId, current) {
        const q = await window.askQuantity("Editar Cantidad", current);
        if (q !== null && q !== current) {
            window.cartManager.updateQty(lineId, q, false);
        }
    }

    // ── Cash Modal ─────────────────────────────────────────────────────────

    function openCashModal() {
        const isInvoice = document.getElementById('requires-invoice-toggle')?.checked || false;
        const t = window.cartManager.getTotals(isInvoice).total;
        if (t <= 0) return;
        document.getElementById('cash-modal-total-display').textContent = POSFormatters.money(t);
        document.getElementById('cash-modal-amount').value = '';
        updateCashChange(); // reset
        window.showModal(document.getElementById('cash-modal'));
        setTimeout(() => document.getElementById('cash-modal-amount').focus(), 100);
    }

    function updateCashChange() {
        const t = window.cartManager.getTotals(document.getElementById('requires-invoice-toggle')?.checked).total;
        const val = parseFloat(document.getElementById('cash-modal-amount').value) || 0;
        const diff = Math.round((val - t) * 100) / 100;
        const changeDisplay = document.getElementById('cash-modal-change');
        const btn = document.getElementById('cash-modal-submit-btn');

        if (diff >= 0) {
            changeDisplay.textContent = POSFormatters.money(diff);
            changeDisplay.className = "text-2xl font-bold text-emerald-400";
            btn.disabled = false;
        } else {
            changeDisplay.textContent = POSFormatters.money(Math.abs(diff));
            changeDisplay.className = "text-2xl font-bold text-rose-400";
            btn.disabled = true;
        }
    }

    function addDenomination(val) {
        const el = document.getElementById('cash-modal-amount');
        const current = Math.round(parseFloat(el.value || 0) * 100) / 100;
        el.value = (Math.round((current + val) * 100) / 100).toFixed(2);
        updateCashChange();
    }

    function setExactAmount() {
        const t = window.cartManager.getTotals(document.getElementById('requires-invoice-toggle')?.checked).total;
        document.getElementById('cash-modal-amount').value = t.toFixed(2);
        updateCashChange();
    }

    function clearReceived() {
        document.getElementById('cash-modal-amount').value = '';
        updateCashChange();
    }

    async function submitCashPayment() {
        const amount = parseFloat(document.getElementById('cash-modal-amount').value);
        const shouldPrint = document.getElementById('cash-print-ticket')?.checked || false;
        await finalizeSale([{ method: 'CASH', amount: amount }], shouldPrint);
        window.hideModal(document.getElementById('cash-modal'));
    }

    // ── Card Modal ─────────────────────────────────────────────────────────

    function openCardModal() {
        const t = window.cartManager.getTotals(document.getElementById('requires-invoice-toggle')?.checked).total;
        if (t <= 0) return;
        document.getElementById('card-modal-total-display').textContent = POSFormatters.money(t);
        document.getElementById('card-modal-ref').value = '';
        window.showModal(document.getElementById('card-modal'));
    }

    async function submitCardPayment() {
        const t = window.cartManager.getTotals(document.getElementById('requires-invoice-toggle')?.checked).total;
        const ref = document.getElementById('card-modal-ref').value;
        await finalizeSale([{ method: 'CARD', amount: t, reference: ref }], true);
        window.hideModal(document.getElementById('card-modal'));
    }

    // ── Transfer Modal ─────────────────────────────────────────────────────

    function openTransferModal() {
        const t = window.cartManager.getTotals(document.getElementById('requires-invoice-toggle')?.checked).total;
        if (t <= 0) return;
        document.getElementById('transfer-modal-total-display').textContent = POSFormatters.money(t);
        document.getElementById('transfer-modal-ref').value = '';
        window.showModal(document.getElementById('transfer-modal'));
    }

    async function submitTransferPayment() {
        const t = window.cartManager.getTotals(document.getElementById('requires-invoice-toggle')?.checked).total;
        const ref = document.getElementById('transfer-modal-ref').value;
        if (!ref) {
            window.showAlert('Campo requerido', 'La referencia es obligatoria para transferencias.', 'error');
            return;
        }
        await finalizeSale([{ method: 'TRANSFER', amount: t, reference: ref }], true);
        window.hideModal(document.getElementById('transfer-modal'));
    }

    // ── Mixed Payment Modal ────────────────────────────────────────────────

    function openMixedModal() {
        const t = window.cartManager.getTotals(document.getElementById('requires-invoice-toggle')?.checked).total;
        if (t <= 0) return;
        window.paymentManager.clear();
        document.getElementById('mixed-modal-total-display').textContent = POSFormatters.money(t);
        document.getElementById('mixed-amount-input').value = '';
        document.getElementById('mixed-ref-input').value = '';
        selectMixedMethod('CASH');
        updateMixedUI();
        window.showModal(document.getElementById('mixed-modal'));
    }

    function selectMixedMethod(method) {
        currentMixedMethod = method;
        const btns = { 'CASH': 'btn-mixed-cash', 'CARD': 'btn-mixed-card', 'TRANSFER': 'btn-mixed-transfer' };
        Object.keys(btns).forEach(k => {
            const el = document.getElementById(btns[k]);
            if (k === method) {
                el.className = "py-3 px-4 rounded-xl bg-indigo-600 text-white font-bold text-xs ring-2 ring-indigo-400 transition";
            } else {
                el.className = "py-3 px-4 rounded-xl pos-method-tab font-bold text-xs transition";
            }
        });
        const refCont = document.getElementById('mixed-ref-container');
        if (method === 'CASH') refCont.classList.add('hidden');
        else refCont.classList.remove('hidden');
    }

    function addMixedPayment() {
        const totalDue = window.cartManager.getTotals(document.getElementById('requires-invoice-toggle')?.checked).total;
        const amount = parseFloat(document.getElementById('mixed-amount-input').value) || 0;
        const ref = document.getElementById('mixed-ref-input').value;

        if (amount <= 0) return;

        const paidSoFar = window.paymentManager.getTotalPaid();
        const remaining = totalDue - paidSoFar;

        // Validate: only cash can exceed remaining (to give change)
        if (currentMixedMethod !== 'CASH' && amount > (remaining + 0.01)) {
            window.showAlert("Atención", "El monto digital no puede exceder el total de la venta.", "warning");
            return;
        }

        window.paymentManager.addPayment(currentMixedMethod, amount, ref);

        document.getElementById('mixed-amount-input').value = '';
        document.getElementById('mixed-ref-input').value = '';
        updateMixedUI();
    }

    function removeMixedPayment(index) {
        window.paymentManager.removePayment(index);
        updateMixedUI();
    }

    const _methodLabels = { CASH: 'Efectivo', CARD: 'Tarjeta', TRANSFER: 'Transferencia', OTHER: 'Otro' };

    function updateMixedUI() {
        const totalDue = window.cartManager.getTotals(document.getElementById('requires-invoice-toggle')?.checked).total;
        const paid = window.paymentManager.getTotalPaid();
        const pending = Math.max(0, totalDue - paid);
        const change = Math.max(0, paid - totalDue);

        document.getElementById('mixed-paid-display').textContent = POSFormatters.money(paid);
        document.getElementById('mixed-pending-display').textContent = POSFormatters.money(pending);

        const changeRow = document.getElementById('mixed-change-row');
        if (change > 0) {
            changeRow.classList.remove('hidden');
            document.getElementById('mixed-change-display').textContent = POSFormatters.money(change);
        } else {
            changeRow.classList.add('hidden');
        }

        // Render list
        const list = document.getElementById('mixed-payments-list');
        list.innerHTML = '';
        window.paymentManager.payments.forEach((p, idx) => {
            const el = document.createElement('div');
            el.className = "flex justify-between items-center pos-payment-row p-2 rounded-lg";
            el.innerHTML = `
                <div class="flex flex-col">
                    <span class="text-[10px] font-medium text-slate-500 uppercase">${_methodLabels[p.method] || p.method}</span>
                    <span class="text-xs font-bold text-white">${POSFormatters.money(p.amount)}</span>
                </div>
                <button onclick="window.removeMixedPayment(${idx})" class="text-rose-500 p-1 hover:bg-rose-500/10 rounded">✕</button>
            `;
            list.appendChild(el);
        });

        document.getElementById('mixed-submit-btn').disabled = (paid < (totalDue - 0.01));
    }

    async function submitMixedPayment() {
        await finalizeSale([...window.paymentManager.payments], true);
        window.hideModal(document.getElementById('mixed-modal'));
    }

    // ── Core sale submission ───────────────────────────────────────────────

    async function finalizeSale(payments, print = false) {
        // Double-submit protection
        if (_isProcessingSale) return;
        _isProcessingSale = true;

        // Disable all payment buttons while processing
        const payBtns = document.querySelectorAll('#pay-cash-button, #pay-card-button, #pay-transfer-button, #pay-mixed-button, #cash-modal-submit-btn, #mixed-submit-btn');
        payBtns.forEach(b => { if (b) b.disabled = true; });

        const totals = window.cartManager.getTotals(document.getElementById('requires-invoice-toggle')?.checked);
        const payload = {
            id: window.CURRENT_PENDING_SALE_ID || null,
            customer_id: window.CURRENT_CUSTOMER?.id || null,
            customer_name: window.CURRENT_CUSTOMER?.name || null,
            requires_invoice: document.getElementById('requires-invoice-toggle')?.checked || false,
            items: window.cartManager.cart.map(i => ({
                sku: i.sku,
                quantity: i.qty,
                unit_price: i.unit_price,
                notes: i.override_reason
            })),
            payments: payments
        };

        try {
            const res = await SalesApi.createSale(payload);
            window.LAST_SUCCESSFUL_SALE = res;
            sessionStorage.setItem('POS_LAST_SALE_ID', res.sale_id);

            // Show Success Modal
            document.getElementById('success-folio').textContent = `Folio: ${res.folio}`;
            document.getElementById('success-total-paid').textContent = POSFormatters.money(payments.reduce((a, b) => a + b.amount, 0));
            document.getElementById('success-change').textContent = POSFormatters.money(res.change);
            window.showModal(document.getElementById('success-modal'));

            window.CURRENT_PENDING_SALE_ID = null;
            window.fetchCloudCommandas();

            window.cartManager.clear();
            window.paymentManager.clear();

            if (print) {
                const btn = document.getElementById('print-ticket-button');
                window.handlePrinting(res.sale_id, btn);
            }

        } catch (e) {
            window.showAlert("Error", "Error al cobrar: " + e.message, "error");
        } finally {
            _isProcessingSale = false;
            payBtns.forEach(b => { if (b) b.disabled = false; });
        }
    }

    // ── Event listener wiring ─────────────────────────────────────────────

    window.initPosPayments = function () {
        document.getElementById('pay-cash-button').onclick = window.openCashModal;
        document.getElementById('pay-card-button').onclick = window.openCardModal;
        document.getElementById('pay-transfer-button').onclick = window.openTransferModal;
        document.getElementById('pay-mixed-button').onclick = window.openMixedModal;
    };

    // ── Public API ────────────────────────────────────────────────────────
    window.editCartItemQty      = editCartItemQty;
    window.openCashModal        = openCashModal;
    window.updateCashChange     = updateCashChange;
    window.addDenomination      = addDenomination;
    window.setExactAmount       = setExactAmount;
    window.clearReceived        = clearReceived;
    window.submitCashPayment    = submitCashPayment;
    window.openCardModal        = openCardModal;
    window.submitCardPayment    = submitCardPayment;
    window.openTransferModal    = openTransferModal;
    window.submitTransferPayment = submitTransferPayment;
    window.openMixedModal       = openMixedModal;
    window.selectMixedMethod    = selectMixedMethod;
    window.addMixedPayment      = addMixedPayment;
    window.removeMixedPayment   = removeMixedPayment;
    window.submitMixedPayment   = submitMixedPayment;
    window.finalizeSale         = finalizeSale;

})(window);
