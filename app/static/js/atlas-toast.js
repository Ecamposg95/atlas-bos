/**
 * Atlas Toast — Sistema de notificaciones ligero
 * API: window.showToast(message, type = 'success', duration = 3500)
 * Tipos: 'success' | 'error' | 'warning' | 'info'
 */
(function () {
    const ICONS = {
        success: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`,
        error:   `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
        warning: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>`,
        info:    `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
    };

    const COLORS = {
        success: { icon: 'text-emerald-400 bg-emerald-500/15 ring-emerald-500/25', bar: 'bg-emerald-500' },
        error:   { icon: 'text-rose-400 bg-rose-500/15 ring-rose-500/25',         bar: 'bg-rose-500' },
        warning: { icon: 'text-amber-400 bg-amber-500/15 ring-amber-500/25',       bar: 'bg-amber-500' },
        info:    { icon: 'text-sky-400 bg-sky-500/15 ring-sky-500/25',             bar: 'bg-sky-500' },
    };

    function getContainer() {
        let c = document.getElementById('atlas-toast-container');
        if (!c) {
            c = document.createElement('div');
            c.id = 'atlas-toast-container';
            c.style.cssText = 'position:fixed;bottom:1.25rem;right:1.25rem;z-index:99999;display:flex;flex-direction:column;gap:0.5rem;pointer-events:none;max-width:22rem;width:calc(100% - 2.5rem)';
            document.body.appendChild(c);
        }
        return c;
    }

    window.showToast = function (message, type = 'success', duration = 3500) {
        if (!message) return;
        const c = COLORS[type] || COLORS.info;
        const container = getContainer();

        const toast = document.createElement('div');
        toast.style.cssText = 'pointer-events:auto;opacity:0;transform:translateX(1rem);transition:opacity 0.2s ease,transform 0.2s ease';
        toast.innerHTML = `
            <div style="background:#1e293b;border:1px solid rgba(255,255,255,0.08);border-radius:0.75rem;padding:0.75rem 1rem;display:flex;align-items:flex-start;gap:0.75rem;box-shadow:0 8px 32px rgba(0,0,0,0.45);overflow:hidden;position:relative">
                <span class="${c.icon}" style="flex-shrink:0;width:2rem;height:2rem;border-radius:0.5rem;display:flex;align-items:center;justify-content:center;ring-width:1px">
                    ${ICONS[type] || ICONS.info}
                </span>
                <p style="font-size:0.875rem;color:#e2e8f0;line-height:1.4;flex:1;margin:0;align-self:center">${message}</p>
                <button onclick="this.closest('[data-atlas-toast]').remove()" style="flex-shrink:0;color:#64748b;background:none;border:none;cursor:pointer;line-height:1;padding:0;font-size:1rem" aria-label="Cerrar">&#x2715;</button>
                <div class="${c.bar}" style="position:absolute;bottom:0;left:0;height:2px;width:100%;animation:atlas-toast-bar ${duration}ms linear forwards"></div>
            </div>`;
        toast.setAttribute('data-atlas-toast', '');

        if (!document.getElementById('atlas-toast-style')) {
            const s = document.createElement('style');
            s.id = 'atlas-toast-style';
            s.textContent = `@keyframes atlas-toast-bar{from{width:100%}to{width:0%}}`;
            document.head.appendChild(s);
        }

        container.appendChild(toast);
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        });

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(1rem)';
            setTimeout(() => toast.remove(), 220);
        }, duration);
    };
})();
