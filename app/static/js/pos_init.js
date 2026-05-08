/**
 * pos_init.js — Bootstrap / orchestration module for the DataXPOS POS interface.
 *
 * Responsibilities:
 *   - Auth guard (redirect to /auth if no token)
 *   - Global state initialization (caches, flags)
 *   - Manager instantiation (CartManager, PaymentManager)
 *   - Module wiring: initPosUI, initPosPayments, initPosSession
 *   - Post-sale button bindings (print, reprint, next-sale)
 *   - Keyboard shortcuts (F2 / F4 / F6 / F8 / Escape / Ctrl+R)
 *   - Initial data load (session + catalogue)
 *
 * Dependencies (must load before this file):
 *   pos_core.js, pos_ui.js, pos_printing.js, pos_parked.js,
 *   pos_session.js, pos_payments.js
 *
 * Jinja bridge: pos.html sets window.POS_SESSION_ID before this script loads.
 */
(function (window) {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {

        // ── Verify critical POS components ─────────────────────────────────────
        ['search-input', 'search-results', 'ticket-items', 'ticket-total'].forEach(function (id) {
            if (!document.getElementById(id)) console.error('[POS] Critical element #' + id + ' missing');
        });

        // ── Auth guard ──────────────────────────────────────────────────────────
        const ACCESS_TOKEN = sessionStorage.getItem('ACCESS_TOKEN');
        if (!ACCESS_TOKEN) {
            window.location.href = '/auth';
            return;
        }

        // ── Global state ────────────────────────────────────────────────────────
        window.CURRENT_CUSTOMER         = null;
        window.CURRENT_PENDING_SALE_ID  = null;
        window.LAST_SUCCESSFUL_SALE     = null;
        window.LAST_CLOSED_SESSION_ID   = null;
        window._catalogCache            = [];          // base-query catalogue cache
        window._productCache            = new Map();   // per-id product cache

        // Restore last sale from sessionStorage so reprint works after page reload
        var _savedSaleId = sessionStorage.getItem('POS_LAST_SALE_ID');
        if (_savedSaleId) window.LAST_SUCCESSFUL_SALE = { sale_id: _savedSaleId };

        // Session ID bridged from Jinja via window.POS_SESSION_ID (set in pos.html)
        window.CURRENT_CASH_SESSION_ID = window.POS_SESSION_ID || null;

        // ── Manager instantiation ───────────────────────────────────────────────
        var cartManager    = new window.CartManager(window.renderCart, window.updateSummary);
        var paymentManager = new window.PaymentManager();

        // Expose on window so other modules and inline handlers can access them
        window.cartManager    = cartManager;
        window.paymentManager = paymentManager;

        // ── Module wiring (order matters) ───────────────────────────────────────
        window.initPosUI(cartManager);   // UI event listeners, search, cart delegation
        window.initPosPayments();        // payment modal bindings
        window.initPosSession();         // session open/close, pending orders, returns

        // ── Post-sale button wiring ─────────────────────────────────────────────
        var printTicketBtn = document.getElementById('print-ticket-button');
        if (printTicketBtn) {
            printTicketBtn.onclick = function () {
                if (window.LAST_SUCCESSFUL_SALE) {
                    window.handlePrinting(window.LAST_SUCCESSFUL_SALE.sale_id, this);
                }
            };
        }

        var reprintBtn = document.getElementById('reprint-last-btn');
        if (reprintBtn) {
            reprintBtn.onclick = function () {
                if (window.LAST_SUCCESSFUL_SALE) {
                    window.handlePrinting(window.LAST_SUCCESSFUL_SALE.sale_id, this);
                } else {
                    window.showAlert('Aviso', 'No hay venta reciente.', 'warning');
                }
            };
        }

        var nextSaleBtn = document.getElementById('next-sale-button');
        if (nextSaleBtn) {
            nextSaleBtn.onclick = function () {
                window.hideModal(document.getElementById('success-modal'));
                document.getElementById('search-input').focus();
            };
        }

        // ── Keyboard shortcuts ──────────────────────────────────────────────────
        document.addEventListener('keydown', function (e) {
            var tag = document.activeElement && document.activeElement.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

            if (e.ctrlKey && e.key === 'r') {
                e.preventDefault();
                if (window.CURRENT_CASH_SESSION_ID) {
                    var returnsBtn = document.getElementById('returns-btn');
                    if (returnsBtn) returnsBtn.click();
                }
            } else if (e.key === 'F2') {
                e.preventDefault();
                var searchInput = document.getElementById('search-input');
                if (searchInput) searchInput.focus();
            } else if (e.key === 'F4') {
                e.preventDefault();
                if (cartManager.cart.length === 0) return;
                if (!window.CURRENT_CASH_SESSION_ID) return;
                var cashModal = document.getElementById('cash-modal');
                if (!cashModal || cashModal.classList.contains('hidden') === false) return;
                window.showModal(cashModal);
            } else if (e.key === 'F6') {
                e.preventDefault();
                window.renderParkedSales();
                window.showModal(document.getElementById('parked-sales-modal'));
            } else if (e.key === 'F8') {
                e.preventDefault();
                window.parkSale();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                var modals = Array.from(document.querySelectorAll('.fixed.inset-0.flex'));
                if (modals.length > 0) {
                    window.hideModal(modals[modals.length - 1]);
                }
            }
        });

        // ── Initial data load ───────────────────────────────────────────────────
        Promise.all([
            window.checkSession(),
            window.SalesApi.searchProducts('').then(function (products) {
                window._catalogCache = products;
                window.renderSearchResults(products);
            })
        ]).catch(function (e) {
            console.error('POS init error', e);
        });

    });

})(window);
