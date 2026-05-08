/**
 * pos_session.js — Session, Customer, Cloud Orders, Cash Movements, Returns
 * Extracted from pos.html — Sprint 6 JS modularization
 *
 * Depends on: SalesApi (pos_core.js), window.cartManager, window.paymentManager
 *             (set up by pos.html DOMContentLoaded before calling initPosSession),
 *             POSFormatters (pos_core.js), window.POS_USER (base_daxpos.html)
 *
 * Exposes on window:
 *   window.initPosSession   — called by pos.html's DOMContentLoaded after managers are ready
 *   window.checkSession
 *   window.clearCurrentCustomer
 *   window.fetchCloudCommandas
 *   window.downloadCutPDF
 *   window.printCutTicket
 *   window.finishCutProcess
 */
(function (window) {
    'use strict';

    function initPosSession() {

        // ── Private state ────────────────────────────────────────────────
        let _custSearchTimer;
        let _loadingPendingSale = false;
        let _currentReturnSale = null;

        // ── Pending Orders Inbox ─────────────────────────────────────────
        async function fetchCloudCommandas() {
            try {
                const data = await SalesApi.fetch('/api/sales/?status=PENDING&limit=50');
                const sales = Array.isArray(data) ? data : (data.items || []);
                renderCloudCommandas(sales);
            } catch (e) {
                console.error('Error fetching pending orders:', e);
            }
        }

        function renderCloudCommandas(sales) {
            const grid = document.getElementById('pending-orders-grid');
            const badge = document.getElementById('orders-count-badge');
            if (!grid) return;

            if (badge) {
                if (sales.length > 0) {
                    badge.textContent = sales.length > 99 ? '99+' : sales.length;
                    badge.classList.remove('hidden');
                } else {
                    badge.classList.add('hidden');
                }
            }

            if (sales.length === 0) {
                grid.innerHTML = '<p class="text-slate-500 text-xs text-center py-8 col-span-full">Sin pedidos pendientes</p>';
                return;
            }

            grid.innerHTML = '';
            sales.forEach(sale => {
                const card = document.createElement('div');
                card.className = 'dax-card p-3 cursor-pointer hover:border-primary-500/60 transition-all';

                const folio = document.createElement('div');
                folio.className = 'text-xs font-bold text-primary-400 mb-1';
                folio.textContent = `${sale.series ?? '?'}-${sale.folio ?? '?'}`;

                const customer = document.createElement('div');
                customer.className = 'text-sm text-white font-semibold truncate';
                customer.textContent = sale.customer_name || 'Público General';

                const total = document.createElement('div');
                total.className = 'text-xs text-slate-400 mt-1';
                total.textContent = `$${Number(sale.total_amount || 0).toFixed(2)}`;

                card.appendChild(folio);
                card.appendChild(customer);
                card.appendChild(total);

                card.addEventListener('click', () => loadCloudSaleToCart(sale.id));
                grid.appendChild(card);
            });
        }

        async function loadCloudSaleToCart(saleId) {
            if (_loadingPendingSale) return;
            _loadingPendingSale = true;
            try {
                const sale = await SalesApi.fetch(`/api/sales/${saleId}`);
                window.cartManager.clear();
                window.paymentManager.clear();

                if (sale.lines && sale.lines.length > 0) {
                    sale.lines.forEach(line => {
                        window.cartManager.addItem({
                            id: line.variant_id,
                            name: line.description,
                            price: line.unit_price,
                            sku: line.sku || '',
                            has_iva: line.has_iva ?? false,
                            tax_rate: line.tax_rate || 0
                        }, line.quantity, line.unit_price);
                    });
                }

                window.CURRENT_PENDING_SALE_ID = sale.id;

                if (sale.customer_id && sale.customer_name) {
                    setCurrentCustomer({ id: sale.customer_id, name: sale.customer_name });
                }

                switchToTab('catalog');
                window.renderCart();
                window.updateSummary();

            } catch (e) {
                console.error('Error loading pending sale:', e);
                if (window.showAlert) window.showAlert('Error al cargar el pedido', 'error');
            } finally {
                _loadingPendingSale = false;
            }
        }

        function switchToTab(tab) {
            const catalogView = document.getElementById('catalog-view');
            const ordersView = document.getElementById('orders-view');
            const catalogBtn = document.getElementById('tab-catalog-btn');
            const ordersBtn = document.getElementById('tab-orders-btn');

            const showCatalog = tab === 'catalog';

            catalogView?.classList.toggle('hidden', !showCatalog);
            ordersView?.classList.toggle('hidden', showCatalog);

            catalogBtn?.classList.toggle('bg-primary-600', showCatalog);
            catalogBtn?.classList.toggle('bg-slate-700', !showCatalog);
            catalogBtn?.classList.toggle('text-white', showCatalog);
            catalogBtn?.classList.toggle('text-slate-300', !showCatalog);

            ordersBtn?.classList.toggle('bg-primary-600', !showCatalog);
            ordersBtn?.classList.toggle('bg-slate-700', showCatalog);
            ordersBtn?.classList.toggle('text-white', !showCatalog);
            ordersBtn?.classList.toggle('text-slate-300', showCatalog);
        }

        // ── Customer Selector ────────────────────────────────────────────
        function setCurrentCustomer(customer) {
            window.CURRENT_CUSTOMER = customer;
            window.cartManager.setCustomer(customer);
            const lbl = document.getElementById('current-customer-label');
            if (lbl) lbl.textContent = customer ? customer.name : 'Público General';
            const clearBtn = document.getElementById('clear-customer-btn');
            if (clearBtn) clearBtn.classList.toggle('hidden', !customer);
        }

        window.clearCurrentCustomer = () => setCurrentCustomer(null);

        function renderCustomerResults(customers) {
            const list = document.getElementById('customer-results-list');
            if (!list) return;
            if (!customers.length) {
                list.innerHTML = '<p class="text-slate-500 text-xs text-center py-4">Sin resultados</p>';
                return;
            }
            list.innerHTML = '';
            customers.forEach(c => {
                const el = document.createElement('button');
                el.type = 'button';
                el.className = 'w-full text-left px-3 py-2 rounded-xl hover:bg-slate-800 transition flex flex-col gap-0.5 group';
                const nameSpan = document.createElement('span');
                nameSpan.className = 'text-sm font-bold text-white group-hover:text-primary-300 transition';
                nameSpan.textContent = c.name;
                el.appendChild(nameSpan);
                if (c.phone) {
                    const phoneSpan = document.createElement('span');
                    phoneSpan.className = 'text-[10px] text-slate-500';
                    phoneSpan.textContent = c.phone;
                    el.appendChild(phoneSpan);
                }
                el.addEventListener('click', () => {
                    setCurrentCustomer({ id: c.id, name: c.name });
                    window.hideModal(document.getElementById('customer-search-modal'));
                });
                list.appendChild(el);
            });
        }

        // Open modal — select-customer-btn
        const _selCustBtn = document.getElementById('select-customer-btn');
        if (_selCustBtn) {
            _selCustBtn.addEventListener('click', () => {
                document.getElementById('customer-search-input').value = '';
                document.getElementById('customer-results-list').innerHTML =
                    '<p class="text-slate-500 text-xs text-center py-4">Escribe para buscar clientes...</p>';
                window.showModal(document.getElementById('customer-search-modal'));
                const nameInput = document.getElementById('quick-create-customer-name');
                if (nameInput) nameInput.value = '';
                setTimeout(() => document.getElementById('customer-search-input')?.focus(), 120);
            });
        }

        // Open modal — add-customer-quick-btn (abre el mismo modal, foca quick-create)
        const _addCustBtn = document.getElementById('add-customer-quick-btn');
        if (_addCustBtn) {
            _addCustBtn.addEventListener('click', () => {
                document.getElementById('customer-search-input').value = '';
                document.getElementById('customer-results-list').innerHTML =
                    '<p class="text-slate-500 text-xs text-center py-4">Escribe para buscar clientes...</p>';
                window.showModal(document.getElementById('customer-search-modal'));
                setTimeout(() => document.getElementById('quick-create-customer-name')?.focus(), 120);
            });
        }

        // Search debounce
        const _custInput = document.getElementById('customer-search-input');
        if (_custInput) {
            _custInput.addEventListener('input', (e) => {
                clearTimeout(_custSearchTimer);
                const q = e.target.value.trim();
                if (q.length < 2) {
                    document.getElementById('customer-results-list').innerHTML =
                        '<p class="text-slate-500 text-xs text-center py-4">Escribe al menos 2 caracteres...</p>';
                    return;
                }
                _custSearchTimer = setTimeout(async () => {
                    const resultsDiv = document.getElementById('customer-results-list');
                    if (resultsDiv) resultsDiv.innerHTML = '<p class="text-slate-500 text-xs text-center py-4">Buscando...</p>';
                    try {
                        const results = await SalesApi.searchCustomers(q);
                        renderCustomerResults(Array.isArray(results) ? results : []);
                    } catch (err) {
                        const errEl = document.createElement('p');
                        errEl.className = 'text-rose-400 text-xs text-center py-4';
                        errEl.textContent = 'Error al buscar. Intenta de nuevo.';
                        if (resultsDiv) { resultsDiv.innerHTML = ''; resultsDiv.appendChild(errEl); }
                    }
                }, 300);
            });
        }

        // Quick-create form submit
        const _quickCreateForm = document.getElementById('quick-create-customer-form');
        if (_quickCreateForm) {
            _quickCreateForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const nameInput = document.getElementById('quick-create-customer-name');
                const name = nameInput?.value.trim();
                if (!name) return;
                if (name.length > 100) { window.showAlert('Nombre muy largo', 'Máximo 100 caracteres.', 'warning'); return; }
                if (/[<>"']/.test(name)) { window.showAlert('Caracteres inválidos', 'No se permiten < > " \' en el nombre.', 'warning'); return; }
                const submitBtn = _quickCreateForm.querySelector('button[type="submit"]');
                if (submitBtn) submitBtn.disabled = true;
                try {
                    const created = await SalesApi.createCustomer({ name });
                    setCurrentCustomer({ id: created.id, name: created.name });
                    window.hideModal(document.getElementById('customer-search-modal'));
                    window.showAlert('Cliente creado', `"${created.name}" agregado y seleccionado.`, 'success');
                    if (nameInput) nameInput.value = '';
                } catch (err) {
                    window.showAlert('Error al crear cliente', err.message, 'error');
                } finally {
                    if (submitBtn) submitBtn.disabled = false;
                }
            });
        }
        // ── END Customer Selector ────────────────────────────────────────

        // ── Session Logic ────────────────────────────────────────────────
        async function checkSession() {
            try {
                const session = await SalesApi.getCashStatus();
                const badge = document.getElementById('session-status-badge');
                const openBtn = document.getElementById('open-session-btn');
                const closeBtn = document.getElementById('close-session-btn');
                const cashInBtn = document.getElementById('cash-in-btn');
                const cashOutBtn = document.getElementById('cash-out-btn');
                const returnsBtn = document.getElementById('returns-btn');
                const placeholder = document.getElementById('ticket-placeholder');
                const searchInput = document.getElementById('search-input');
                const resultsContainer = document.getElementById('search-results');
                const cajaCerradaBanner = document.getElementById('caja-cerrada-banner');

                if (session && session.status === 'OPEN') {
                    window.CURRENT_CASH_SESSION_ID = session.id;
                    badge.classList.remove('hidden');
                    openBtn.classList.add('hidden');
                    closeBtn.classList.remove('hidden');
                    if (cashInBtn) cashInBtn.classList.remove('hidden');
                    if (cashOutBtn) cashOutBtn.classList.remove('hidden');
                    if (returnsBtn) { returnsBtn.classList.remove('hidden'); returnsBtn.classList.add('flex'); }

                    // UNBLOCK UI
                    if (searchInput) {
                        searchInput.disabled = false;
                        searchInput.placeholder = "Buscar producto...";
                        searchInput.classList.remove('opacity-50', 'cursor-not-allowed');
                    }
                    if (resultsContainer) {
                        resultsContainer.classList.remove('pointer-events-none', 'opacity-50');
                    }

                    if (placeholder) placeholder.innerHTML = `<svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg><p class="text-xs font-medium italic">Carrito Vacío</p>`;
                    cajaCerradaBanner?.classList.add('hidden');
                } else {
                    window.CURRENT_CASH_SESSION_ID = null;
                    badge.classList.add('hidden');
                    openBtn.classList.remove('hidden');
                    closeBtn.classList.add('hidden');
                    if (cashInBtn) cashInBtn.classList.add('hidden');
                    if (cashOutBtn) cashOutBtn.classList.add('hidden');
                    if (returnsBtn) { returnsBtn.classList.add('hidden'); returnsBtn.classList.remove('flex'); }

                    // BLOCK UI
                    if (searchInput) {
                        searchInput.disabled = true;
                        searchInput.placeholder = "TURNO CERRADO - Abra caja para vender";
                        searchInput.classList.add('opacity-50', 'cursor-not-allowed');
                        searchInput.value = "";
                    }
                    if (resultsContainer) {
                        resultsContainer.classList.add('pointer-events-none', 'opacity-50');
                    }

                    if (placeholder) placeholder.textContent = "TURNO CERRADO - Abra caja primero";
                    cajaCerradaBanner?.classList.remove('hidden');
                }
            } catch (e) {
                console.error("Session check failed", e);
                // Safe default: assume closed so UI doesn't allow ghost sales
                window.CURRENT_CASH_SESSION_ID = null;
                badge?.classList.add('hidden');
                openBtn?.classList.remove('hidden');
                openBtn?.classList.add('flex');
                closeBtn?.classList.add('hidden');
                if (searchInput) {
                    searchInput.disabled = true;
                    searchInput.placeholder = "ERROR DE CONEXIÓN - Reintente o abra turno";
                    searchInput.classList.add('opacity-50', 'cursor-not-allowed');
                    searchInput.value = "";
                }
                if (resultsContainer) {
                    resultsContainer.classList.add('pointer-events-none', 'opacity-50');
                }
                cajaCerradaBanner?.classList.remove('hidden');
            }
        }

        // ── Session Handlers ─────────────────────────────────────────────
        document.getElementById('open-session-btn').onclick = () => {
            window.showModal(document.getElementById('cash-session-modal'));
            document.getElementById('open-session-view').classList.remove('hidden');
            document.getElementById('close-session-view').classList.add('hidden');
        };

        document.getElementById('open-session-form').onsubmit = async (e) => {
            e.preventDefault();
            const amount = parseFloat(document.getElementById('opening-balance').value);
            try {
                await SalesApi.fetch('/api/cash/open', {
                    method: 'POST',
                    body: JSON.stringify({ opening_balance: amount })
                });
                window.hideModal(document.getElementById('cash-session-modal'));
                checkSession();
                window.showAlert("Éxito", "Turno Abierto", "success");
            } catch (err) {
                window.showAlert("Error", "Error al abrir turno: " + err.message, "error");
            }
        };

        document.getElementById('close-session-btn').onclick = async () => {
            window.showModal(document.getElementById('cash-session-modal'));
            document.getElementById('open-session-view').classList.add('hidden');
            document.getElementById('close-session-view').classList.remove('hidden');

            // Pre-calc expected from /summary (has full audit calculation)
            try {
                const summary = await SalesApi.fetch('/api/cash/summary');
                const exp = summary.expected?.cash_physical || 0;
                document.getElementById('close-expected-display').textContent = POSFormatters.money(exp);
            } catch (e) { console.error(e); }
        };

        document.getElementById('close-session-form').onsubmit = async (e) => {
            e.preventDefault();
            const actual = parseFloat(document.getElementById('closing-balance').value);
            const notes = document.getElementById('close-notes').value;

            try {
                const res = await SalesApi.closeCashSession({
                    closing_balance: actual,
                    notes: notes
                });

                window.LAST_CLOSED_SESSION_ID = res.id; // Save for report
                window.hideModal(document.getElementById('cash-session-modal'));

                // Show Cut Success Modal
                document.getElementById('cut-success-diff').textContent = POSFormatters.money(res.difference);
                // Color diff
                const diffEl = document.getElementById('cut-success-diff');
                if (res.difference < 0) diffEl.className = "text-2xl font-bold text-rose-500";
                else diffEl.className = "text-2xl font-bold text-emerald-500";

                window.showModal(document.getElementById('cut-success-modal'));

                checkSession(); // Will show closed state
            } catch (err) {
                window.showAlert("Error", "Error al cerrar turno: " + err.message, "error");
            }
        };

        document.getElementById('cancel-close-session').onclick = () => window.hideModal(document.getElementById('cash-session-modal'));

        window.downloadCutPDF = async () => {
            if (!window.LAST_CLOSED_SESSION_ID) return;
            window.open(`/api/cash/${window.LAST_CLOSED_SESSION_ID}/pdf`, '_blank');
        };

        window.printCutTicket = async () => {
            if (!window.LAST_CLOSED_SESSION_ID) return;
            try {
                const res = await SalesApi.fetch('/api/printer/print-cash-cut', {
                    method: 'POST',
                    body: JSON.stringify({ session_id: window.LAST_CLOSED_SESSION_ID, mode: 'return_base64' })
                });

                if (res.content_base64) {
                    const targetPrinter = res.printer_target;
                    if (!targetPrinter) {
                        window.showAlert("Configuración", "No hay impresora definida para cortes.", "warning");
                        return;
                    }

                    await fetch(window.PRINT_AGENT_URL || "https://localhost:9100/print", {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            content_base64: res.content_base64,
                            printer_name: targetPrinter
                        })
                    });
                    window.showAlert("Éxito", "Corte enviado a impresora", "success");
                }
            } catch (e) {
                window.showAlert("Error", "Error imprimiendo corte: " + e.message, "error");
            }
        };

        window.finishCutProcess = () => {
            window.hideModal(document.getElementById('cut-success-modal'));
        };

        // ── Cash In / Cash Out Handlers ──────────────────────────────────
        const cashInBtn = document.getElementById('cash-in-btn');
        const cashOutBtn = document.getElementById('cash-out-btn');

        if (cashInBtn) {
            cashInBtn.onclick = () => {
                document.getElementById('cash-in-amount').value = '';
                document.getElementById('cash-in-concept').value = '';
                window.showModal(document.getElementById('cash-in-modal'));
                setTimeout(() => document.getElementById('cash-in-amount').focus(), 100);
            };
        }

        if (cashOutBtn) {
            cashOutBtn.onclick = () => {
                document.getElementById('cash-out-amount').value = '';
                document.getElementById('cash-out-reason').value = '';
                window.showModal(document.getElementById('cash-out-modal'));
                setTimeout(() => document.getElementById('cash-out-amount').focus(), 100);
            };
        }

        document.getElementById('cash-in-confirm-btn').onclick = async () => {
            const amount = parseFloat(document.getElementById('cash-in-amount').value);
            const concept = document.getElementById('cash-in-concept').value.trim() || 'Entrada de efectivo';
            if (!amount || amount <= 0) {
                window.showAlert('Error', 'Ingresa un monto válido', 'error');
                return;
            }
            try {
                await SalesApi.registerCashMovement({ type: 'IN', amount, concept });
                window.hideModal(document.getElementById('cash-in-modal'));
                window.showAlert('Éxito', `Entrada de $${amount.toFixed(2)} registrada`, 'success');
            } catch (err) {
                window.showAlert('Error', err.message || 'No se pudo registrar la entrada', 'error');
            }
        };

        document.getElementById('cash-out-confirm-btn').onclick = async () => {
            const amount = parseFloat(document.getElementById('cash-out-amount').value);
            const reason = document.getElementById('cash-out-reason').value.trim() || 'Salida de efectivo';
            if (!amount || amount <= 0) {
                window.showAlert('Error', 'Ingresa un monto válido', 'error');
                return;
            }
            try {
                await SalesApi.registerCashMovement({ type: 'OUT', amount, concept: reason });
                window.hideModal(document.getElementById('cash-out-modal'));
                window.showAlert('Éxito', `Salida de $${amount.toFixed(2)} registrada`, 'success');
            } catch (err) {
                window.showAlert('Error', err.message || 'No se pudo registrar la salida', 'error');
            }
        };

        // ── Pending Orders Tab Handlers ──────────────────────────────────
        document.getElementById('tab-catalog-btn')?.addEventListener('click', () => switchToTab('catalog'));
        document.getElementById('tab-orders-btn')?.addEventListener('click', () => { switchToTab('orders'); fetchCloudCommandas(); });

        // Initial fetch + polling every 10s
        fetchCloudCommandas();
        window._pendingOrdersInterval = setInterval(fetchCloudCommandas, 10000);

        // ── Returns ──────────────────────────────────────────────────────
        function _canApproveReturn() { return ['ADMINISTRADOR', 'DUEÑO', 'GERENTE'].includes(window.POS_USER?.role); }

        function _showReturnsState(state) {
            ['search', 'items', 'result'].forEach(s => {
                const el = document.getElementById(`returns-state-${s}`);
                if (el) {
                    el.classList.toggle('hidden', s !== state);
                    el.classList.toggle('flex', s === state);
                }
            });
        }

        function _calcReturnsTotal() {
            let total = 0;
            document.querySelectorAll('.returns-item-row').forEach(row => {
                const cb = row.querySelector('.returns-item-cb');
                const qtyInput = row.querySelector('.returns-item-qty');
                const price = parseFloat(row.dataset.price || 0);
                if (cb?.checked && qtyInput) {
                    total += parseFloat(qtyInput.value || 0) * price;
                }
            });
            const el = document.getElementById('returns-total-display');
            if (el) el.textContent = `$${total.toFixed(2)}`;
            return total;
        }

        function _renderReturnItems(sale) {
            const list = document.getElementById('returns-items-list');
            const info = document.getElementById('returns-sale-info');
            if (!list) return;
            if (info) info.textContent = `Venta ${sale.series}-${sale.folio} — ${sale.customer_name || 'Público General'} — $${Number(sale.total_amount || 0).toFixed(2)}`;
            list.innerHTML = '';
            (sale.lines || []).forEach(line => {
                const row = document.createElement('div');
                row.className = 'returns-item-row flex items-center gap-2 p-2 bg-slate-800/60 rounded-lg';
                row.dataset.variantId = line.variant_id;
                row.dataset.price = line.unit_price;

                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.className = 'returns-item-cb w-4 h-4 accent-rose-500';

                const nameSpan = document.createElement('span');
                nameSpan.className = 'flex-1 text-sm text-white truncate';
                nameSpan.textContent = line.description;

                const qtyLabel = document.createElement('span');
                qtyLabel.className = 'text-xs text-slate-400';
                qtyLabel.textContent = `x${line.quantity}`;

                const qtyInput = document.createElement('input');
                qtyInput.type = 'number';
                qtyInput.className = 'returns-item-qty w-14 bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-sm text-white text-center';
                qtyInput.min = 1;
                qtyInput.max = line.quantity;
                qtyInput.step = '1';
                qtyInput.value = line.quantity;
                qtyInput.disabled = true;

                const reentryLabel = document.createElement('label');
                reentryLabel.className = 'flex items-center gap-1 text-xs text-slate-400 cursor-pointer';
                const reentryCb = document.createElement('input');
                reentryCb.type = 'checkbox';
                reentryCb.className = 'returns-item-reentry w-3 h-3 accent-emerald-500';
                reentryCb.checked = true;
                const reentryText = document.createTextNode(' Inv.');
                reentryLabel.appendChild(reentryCb);
                reentryLabel.appendChild(reentryText);

                cb.addEventListener('change', () => {
                    qtyInput.disabled = !cb.checked;
                    _calcReturnsTotal();
                });
                qtyInput.addEventListener('input', _calcReturnsTotal);

                row.appendChild(cb);
                row.appendChild(nameSpan);
                row.appendChild(qtyLabel);
                row.appendChild(qtyInput);
                row.appendChild(reentryLabel);
                list.appendChild(row);
            });
            _calcReturnsTotal();
        }

        async function _searchReturnSale() {
            const input = document.getElementById('returns-folio-input');
            const errEl = document.getElementById('returns-search-error');
            const btn = document.getElementById('returns-search-btn');
            if (!input) return;
            const val = input.value.trim();
            if (!val) return;
            if (errEl) { errEl.classList.add('hidden'); errEl.textContent = ''; }
            if (btn) btn.disabled = true;
            try {
                let sale;
                const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                if (UUID_RE.test(val)) {
                    sale = await SalesApi.fetch(`/api/sales/${val}`);
                } else if (val.includes('-')) {
                    const parts = val.split('-');
                    sale = await SalesApi.getSaleByFolio(parts[0], parts.slice(1).join('-'));
                } else {
                    sale = await SalesApi.fetch(`/api/sales/${val}`);
                }
                _currentReturnSale = sale;
                _renderReturnItems(sale);
                _showReturnsState('items');
            } catch (e) {
                if (errEl) {
                    errEl.textContent = 'Venta no encontrada. Verifica el folio.';
                    errEl.classList.remove('hidden');
                }
            } finally {
                if (btn) btn.disabled = false;
            }
        }

        async function _submitReturn() {
            if (!_currentReturnSale) return;
            const reason = document.getElementById('returns-reason')?.value?.trim();
            const refundMethod = document.getElementById('returns-refund-method')?.value || 'CASH';
            const btn = document.getElementById('returns-submit-btn');

            if (!reason) {
                window.showAlert?.('Ingresa el motivo de la devolución', 'warning');
                return;
            }

            const items = [];
            document.querySelectorAll('.returns-item-row').forEach(row => {
                const cb = row.querySelector('.returns-item-cb');
                const qtyInput = row.querySelector('.returns-item-qty');
                const reentryCb = row.querySelector('.returns-item-reentry');
                if (cb?.checked) {
                    const qty = parseInt(qtyInput?.value || 0, 10);
                    const price = parseFloat(row.dataset.price || 0);
                    if (qty > 0) {
                        items.push({
                            variant_id: row.dataset.variantId,
                            quantity: qty,
                            refund_amount: qty * price,
                            is_inventory_reentry: reentryCb?.checked ?? true
                        });
                    }
                }
            });

            if (items.length === 0) {
                window.showAlert?.('Selecciona al menos un producto para devolver', 'warning');
                return;
            }

            const total = _calcReturnsTotal();
            if (btn) btn.disabled = true;

            const payload = {
                sale_id: _currentReturnSale.id,
                reason,
                total_refunded: total,
                refund_method: refundMethod,
                items
            };

            let ret;
            try {
                ret = await SalesApi.createReturn(payload);
            } catch (e) {
                window.showAlert?.('Error al registrar la devolución. Intenta de nuevo.', 'error');
                if (btn) btn.disabled = false;
                return;
            }

            try {
                if (_canApproveReturn()) {
                    // Auto-approve + reprint
                    await SalesApi.approveReturn(ret.id);
                    try { await SalesApi.reprintRefunded(_currentReturnSale.id, 'print'); } catch (_) {}
                    _showReturnsState('result');
                    document.getElementById('returns-result-icon').textContent = '✅';
                    document.getElementById('returns-result-title').textContent = 'Devolución aprobada';
                    document.getElementById('returns-result-msg').textContent = `Se reembolsaron $${total.toFixed(2)} al cliente.`;
                } else {
                    // CAJERO — pending supervisor
                    _showReturnsState('result');
                    document.getElementById('returns-result-icon').textContent = '⏳';
                    document.getElementById('returns-result-title').textContent = 'Pendiente de aprobación';
                    document.getElementById('returns-result-msg').textContent = 'La devolución fue registrada. Un supervisor debe aprobarla.';
                }
            } catch (e) {
                _showReturnsState('result');
                document.getElementById('returns-result-icon').textContent = '⚠️';
                document.getElementById('returns-result-title').textContent = 'Devolución creada';
                document.getElementById('returns-result-msg').textContent = 'La devolución fue registrada pero la aprobación falló. Contacta a un supervisor.';
            }

            if (btn) btn.disabled = false;
        }

        // Returns wiring
        document.getElementById('returns-btn')?.addEventListener('click', () => {
            _currentReturnSale = null;
            _showReturnsState('search');
            const inp = document.getElementById('returns-folio-input');
            if (inp) inp.value = '';
            const err = document.getElementById('returns-search-error');
            if (err) err.classList.add('hidden');
            const reasonEl = document.getElementById('returns-reason');
            if (reasonEl) reasonEl.value = '';
            const methodEl = document.getElementById('returns-refund-method');
            if (methodEl) methodEl.selectedIndex = 0;
            window.showModal(document.getElementById('returns-modal'));
            document.getElementById('returns-folio-input')?.focus();
        });

        document.getElementById('returns-search-btn')?.addEventListener('click', _searchReturnSale);
        document.getElementById('returns-folio-input')?.addEventListener('keydown', e => {
            if (e.key === 'Enter') _searchReturnSale();
        });
        document.getElementById('returns-submit-btn')?.addEventListener('click', _submitReturn);

        // ── Expose on window ─────────────────────────────────────────────
        window.checkSession = checkSession;
        window.fetchCloudCommandas = fetchCloudCommandas;

    } // end initPosSession

    window.initPosSession = initPosSession;

})(window);
