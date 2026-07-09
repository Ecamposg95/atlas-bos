/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dax: {
          bg:           'var(--dax-bg)',
          surface:      'var(--dax-surface)',
          card:         'var(--dax-card)',
          border:       'var(--dax-border)',
          'border-dim': 'var(--dax-border-dim)',
          accent:       'var(--dax-accent)',
          text:         'var(--dax-text)',
          muted:        'var(--dax-text-muted)',
          faint:        'var(--dax-text-faint)',
        },
        sb: {
          bg:     'var(--sb-bg)',
          text:   'var(--sb-text)',
          active: 'var(--sb-active-text)',
        },
        atlas: {
          violet:  '#8b5cf6',
          indigo:  '#6366f1',
          success: '#34d399',
          warning: '#fbbf24',
          danger:  '#fb7185',
        },
        // Capa semántica theme-aware (WS-1). Uso: text-sem-success, bg-sem-success-soft…
        sem: {
          success:        'var(--sem-success)',
          'success-soft': 'var(--sem-success-soft)',
          'success-fg':   'var(--sem-success-fg)',
          warning:        'var(--sem-warning)',
          'warning-soft': 'var(--sem-warning-soft)',
          'warning-fg':   'var(--sem-warning-fg)',
          critical:        'var(--sem-critical)',
          'critical-soft': 'var(--sem-critical-soft)',
          'critical-fg':   'var(--sem-critical-fg)',
          info:        'var(--sem-info)',
          'info-soft': 'var(--sem-info-soft)',
          'info-fg':   'var(--sem-info-fg)',
        },
      },
      backdropBlur: {
        dax: '12px',
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        serif: ['IBM Plex Serif', 'Georgia', 'serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
