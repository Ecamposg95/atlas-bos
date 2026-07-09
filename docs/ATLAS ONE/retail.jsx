// retail.jsx — Atlas One Retail preset (Preset 02)
// Color: Azul profundo + cyan. Inventario, SKUs, multicaja.

const retailP = () => PRESETS.retail;

const retailSidebarItems = [
  { header: 'Mostrador' },
  { icon: Icon.cart,    label: 'Punto de venta' },
  { icon: Icon.receipt, label: 'Caja',           badge: '4' },
  { header: 'Inventario' },
  { icon: Icon.pkg,     label: 'Productos',      badge: 'ACTIVO' },
  { icon: Icon.tag,     label: 'Códigos · SKU' },
  { icon: Icon.warning, label: 'Stock crítico',  badge: '12' },
  { icon: Icon.truck,   label: 'Compras' },
  { icon: Icon.beaker,  label: 'Ajustes' },
  { header: 'Negocio' },
  { icon: Icon.users,   label: 'Clientes' },
  { icon: Icon.chart,   label: 'Reportes' },
  { icon: Icon.branch,  label: 'Sucursales',     badge: '3' },
];

// ─── 01 · Desktop · Inventario maestro ────────────────────────
function RetailDesktop() {
  const p = retailP();
  // [sku, name, cat, price, total, s1, s2, s3, trend, status]
  const products = [
    ['78214-001', 'Pintura vinílica 19 L · blanco hueso',    'Pinturas',     289.00,   4,   2,  2,   0, [3,4,3,5,4,6,4,5,4,3,2,4],          'crit'],
    ['78214-002', 'Pintura vinílica 19 L · blanco arena',    'Pinturas',     289.00,  18,   8,  6,   4, [4,5,4,6,5,4,6,5,4,5,4,6],          'low'],
    ['66102-114', 'Taladro percutor 13 mm DeWalt',           'Eléctrico',   1899.00,   6,   3,  2,   1, [2,2,3,2,3,2,4,3,2,3,2,3],          'ok'],
    ['66102-115', 'Set brocas HSS · 19 piezas',              'Eléctrico',    489.00,  42,  18, 12,  12, [6,7,8,7,9,8,10,9,8,7,8,9],         'ok'],
    ['44021-380', 'Tornillo galvanizado 1/4" · caja 100',    'Ferretería',    86.00, 322, 142, 96,  84, [12,14,16,18,14,16,18,20,18,16,18,20], 'ok'],
    ['44021-381', 'Tuerca hexagonal 1/4" · bolsa 50',        'Ferretería',    38.00, 140,  68, 42,  30, [8,9,10,8,10,9,11,12,10,9,11,10],   'ok'],
    ['12330-099', 'Cinta aislante eléctrica · roja',         'Eléctrico',     24.00, 338, 198, 84,  56, [22,24,26,24,28,26,30,28,26,28,30,32], 'ok'],
    ['12330-100', 'Cinta aislante eléctrica · negra',        'Eléctrico',     24.00, 378, 218, 92,  68, [24,26,28,26,30,28,32,30,28,30,32,34], 'ok'],
    ['89221-005', 'Bomba sumergible 1/2 HP',                 'Plomería',    2890.00,   3,   2,  1,   0, [1,1,2,1,2,1,2,1,1,2,1,1],          'crit'],
  ];
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', background: N.canvas, fontFamily: ATLAS_FONT }}>
      <Sidebar preset={p} active="Productos" items={retailSidebarItems}
        footer={<SidebarUser preset={p} name="Carlos Mendoza" role="Gerente" branch="Multisucursal" />} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar
          title="Inventario maestro"
          sub="3 SUCURSALES · 2 481 SKUS ACTIVOS · ACT. HACE 2 MIN"
          preset={p}
          right={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <SearchInput preset={p} placeholder="Buscar por SKU, código de barras o nombre…" width={340} />
              <Button label="Importar CSV" kind="secondary" icon={Icon.download} size="sm" />
              <Button label="+ Producto" kind="primary" preset={p} icon={Icon.plus} />
            </div>
          }
        />

        <div style={{ flex: 1, padding: '20px 24px', background: N.page, overflow: 'hidden' }}>
          {/* KPI strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
            <Kpi label="Valor de inventario"  value={mxnInt(1842360)} delta="+2.1%" trend={[10,11,12,11,13,12,13,14,13,14,15,14]} accent={p.accent} />
            <Kpi label="SKUs activos"         value="2 481"           sub="98% con código de barras" />
            <Kpi label="Stock crítico"        value="12"              sub="≤ 25% del mínimo" />
            <Kpi label="Por reabastecer"      value="38"              sub="próxima orden · martes" />
            <Kpi label="Rotación · 30d"       value="4.2×"            delta="+0.4×" trend={[3,3,4,4,4,5,4,4,5,4,5,5]} accent={p.accent2} />
          </div>

          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, fontFamily: ATLAS_FONT }}>
            <div style={{ display: 'flex', background: N.card, border: `1px solid ${N.line}`, borderRadius: 8, padding: 2 }}>
              {['Todos', 'Stock crítico', 'Sin movimiento', 'Por reabastecer'].map((t, i) => (
                <div key={t} style={{
                  padding: '6px 12px', borderRadius: 6, fontSize: 12.5, cursor: 'pointer',
                  background: i === 0 ? p.accent : 'transparent',
                  color: i === 0 ? '#fff' : N.body, fontWeight: i === 0 ? 500 : 400,
                }}>{t}</div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, padding: '6px 10px', background: N.card, border: `1px solid ${N.line}`, borderRadius: 8, alignItems: 'center', fontSize: 12.5, color: N.body }}>
              <Icon.branch size={14} color={N.muted} /> Todas las sucursales <Icon.arrowDown size={12} color={N.muted} />
            </div>
            <div style={{ display: 'flex', gap: 8, padding: '6px 10px', background: N.card, border: `1px solid ${N.line}`, borderRadius: 8, alignItems: 'center', fontSize: 12.5, color: N.body }}>
              <Icon.filter size={14} color={N.muted} /> Categoría · Todas
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: N.muted }}>9 de 2 481 productos</div>
            <Icon.download size={16} color={N.muted} />
          </div>

          {/* Table */}
          <Card pad={0} style={{ overflow: 'hidden' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '112px 2.4fr 116px 100px 220px 90px 80px 110px 60px',
              padding: '12px 18px', background: N.page,
              fontFamily: ATLAS_MONO, fontSize: 10, color: N.muted, letterSpacing: 0.5, textTransform: 'uppercase',
              borderBottom: `1px solid ${N.line}`,
            }}>
              <div>SKU</div>
              <div>Producto · Categoría</div>
              <div style={{ textAlign: 'right' }}>Precio</div>
              <div style={{ textAlign: 'right' }}>Stock total</div>
              <div>Distribución · 3 sucursales</div>
              <div style={{ textAlign: 'right' }}>Tendencia</div>
              <div style={{ textAlign: 'center' }}>Rotación</div>
              <div style={{ textAlign: 'center' }}>Estado</div>
              <div></div>
            </div>
            {products.map((row, i) => {
              const [sku, name, cat, price, total, s1, s2, s3, trend, status] = row;
              const allBranches = [s1, s2, s3];
              const branchMax = Math.max(...allBranches, 1);
              return (
                <div key={i} style={{
                  display: 'grid',
                  gridTemplateColumns: '112px 2.4fr 116px 100px 220px 90px 80px 110px 60px',
                  padding: '14px 18px', borderBottom: i < products.length - 1 ? `1px solid ${N.line}` : 'none',
                  fontSize: 13, alignItems: 'center',
                }}>
                  <div style={{ fontFamily: ATLAS_MONO, color: N.muted, fontSize: 11.5 }}>{sku}</div>
                  <div>
                    <div style={{ fontWeight: 500, color: N.ink }}>{name}</div>
                    <div style={{ fontSize: 11, color: N.muted, marginTop: 2, fontFamily: ATLAS_MONO, letterSpacing: 0.3 }}>{cat.toUpperCase()}</div>
                  </div>
                  <div style={{ textAlign: 'right', fontFamily: ATLAS_MONO, fontWeight: 500 }}>{mxn(price)}</div>
                  <div style={{ textAlign: 'right', fontFamily: ATLAS_MONO, fontSize: 14, fontWeight: 600, color: status === 'crit' ? '#B43E2E' : N.ink }}>{total}</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {['MX-01', 'MX-02', 'MX-03'].map((b, j) => (
                      <div key={b} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <div style={{ fontFamily: ATLAS_MONO, fontSize: 9.5, color: N.faint }}>{b}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ flex: 1, height: 4, background: N.line, borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: `${(allBranches[j] / branchMax) * 100}%`, height: '100%', background: allBranches[j] === 0 ? '#B43E2E' : p.accent2 }} />
                          </div>
                          <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, width: 22, textAlign: 'right', color: allBranches[j] === 0 ? '#B43E2E' : N.body, fontWeight: 500 }}>{allBranches[j]}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Sparkline values={trend} color={p.accent} width={70} height={22} fill={true} />
                  </div>
                  <div style={{ textAlign: 'center', fontFamily: ATLAS_MONO, fontSize: 12, color: N.muted }}>{(2 + i * 0.5).toFixed(1)}×</div>
                  <div style={{ textAlign: 'center' }}>
                    {status === 'ok' && <Badge color="#0E8A4E" soft="#E3F4EA" dot>OK</Badge>}
                    {status === 'low' && <Badge color="#9A6610" soft="#FBEFD7" dot>Bajo</Badge>}
                    {status === 'crit' && <Badge color="#B43E2E" soft="#FBE7E1" dot>Crítico</Badge>}
                  </div>
                  <div style={{ textAlign: 'right' }}><Icon.more size={16} color={N.muted} /></div>
                </div>
              );
            })}
          </Card>

          {/* Footer summary */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12, padding: '10px 14px', background: p.accentSoft, borderRadius: 8 }}>
            <Icon.sparkles size={18} color={p.accent} />
            <div style={{ fontSize: 12.5, color: p.accentInk, flex: 1 }}>
              <strong style={{ fontWeight: 600 }}>Recomendación de compra</strong> · Atlas IA sugiere reabastecer <strong>12 productos críticos</strong> con un valor estimado de <span style={{ fontFamily: ATLAS_MONO, fontWeight: 600 }}>{mxn(18420.00)}</span> antes del lunes.
            </div>
            <div style={{ padding: '6px 12px', background: p.accent, color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 500 }}>Generar orden →</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 02 · Mostrador táctil ────────────────────────────────────
function RetailTouch() {
  const p = retailP();
  return (
    <div style={{ width: '100%', height: '100%', background: N.canvas, display: 'flex', flexDirection: 'column', fontFamily: ATLAS_FONT }}>
      {/* Top */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 22px', background: N.card, borderBottom: `1px solid ${N.line}` }}>
        <Wordmark color={N.ink} accent={p.accent} size={14} sub="RETAIL · MX-02 Coyoacán" />
        <div style={{ width: 1, height: 22, background: N.line }} />
        <Badge color="#0E8A4E" soft="#E3F4EA" dot>Caja 02 abierta · Pedro M.</Badge>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontFamily: ATLAS_MONO, fontSize: 11, color: N.muted }}>
          <span>Ticket · R-23119</span>
          <span>14:32</span>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Search + scan area */}
        <div style={{ flex: 1, padding: 22, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {/* Scan / SKU input */}
          <div style={{
            background: N.card, border: `2px solid ${p.accent}`, borderRadius: 12,
            padding: 18, display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 10, background: p.accent, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon.qr size={22} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: N.muted, letterSpacing: 0.6 }}>ESCANEAR O TECLEAR</div>
              <div style={{ fontSize: 22, fontFamily: ATLAS_MONO, color: N.ink, marginTop: 4, letterSpacing: 1 }}>SKU / Código de barras…</div>
            </div>
            <div style={{ padding: '8px 14px', background: N.page, border: `1px solid ${N.line}`, borderRadius: 7, fontFamily: ATLAS_MONO, fontSize: 12, color: N.muted }}>F2</div>
          </div>

          {/* Quick categories */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {[
              { name: 'Pinturas',   n: 312, icon: Icon.beaker, accent: '#3B82F6' },
              { name: 'Ferretería', n: 824, icon: Icon.cog,    accent: '#06B6D4' },
              { name: 'Eléctrico',  n: 421, icon: Icon.bars,   accent: '#0EA5E9' },
              { name: 'Plomería',   n: 268, icon: Icon.truck,  accent: '#0891B2' },
            ].map((c, i) => {
              const IconCmp = c.icon;
              return (
                <div key={i} style={{ background: N.card, border: `1px solid ${N.line}`, borderRadius: 10, padding: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: `${c.accent}18`, color: c.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <IconCmp size={18} color={c.accent} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</div>
                    <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: N.muted }}>{c.n} SKU</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recent / suggested */}
          <Card pad={0} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${N.line}` }}>
              <div style={{ fontSize: 13, fontFamily: ATLAS_MONO, color: N.muted, letterSpacing: 0.6, textTransform: 'uppercase' }}>Productos sugeridos</div>
              <div style={{ fontSize: 12, color: p.accent, fontFamily: ATLAS_MONO }}>Ver todos →</div>
            </div>
            {[
              ['44021-380', 'Tornillo galvanizado 1/4"',      86.00,  142, 'OK'],
              ['12330-100', 'Cinta aislante eléctrica · negra', 24.00,  218, 'OK'],
              ['66102-114', 'Taladro percutor DeWalt 13mm',   1899.00,   8, 'OK'],
              ['78214-002', 'Pintura vinílica 19L · arena',    289.00,  18, 'Bajo'],
            ].map((row, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '110px 1fr 100px 70px 50px',
                padding: '14px 18px', alignItems: 'center', gap: 10,
                borderBottom: i < 3 ? `1px solid ${N.line}` : 'none',
              }}>
                <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: N.muted }}>{row[0]}</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{row[1]}</div>
                <div style={{ textAlign: 'right', fontFamily: ATLAS_MONO, fontSize: 15, fontWeight: 600 }}>{mxn(row[2])}</div>
                <div style={{ textAlign: 'center', fontFamily: ATLAS_MONO, fontSize: 12 }}>
                  <Badge color={row[4] === 'OK' ? '#0E8A4E' : '#9A6610'} soft={row[4] === 'OK' ? '#E3F4EA' : '#FBEFD7'} dot>{row[3]}</Badge>
                </div>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, background: p.accentSoft, color: p.accent,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 'auto',
                }}>
                  <Icon.plus size={18} color={p.accent} strokeWidth={2.2} />
                </div>
              </div>
            ))}
          </Card>
        </div>

        {/* Cart side */}
        <div style={{ width: 360, background: N.card, borderLeft: `1px solid ${N.line}`, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '18px 20px', borderBottom: `1px solid ${N.line}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, fontFamily: ATLAS_MONO, color: N.muted, letterSpacing: 0.8, textTransform: 'uppercase' }}>Cliente · 200034</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>Constructora Real</div>
              </div>
              <div style={{ padding: '4px 8px', background: p.accentSoft, color: p.accentInk, borderRadius: 6, fontFamily: ATLAS_MONO, fontSize: 10.5, fontWeight: 500 }}>MAYOREO 15%</div>
            </div>
          </div>
          <div style={{ flex: 1, padding: '6px 20px', overflow: 'hidden' }}>
            {[
              { sku: '44021-380', name: 'Tornillo galv. 1/4"',         qty: 8,  price: 86.00 },
              { sku: '12330-100', name: 'Cinta aislante negra',        qty: 12, price: 24.00 },
              { sku: '66102-115', name: 'Set brocas HSS 19 pz',        qty: 2,  price: 489.00 },
              { sku: '78214-002', name: 'Pintura vinílica 19L arena',  qty: 4,  price: 289.00 },
            ].map((it, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '36px 1fr 90px',
                gap: 10, padding: '12px 0',
                borderBottom: i < 3 ? `1px solid ${N.line}` : 'none',
                alignItems: 'center',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 6, background: p.accentSoft, color: p.accent,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: ATLAS_MONO, fontSize: 12, fontWeight: 600,
                }}>{it.qty}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{it.name}</div>
                  <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: N.muted, marginTop: 2 }}>{it.sku} · {mxn(it.price)}</div>
                </div>
                <div style={{ textAlign: 'right', fontFamily: ATLAS_MONO, fontSize: 13, fontWeight: 600 }}>{mxn(it.qty * it.price)}</div>
              </div>
            ))}
          </div>

          <div style={{ padding: '16px 20px', background: N.page, borderTop: `1px solid ${N.line}` }}>
            <div style={{ fontSize: 12, color: N.muted, display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span style={{ fontFamily: ATLAS_MONO }}>{mxn(2982.00)}</span></div>
            <div style={{ fontSize: 12, color: N.muted, display: 'flex', justifyContent: 'space-between', marginTop: 4 }}><span>Descuento mayoreo</span><span style={{ fontFamily: ATLAS_MONO, color: '#0E8A4E' }}>−{mxn(447.30)}</span></div>
            <div style={{ fontSize: 12, color: N.muted, display: 'flex', justifyContent: 'space-between', marginTop: 4 }}><span>IVA 16%</span><span style={{ fontFamily: ATLAS_MONO }}>{mxn(405.55)}</span></div>
            <div style={{ height: 1, background: N.line, margin: '12px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
              <span style={{ fontSize: 13, color: N.muted }}>Total</span>
              <span style={{ fontFamily: ATLAS_MONO, fontSize: 26, fontWeight: 600, letterSpacing: -0.6 }}>{mxn(2940.25)}</span>
            </div>
            <Button label="Cobrar" kind="primary" preset={p} icon={Icon.arrowRight} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 03 · Mobile ──────────────────────────────────────────────
function RetailMobile() {
  const p = retailP();
  return (
    <div style={{ width: '100%', height: '100%', background: N.page, display: 'flex', flexDirection: 'column', fontFamily: ATLAS_FONT, overflow: 'hidden' }}>
      <div style={{ padding: '18px 18px 14px', background: N.card, borderBottom: `1px solid ${N.line}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: N.muted, letterSpacing: 0.8 }}>INVENTARIO</div>
            <div style={{ fontSize: 17, fontWeight: 600, marginTop: 2 }}>Stock crítico</div>
          </div>
          <Badge color="#B43E2E" soft="#FBE7E1" dot>12 SKU</Badge>
        </div>
        <div style={{
          background: `linear-gradient(135deg, ${p.sidebar.bg}, ${p.accent})`, color: '#fff',
          borderRadius: 12, padding: 14,
        }}>
          <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, opacity: 0.85, letterSpacing: 0.6 }}>VALOR DE INVENTARIO</div>
          <div style={{ fontSize: 28, fontWeight: 600, marginTop: 4, letterSpacing: -0.6 }}>{mxnInt(1842360)}</div>
          <div style={{ display: 'flex', gap: 14, marginTop: 12, fontSize: 11, fontFamily: ATLAS_MONO, opacity: 0.85 }}>
            <div><span style={{ opacity: 0.6 }}>SKUs · </span>2 481</div>
            <div><span style={{ opacity: 0.6 }}>Suc · </span>3</div>
            <div><span style={{ opacity: 0.6 }}>Rot · </span>4.2×</div>
          </div>
        </div>
      </div>

      {/* Filter chips */}
      <div style={{ padding: '12px 18px 6px', display: 'flex', gap: 6, overflow: 'hidden' }}>
        {['Crítico', 'Bajo', 'Sin movimiento', 'Por reorden'].map((c, i) => (
          <div key={c} style={{
            padding: '6px 12px', borderRadius: 999,
            background: i === 0 ? p.accent : N.card, color: i === 0 ? '#fff' : N.body,
            border: i === 0 ? 'none' : `1px solid ${N.line}`,
            fontSize: 12, fontWeight: i === 0 ? 500 : 400, whiteSpace: 'nowrap',
          }}>{c}</div>
        ))}
      </div>

      {/* List */}
      <div style={{ flex: 1, padding: '8px 18px 8px', overflow: 'hidden' }}>
        {[
          ['78214-001', 'Pintura vinílica 19 L · blanco hueso', 4, 24, '#B43E2E'],
          ['89221-005', 'Bomba sumergible 1/2 HP', 2, 6, '#B43E2E'],
          ['12330-090', 'Cinta teflón 1/2" · pulgada', 6, 30, '#B43E2E'],
          ['78215-014', 'Esmalte mate 1L · gris',  3, 18, '#B43E2E'],
          ['66103-220', 'Caja de fusibles 6 vías', 1,  4, '#B43E2E'],
        ].map(([sku, name, current, min, c], i) => (
          <div key={i} style={{
            background: N.card, border: `1px solid ${N.line}`, borderRadius: 10,
            padding: 12, marginBottom: 8, display: 'flex', gap: 10,
          }}>
            <div style={{ width: 4, background: c, borderRadius: 2 }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: N.muted }}>{sku}</div>
                <div style={{ fontFamily: ATLAS_MONO, fontSize: 12, color: c, fontWeight: 600 }}>{current}/{min}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, marginTop: 4 }}>{name}</div>
              <div style={{ marginTop: 8, height: 3, background: N.line, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${(current / min) * 100}%`, height: '100%', background: c }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom nav */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', background: N.card, borderTop: `1px solid ${N.line}`, padding: '8px 8px 24px' }}>
        {[
          { icon: Icon.home, l: 'Inicio' },
          { icon: Icon.pkg, l: 'Stock', active: true },
          { icon: Icon.qr, l: '', primary: true },
          { icon: Icon.truck, l: 'Compras' },
          { icon: Icon.chart, l: 'Reportes' },
        ].map((n, i) => {
          const IconCmp = n.icon;
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              {n.primary ? (
                <div style={{ width: 42, height: 42, borderRadius: 12, background: p.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 6px 14px ${p.accent}40` }}>
                  <IconCmp size={20} color="#fff" strokeWidth={2} />
                </div>
              ) : (
                <>
                  <IconCmp size={20} color={n.active ? p.accent : N.muted} />
                  <div style={{ fontSize: 10, color: n.active ? p.accent : N.muted, fontFamily: ATLAS_MONO }}>{n.l}</div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 04 · Hero comercial ──────────────────────────────────────
function RetailHero() {
  const p = retailP();
  return (
    <HeroBg preset={p}>
      <div style={{ width: '100%', height: '100%', display: 'flex', padding: '60px 70px', gap: 36, fontFamily: ATLAS_FONT, position: 'relative' }}>
        {/* Devices */}
        <div style={{ flex: 1, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 30, left: 10 }}>
            <LaptopFrame width={680}>
              <div style={{ width: 1440, height: 900, transform: 'scale(0.46)', transformOrigin: 'top left' }}>
                <RetailDesktop />
              </div>
            </LaptopFrame>
          </div>
          <div style={{ position: 'absolute', bottom: 10, right: 0 }}>
            <div style={{ width: 380, height: 240, borderRadius: 16, background: N.card, border: `1px solid ${N.line}`, padding: 18, boxShadow: '0 14px 40px rgba(8,42,107,0.15)' }}>
              <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: N.muted, letterSpacing: 0.8, textTransform: 'uppercase' }}>Stock por sucursal · MX-01</div>
              <div style={{ fontSize: 18, fontWeight: 600, marginTop: 6 }}>Pintura vinílica 19L</div>
              <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: p.accent, marginTop: 2 }}>SKU 78214-001</div>
              <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                {[
                  ['Disponible', 4, '#B43E2E'],
                  ['Mínimo', 12, p.accent],
                  ['Reorden', 24, p.accent2],
                ].map(([l, v, c], i) => (
                  <div key={i} style={{ flex: 1, padding: 10, background: N.page, border: `1px solid ${N.line}`, borderRadius: 8 }}>
                    <div style={{ fontFamily: ATLAS_MONO, fontSize: 9.5, color: N.muted, letterSpacing: 0.6, textTransform: 'uppercase' }}>{l}</div>
                    <div style={{ fontSize: 22, fontWeight: 600, color: c, marginTop: 4, fontFamily: ATLAS_FONT, letterSpacing: -0.4 }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14, padding: '10px 12px', background: '#FBE7E1', borderRadius: 8, fontSize: 11.5, color: '#B43E2E', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon.warning size={14} color="#B43E2E" />
                <span><strong>Stock crítico</strong> · ordena 20 unidades antes del martes</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right copy */}
        <div style={{ flex: '0 0 38%', display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingRight: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
            <div style={{ padding: '5px 10px', background: p.accent, color: '#fff', borderRadius: 999, fontFamily: ATLAS_MONO, fontSize: 11, letterSpacing: 0.6, fontWeight: 500 }}>PRESET 02</div>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: p.accentInk, letterSpacing: 1.4, textTransform: 'uppercase' }}>Inventario que cuadra</div>
          </div>
          <div style={{ fontFamily: ATLAS_SERIF, fontSize: 56, fontWeight: 500, lineHeight: 1.02, letterSpacing: -1.4, color: N.ink }}>
            Atlas One <span style={{ color: p.accent }}>Retail</span>
          </div>
          <div style={{ fontFamily: ATLAS_SERIF, fontSize: 28, fontWeight: 400, lineHeight: 1.15, marginTop: 14, letterSpacing: -0.4, color: N.body }}>
            Para tiendas con miles de SKUs y stock por sucursal.
          </div>
          <div style={{ fontSize: 15, color: N.body, lineHeight: 1.6, margin: '22px 0 28px', maxWidth: 500 }}>
            Ferreterías, farmacias, abarrotes, papelerías. Códigos de barras, unidades de medida, precios por nivel y multicaja real — todo conectado a la misma plataforma Atlas One.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              ['2 481', 'SKUs activos en promedio'],
              ['3', 'sucursales sincronizadas en vivo'],
              ['12s', 'para detectar stock crítico'],
            ].map(([k, v], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
                <div style={{ fontSize: 28, fontWeight: 600, color: p.accent, letterSpacing: -0.6, fontFamily: ATLAS_FONT, minWidth: 80 }}>{k}</div>
                <div style={{ fontSize: 13, color: N.body }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
            <Button label="Solicitar implementación" kind="primary" preset={p} icon={Icon.arrowRight} />
            <Button label="Demo guiada" kind="secondary" />
          </div>
        </div>
      </div>

      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: '14px 70px', display: 'flex', alignItems: 'center', gap: 16,
        borderTop: `1px solid ${p.accent}20`, background: 'rgba(255,255,255,0.5)', backdropFilter: 'blur(8px)',
      }}>
        <Wordmark color={N.ink} accent={p.accent} size={13} />
        <div style={{ width: 1, height: 18, background: N.line2 }} />
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: N.muted, letterSpacing: 0.6 }}>SKU · CÓDIGO DE BARRAS · MULTICAJA · SUCURSALES</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: N.muted }}>atlas.tech / retail</div>
      </div>
    </HeroBg>
  );
}

Object.assign(window, { RetailDesktop, RetailTouch, RetailMobile, RetailHero });
