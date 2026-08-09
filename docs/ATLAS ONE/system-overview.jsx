// system-overview.jsx — the design system summary artboard

function SystemOverview() {
  return (
    <div style={{
      width: '100%', height: '100%', background: N.canvas,
      fontFamily: ATLAS_FONT, color: N.ink,
      padding: '44px 56px', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            <AtlasMark size={36} color={N.ink} accent={N.ink} />
            <div>
              <div style={{ fontSize: 11, fontFamily: ATLAS_MONO, color: N.muted, letterSpacing: 1.6, textTransform: 'uppercase' }}>Atlas One · Sistema visual v1</div>
              <div style={{ fontSize: 38, fontWeight: 500, letterSpacing: -1, marginTop: 4, fontFamily: ATLAS_SERIF }}>Un solo software. Once configuraciones.</div>
            </div>
          </div>
          <div style={{ fontSize: 14, color: N.body, maxWidth: 760, lineHeight: 1.5 }}>
            Atlas One es una plataforma modular para negocios físicos. Cada preset es una piel especializada sobre el mismo sistema: misma navegación, misma familia tipográfica, mismo lenguaje de tarjetas, tablas y formularios. Lo que cambia es el acento, la iconografía y los componentes que aporta cada giro.
          </div>
        </div>
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: N.muted, letterSpacing: 0.6, textAlign: 'right' }}>
          <div>v 1.0 · NOV 2026</div>
          <div>11 PRESETS · 1 PLATAFORMA</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 1fr', gap: 28 }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* Color system */}
          <Card pad={22}>
            <SectionTitle>Paleta · neutros + acento por preset</SectionTitle>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[
                ['Canvas', N.canvas], ['Page', N.page], ['Card', N.card],
                ['Line', N.line], ['Muted', N.muted], ['Body', N.body], ['Ink', N.ink],
              ].map(([n, c]) => (
                <div key={n} style={{ flex: 1 }}>
                  <div style={{ height: 52, background: c, border: `1px solid ${N.line}`, borderRadius: 6 }} />
                  <div style={{ fontSize: 10, fontFamily: ATLAS_MONO, color: N.muted, marginTop: 6 }}>{n}</div>
                  <div style={{ fontSize: 10, fontFamily: ATLAS_MONO, color: N.faint }}>{c}</div>
                </div>
              ))}
            </div>
            <div style={{ height: 1, background: N.line, margin: '6px -2px 16px' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {Object.entries(PRESETS).map(([k, p]) => (
                <div key={k} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 0, borderRadius: 5, overflow: 'hidden', border: `1px solid ${N.line}` }}>
                    <div style={{ width: 26, height: 26, background: p.accent }} />
                    <div style={{ width: 26, height: 26, background: p.accent2 }} />
                    <div style={{ width: 26, height: 26, background: p.sidebar.bg }} />
                    <div style={{ width: 26, height: 26, background: p.accentSoft }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 500 }}>{p.name}</div>
                    <div style={{ fontSize: 10, fontFamily: ATLAS_MONO, color: N.muted }}>{p.accent.toUpperCase()} · {p.accent2.toUpperCase()}</div>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ display: 'flex', borderRadius: 5, overflow: 'hidden', border: `1px solid ${N.line}` }}>
                  <div style={{ width: 26, height: 26, background: '#E2C07E' }} />
                  <div style={{ width: 26, height: 26, background: '#D9B58C' }} />
                  <div style={{ width: 26, height: 26, background: '#F1E5D2' }} />
                  <div style={{ width: 26, height: 26, background: '#7A6E5C' }} />
                </div>
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 500 }}>+ Beauty, Café, Bar, Health, Services…</div>
                  <div style={{ fontSize: 10, fontFamily: ATLAS_MONO, color: N.muted }}>SIETE PRESETS ADICIONALES</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Typography */}
          <Card pad={22}>
            <SectionTitle>Tipografía · IBM Plex Sans + Mono + Serif</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontFamily: ATLAS_SERIF, fontSize: 36, fontWeight: 500, letterSpacing: -0.8, lineHeight: 1.05 }}>Plex Serif · headlines</div>
                <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: N.muted, marginTop: 4 }}>SERIF 500 · 32 / 38 / 44 · LETTER -0.8</div>
              </div>
              <div>
                <div style={{ fontFamily: ATLAS_FONT, fontSize: 22, fontWeight: 600, letterSpacing: -0.3 }}>Plex Sans · section titles</div>
                <div style={{ fontFamily: ATLAS_FONT, fontSize: 14, color: N.body, marginTop: 4, lineHeight: 1.5 }}>Plex Sans 400 · body text. The quick brown fox saltó sobre la barda de mostrador.</div>
                <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: N.muted, marginTop: 4 }}>SANS 400/500/600 · 11 / 13 / 14 / 16 / 19 / 22 / 28</div>
              </div>
              <div>
                <div style={{ fontFamily: ATLAS_MONO, fontSize: 13, fontWeight: 500, color: N.ink, letterSpacing: 0.4 }}>PLEX MONO · MÉTRICAS Y CÓDIGOS</div>
                <div style={{ fontFamily: ATLAS_MONO, fontSize: 13, color: N.body, marginTop: 4 }}>$ 12,480.50 · SKU-7821 · 09:41 · 24 / 32 mesas</div>
                <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: N.muted, marginTop: 4 }}>MONO 400/500 · 10 / 11 / 13 · LETTER 0.4 · TNUM ON</div>
              </div>
            </div>
          </Card>

          {/* Iconography */}
          <Card pad={22}>
            <SectionTitle>Iconografía · stroke 1.6 · 24×24</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 8 }}>
              {Object.entries(Icon).slice(0, 24).map(([k, IconCmp]) => (
                <div key={k} style={{ aspectRatio: '1', border: `1px solid ${N.line}`, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4, color: N.body }}>
                  <IconCmp size={18} />
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* Components */}
          <Card pad={22}>
            <SectionTitle>Componentes núcleo</SectionTitle>
            {/* Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
              <Button label="Cobrar $1,240.00" kind="primary" preset={PRESETS.pos} icon={Icon.arrowRight} />
              <Button label="Cancelar" kind="secondary" />
              <Button label="+ Nuevo producto" kind="accent" preset={PRESETS.pos} />
              <Button label="Editar" kind="ghost" size="sm" icon={Icon.cog} />
            </div>
            {/* KPI row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
              <Kpi label="Ventas de hoy" value={mxnInt(48230)} delta="+12.4%" trend={[3,4,5,4,6,7,8,7,9,11,10,12]} accent={PRESETS.pos.accent} />
              <Kpi label="Ticket promedio" value={mxn(186.50)} delta="+3.2%" trend={[5,6,5,7,6,8,7,8,9,8,9,10]} accent={PRESETS.barber.accent} />
              <Kpi label="Cortes" value="143" sub="3 abiertos · 2 cerrados" />
            </div>
            {/* Badges */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              <Badge color="#0E8A4E" soft="#E3F4EA" dot>Caja abierta</Badge>
              <Badge color="#B43E2E" soft="#FBE7E1" dot>Stock crítico</Badge>
              <Badge color="#9A6610" soft="#FBEFD7" dot>Pendiente</Badge>
              <Badge color="#1F4FC8" soft="#E5ECFB" dot>En cocina</Badge>
              <Badge color="#6B6B66" soft="#EFECE3">SKU-7821</Badge>
              <Badge color="#0B0B0B" soft="#0B0B0B" />
            </div>
            {/* Table snippet */}
            <div style={{ border: `1px solid ${N.line}`, borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 90px 80px 110px', padding: '8px 14px', background: N.page, fontFamily: ATLAS_MONO, fontSize: 10, color: N.muted, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                <div>SKU</div><div>Producto</div><div style={{ textAlign: 'right' }}>Stock</div><div style={{ textAlign: 'right' }}>Precio</div><div style={{ textAlign: 'right' }}>Estado</div>
              </div>
              {[
                ['7821', 'Café americano 12 oz', '48', 38.00, 'ok'],
                ['7822', 'Latte vainilla 12 oz', '12', 52.00, 'low'],
                ['7823', 'Croissant mantequilla', '4', 45.00, 'crit'],
              ].map((r, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 90px 80px 110px', padding: '9px 14px', borderTop: `1px solid ${N.line}`, fontSize: 12.5, alignItems: 'center' }}>
                  <div style={{ fontFamily: ATLAS_MONO, color: N.muted }}>{r[0]}</div>
                  <div>{r[1]}</div>
                  <div style={{ textAlign: 'right', fontFamily: ATLAS_MONO }}>{r[2]}</div>
                  <div style={{ textAlign: 'right', fontFamily: ATLAS_MONO }}>{mxn(r[3])}</div>
                  <div style={{ textAlign: 'right' }}>
                    {r[4] === 'ok' && <Badge color="#0E8A4E" soft="#E3F4EA" dot>OK</Badge>}
                    {r[4] === 'low' && <Badge color="#9A6610" soft="#FBEFD7" dot>Bajo</Badge>}
                    {r[4] === 'crit' && <Badge color="#B43E2E" soft="#FBE7E1" dot>Crítico</Badge>}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Sidebar example */}
          <Card pad={0} style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', height: 280 }}>
              <Sidebar
                preset={PRESETS.pos}
                active="Punto de venta"
                items={[
                  { header: 'Operación' },
                  { icon: Icon.cart, label: 'Punto de venta' },
                  { icon: Icon.receipt, label: 'Caja', badge: '3' },
                  { icon: Icon.pkg, label: 'Productos' },
                  { icon: Icon.users, label: 'Clientes' },
                  { header: 'Analítica' },
                  { icon: Icon.chart, label: 'Reportes' },
                  { icon: Icon.branch, label: 'Sucursales' },
                ]}
                width={208}
                footer={<SidebarUser preset={PRESETS.pos} name="Ana Lozano" role="Cajera" branch="MX-01" />}
              />
              <div style={{ flex: 1, background: N.page, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: N.muted, letterSpacing: 0.6, textTransform: 'uppercase' }}>Misma navegación · cambia el acento</div>
                <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: -0.3 }}>Navegación lateral oscura</div>
                <div style={{ fontSize: 12.5, color: N.body, lineHeight: 1.5 }}>El rail siempre incluye logo + tagline del preset, secciones con headers monoespaciados, item activo con barra de acento y badge numérico opcional. El usuario y sucursal viven en el pie del rail.</div>
                <div style={{ marginTop: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {Object.values(PRESETS).map(p => (
                    <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: N.card, border: `1px solid ${N.line}`, borderRadius: 999, fontSize: 11 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: p.sidebar.bg }} />
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: p.accent }} />
                      <span style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: N.muted }}>{p.name.replace('Atlas One ', '').replace('Atlas ', '')}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Charts */}
          <Card pad={22}>
            <SectionTitle>Gráficos · líneas, barras, donut · stroke 2px</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 18, alignItems: 'center' }}>
              <div>
                <BarChart
                  data={[
                    { label: 'L', value: 4 }, { label: 'M', value: 6 }, { label: 'M', value: 5 },
                    { label: 'J', value: 8 }, { label: 'V', value: 11, highlight: true },
                    { label: 'S', value: 14, highlight: true }, { label: 'D', value: 7 },
                  ]}
                  width={360} height={140} color={PRESETS.pos.accent} soft={N.line}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Donut value={0.78} label="Capacidad" color={PRESETS.restaurant.accent} />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { SystemOverview });
