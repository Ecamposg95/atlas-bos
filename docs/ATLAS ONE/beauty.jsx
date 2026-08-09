// beauty.jsx — Atlas One Beauty & Wellness (Preset 04)
// Color: Rosa dusty, champagne. Premium, sofisticado, cálido.

const beautyP = () => PRESETS.beauty;

const beautySidebarItems = [
  { header: 'Día a día' },
  { icon: Icon.calendar, label: 'Agenda',         badge: '14' },
  { icon: Icon.sparkles, label: 'Servicios' },
  { icon: Icon.users,    label: 'Especialistas' },
  { header: 'Clientas' },
  { icon: Icon.heart,    label: 'Membresías',      badge: '128' },
  { icon: Icon.star,     label: 'Paquetes' },
  { icon: Icon.user,     label: 'Clientela' },
  { header: 'Negocio' },
  { icon: Icon.pkg,      label: 'Productos' },
  { icon: Icon.bars,     label: 'Comisiones' },
  { icon: Icon.chart,    label: 'Reportes' },
  { icon: Icon.cog,      label: 'Ajustes' },
];

// ─── 01 · Desktop · Agenda + clientes ─────────────────────────
function BeautyDesktop() {
  const p = beautyP();
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', background: '#F8F1ED', fontFamily: ATLAS_FONT }}>
      <Sidebar preset={p} active="Agenda" items={beautySidebarItems}
        footer={<SidebarUser preset={p} name="Valeria Núñez" role="Recepción" branch="Polanco" />} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar
          title="Agenda · sábado 26 de noviembre"
          sub="14 CITAS · 5 ESPECIALISTAS · OCUPACIÓN 86% · 8 MEMBRESÍAS ACTIVAS"
          preset={p}
          right={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <SearchInput preset={p} placeholder="Buscar clienta, servicio o paquete…" width={300} />
              <Button label="+ Cita" kind="primary" preset={p} icon={Icon.plus} />
            </div>
          }
        />
        <div style={{ flex: 1, padding: '20px 26px', background: '#FBF5F1', display: 'flex', gap: 16, overflow: 'hidden' }}>
          {/* Day strip + appointments */}
          <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <Kpi label="Ingresos del día" value={mxn(18420)} delta="+14%" trend={[4,5,6,5,7,8,7,9,8,10,11,12]} accent={p.accent} />
              <Kpi label="Servicios" value="22" sub="14 citas · 8 walk-in" />
              <Kpi label="Ticket promedio" value={mxn(836)} delta="+6%" trend={[6,7,6,8,7,9,8,9,10,9,10,11]} accent={p.accent} />
              <Kpi label="Recompra 30d" value="64%" sub="clientela recurrente" />
            </div>

            <Card pad={0} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${N.line}` }}>
                <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: N.muted, letterSpacing: 0.6, textTransform: 'uppercase' }}>Próximas citas · siguiente 4 horas</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['Daniela', 'Renata', 'Sofía', 'Andrea', 'Camila'].map((n, i) => (
                    <div key={n} title={n} style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: ['#D9B58C','#B16E78','#C7878F','#A47A6A','#D4A574'][i],
                      color: '#fff', fontSize: 10, fontWeight: 600,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{n[0]}</div>
                  ))}
                </div>
              </div>
              {[
                { t: '14:00', client: 'María José Aguirre',  svc: 'Color + corte premium',  sp: 'Daniela',  spColor: '#D9B58C', tag: 'GOLD', dur: '90 min',  price: 1480 },
                { t: '14:30', client: 'Renata Beltrán',      svc: 'Spa de uñas · gel',      sp: 'Sofía',    spColor: '#C7878F', tag: null,  dur: '60 min',  price: 480 },
                { t: '15:00', client: 'Ximena Ortega ★',     svc: 'Facial · vitamina C',    sp: 'Andrea',   spColor: '#A47A6A', tag: 'VIP', dur: '75 min',  price: 920 },
                { t: '15:30', client: 'Paulina Gómez',       svc: 'Pestañas extensión',     sp: 'Camila',   spColor: '#D4A574', tag: null,  dur: '90 min',  price: 720 },
                { t: '16:00', client: 'Adriana Lara',        svc: 'Masaje 60m · descontracturante', sp: 'Renata', spColor: '#B16E78', tag: null, dur: '60 min', price: 580 },
                { t: '16:30', client: 'Sofía Cantú · GOLD',  svc: 'Manicura + pedicura',    sp: 'Sofía',    spColor: '#C7878F', tag: 'GOLD', dur: '75 min',  price: 0,    member: true },
              ].map((a, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '60px 1fr 160px 90px 100px',
                  padding: '14px 18px', borderBottom: i < 5 ? `1px solid ${N.line}` : 'none',
                  alignItems: 'center',
                }}>
                  <div style={{ fontFamily: ATLAS_MONO, fontSize: 13, color: p.accentInk, fontWeight: 600 }}>{a.t}</div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 500 }}>{a.client}</span>
                      {a.tag && <span style={{ padding: '1px 6px', background: a.tag === 'VIP' ? '#1A0B2E' : p.accent, color: '#fff', borderRadius: 4, fontSize: 9.5, fontFamily: ATLAS_MONO, letterSpacing: 0.5, fontWeight: 600 }}>{a.tag}</span>}
                    </div>
                    <div style={{ fontSize: 11.5, color: N.muted, marginTop: 2, fontFamily: ATLAS_FONT, fontStyle: 'italic' }}>{a.svc}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 6, background: a.spColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600 }}>{a.sp[0]}</div>
                    <div style={{ fontSize: 12, color: N.body }}>{a.sp}</div>
                  </div>
                  <div style={{ fontFamily: ATLAS_MONO, fontSize: 11.5, color: N.muted, textAlign: 'right' }}>{a.dur}</div>
                  <div style={{ textAlign: 'right', fontFamily: ATLAS_MONO, fontSize: 14, fontWeight: 600 }}>
                    {a.member ? <span style={{ color: p.accent, fontSize: 11.5 }}>Membresía</span> : mxn(a.price)}
                  </div>
                </div>
              ))}
            </Card>
          </div>

          {/* Right: services + membership */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Card pad={18}>
              <SectionTitle action="Ver todos →">Servicios más vendidos · semana</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  ['Manicura + pedicura',       42, 14820, 0.92, p.accent],
                  ['Color + corte premium',     22, 32560, 0.78, p.accent2],
                  ['Facial · vitamina C',       28, 25760, 0.66, p.accent],
                  ['Pestañas · extensión',      18, 12960, 0.55, p.accent2],
                  ['Masaje · descontracturante',14,  8120, 0.42, p.accent],
                ].map(([name, qty, total, pct, c], i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 100px', alignItems: 'center', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 12.5, color: N.ink }}>{name}</div>
                      <div style={{ height: 3, background: N.line, borderRadius: 2, marginTop: 5, overflow: 'hidden' }}>
                        <div style={{ width: `${pct*100}%`, height: '100%', background: c }} />
                      </div>
                    </div>
                    <div style={{ fontFamily: ATLAS_MONO, fontSize: 11.5, color: N.muted, textAlign: 'right' }}>{qty}×</div>
                    <div style={{ fontFamily: ATLAS_MONO, fontSize: 13, fontWeight: 500, textAlign: 'right' }}>{mxnInt(total)}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card pad={18} style={{ flex: 1, background: `linear-gradient(135deg, ${p.accentSoft}, #FBF5F1)`, borderColor: p.accent + '40' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: p.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon.heart size={18} color="#fff" />
                </div>
                <div>
                  <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: p.accentInk, letterSpacing: 0.6, textTransform: 'uppercase' }}>Programa GOLD · membresía</div>
                  <div style={{ fontSize: 18, fontWeight: 600, marginTop: 2, color: N.ink }}>128 socias activas</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, padding: '12px 0', borderTop: `1px solid ${p.accent}30`, borderBottom: `1px solid ${p.accent}30` }}>
                {[['Renovaron este mes', 22], ['Por vencer · 14d', 9], ['Ingreso recurrente', mxnInt(112400)]].map(([l, v], i) => (
                  <div key={i}>
                    <div style={{ fontFamily: ATLAS_MONO, fontSize: 9.5, color: N.muted, letterSpacing: 0.5, textTransform: 'uppercase' }}>{l}</div>
                    <div style={{ fontSize: 17, fontWeight: 600, marginTop: 2, color: p.accentInk, fontFamily: ATLAS_FONT, letterSpacing: -0.3 }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: N.muted, letterSpacing: 0.6, textTransform: 'uppercase' }}>Próximas a vencer</div>
                {[
                  ['Ximena Ortega', '5 días', 'Renovar GOLD'],
                  ['Daniela Soto',  '9 días', 'Renovar GOLD'],
                  ['Carolina Vega', '12 días', 'Recordatorio'],
                ].map(([n, d, a], i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: '#fff', borderRadius: 7, border: `1px solid ${N.line}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar name={n} size={26} color={p.accent} />
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 500 }}>{n}</div>
                        <div style={{ fontSize: 10.5, color: N.muted, fontFamily: ATLAS_MONO }}>{d}</div>
                      </div>
                    </div>
                    <div style={{ padding: '4px 10px', background: p.accent, color: '#fff', borderRadius: 5, fontSize: 11, fontWeight: 500 }}>{a}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 02 · Check-in táctil · membresía + paquetes ──────────────
function BeautyTouch() {
  const p = beautyP();
  return (
    <div style={{ width: '100%', height: '100%', background: '#FBF5F1', display: 'flex', flexDirection: 'column', fontFamily: ATLAS_FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 22px', background: '#FFF', borderBottom: `1px solid ${N.line}` }}>
        <Wordmark color={N.ink} accent={p.accent} size={14} sub="BEAUTY · POLANCO" />
        <div style={{ width: 1, height: 22, background: N.line }} />
        <Badge color={p.accent} soft={p.accentSoft} dot>Check-in · Valeria N.</Badge>
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: N.muted }}>SÁBADO 26 NOV · 13:48</div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Client card */}
        <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card pad={22} style={{ borderColor: p.accent, borderWidth: 1.5, background: `linear-gradient(135deg, #FFF, ${p.accentSoft})` }}>
            <div style={{ display: 'flex', gap: 18 }}>
              <div style={{
                width: 88, height: 88, borderRadius: 22,
                background: `linear-gradient(135deg, ${p.accent}, ${p.accent2})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: ATLAS_SERIF, fontSize: 38, fontWeight: 500, color: '#fff',
                flexShrink: 0,
              }}>XO</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 24, fontWeight: 600, color: N.ink, letterSpacing: -0.4 }}>Ximena Ortega</div>
                  <span style={{ padding: '2px 8px', background: '#1A0B2E', color: '#D9B58C', borderRadius: 4, fontSize: 10, fontFamily: ATLAS_MONO, letterSpacing: 0.6, fontWeight: 600 }}>VIP · GOLD</span>
                </div>
                <div style={{ fontFamily: ATLAS_MONO, fontSize: 11.5, color: N.muted, marginTop: 4, letterSpacing: 0.3 }}>CLIENTE-3492 · DESDE 2022 · 38 VISITAS</div>
                <div style={{ display: 'flex', gap: 16, marginTop: 14, fontSize: 12, color: N.body }}>
                  <div><span style={{ color: N.muted }}>Última visita</span> · <strong style={{ fontFamily: ATLAS_MONO }}>hace 18 días</strong></div>
                  <div><span style={{ color: N.muted }}>Total invertido</span> · <strong style={{ fontFamily: ATLAS_MONO }}>{mxn(28400)}</strong></div>
                  <div><span style={{ color: N.muted }}>Recompra</span> · <strong style={{ fontFamily: ATLAS_MONO }}>cada 23 días</strong></div>
                </div>
              </div>
            </div>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Card pad={18}>
              <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: N.muted, letterSpacing: 0.6, textTransform: 'uppercase' }}>Membresía GOLD</div>
              <div style={{ fontSize: 18, fontWeight: 600, marginTop: 6, color: p.accentInk }}>Vence en 5 días</div>
              <div style={{ marginTop: 14, padding: 12, background: p.accentSoft, borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: p.accentInk }}>Faciales · 4 de 6</span>
                  <span style={{ fontFamily: ATLAS_MONO, color: p.accentInk, fontWeight: 600 }}>2 restantes</span>
                </div>
                <div style={{ height: 5, background: '#fff', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
                  <div style={{ width: '66%', height: '100%', background: p.accent }} />
                </div>
              </div>
              <div style={{ marginTop: 8, padding: 12, background: p.accentSoft, borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: p.accentInk }}>Manicuras · 2 de 4</span>
                  <span style={{ fontFamily: ATLAS_MONO, color: p.accentInk, fontWeight: 600 }}>2 restantes</span>
                </div>
                <div style={{ height: 5, background: '#fff', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
                  <div style={{ width: '50%', height: '100%', background: p.accent }} />
                </div>
              </div>
              <div style={{ marginTop: 14, padding: '8px 12px', background: p.accent, color: '#fff', borderRadius: 7, fontSize: 12, fontWeight: 500, textAlign: 'center' }}>
                Renovar membresía → {mxn(4800)}/mes
              </div>
            </Card>
            <Card pad={18}>
              <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: N.muted, letterSpacing: 0.6, textTransform: 'uppercase' }}>Preferencias y notas</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {['Sin parabenos', 'Color rubio caramelo', 'Alergia · níquel', 'Café americano'].map(t => (
                  <span key={t} style={{ padding: '4px 10px', background: '#FFF', border: `1px solid ${N.line}`, borderRadius: 999, fontSize: 11, color: N.body }}>{t}</span>
                ))}
              </div>
              <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: N.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 14 }}>Últimas visitas</div>
              <div style={{ marginTop: 6 }}>
                {[
                  ['8 NOV', 'Facial vitamina C', 'Andrea'],
                  ['15 OCT', 'Color + corte premium', 'Daniela'],
                  ['28 SEP', 'Manicura + pedicura', 'Sofía'],
                ].map(([d, s, sp], i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 70px', padding: '6px 0', fontSize: 11.5, borderTop: i ? `1px solid ${N.line}` : 'none' }}>
                    <div style={{ fontFamily: ATLAS_MONO, color: N.muted }}>{d}</div>
                    <div>{s}</div>
                    <div style={{ color: N.muted }}>{sp}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Today */}
          <Card pad={18} style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
              <SectionTitle>Servicio de hoy · 15:00</SectionTitle>
              <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: '#0E8A4E', fontWeight: 600 }}>● ESPERANDO · 12 min</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div style={{ padding: 14, background: p.accentSoft, borderRadius: 10 }}>
                <div style={{ fontFamily: ATLAS_MONO, fontSize: 9.5, color: N.muted, letterSpacing: 0.5 }}>SERVICIO</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4, color: p.accentInk }}>Facial vitamina C</div>
                <div style={{ fontSize: 11, color: N.muted, marginTop: 2 }}>75 min · Andrea</div>
              </div>
              <div style={{ padding: 14, background: p.accentSoft, borderRadius: 10 }}>
                <div style={{ fontFamily: ATLAS_MONO, fontSize: 9.5, color: N.muted, letterSpacing: 0.5 }}>USA MEMBRESÍA</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4, color: p.accentInk }}>Sí · GOLD</div>
                <div style={{ fontSize: 11, color: N.muted, marginTop: 2 }}>3 de 6 faciales</div>
              </div>
              <div style={{ padding: 14, background: p.accentSoft, borderRadius: 10 }}>
                <div style={{ fontFamily: ATLAS_MONO, fontSize: 9.5, color: N.muted, letterSpacing: 0.5 }}>EXTRAS</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4, color: p.accentInk }}>Sérum facial</div>
                <div style={{ fontSize: 11, color: N.muted, marginTop: 2 }}>+ {mxn(380)}</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right: action panel */}
        <div style={{ width: 280, background: '#FFF', borderLeft: `1px solid ${N.line}`, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: N.muted, letterSpacing: 0.6, textTransform: 'uppercase' }}>Acciones</div>
          {[
            { l: 'Iniciar servicio',     icon: Icon.sparkles, primary: true },
            { l: 'Sumar producto',       icon: Icon.plus },
            { l: 'Reagendar próxima',    icon: Icon.calendar },
            { l: 'Enviar recordatorio',  icon: Icon.bell },
            { l: 'Convertir en paquete', icon: Icon.star },
          ].map((a, i) => {
            const IconCmp = a.icon;
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 8,
                background: a.primary ? p.accent : '#FBF5F1',
                color: a.primary ? '#fff' : N.ink,
                fontWeight: a.primary ? 600 : 500, fontSize: 13.5,
              }}>
                <IconCmp size={16} color={a.primary ? '#fff' : p.accent} />
                <span style={{ flex: 1 }}>{a.l}</span>
                {a.primary && <Icon.arrowRight size={14} color="#fff" />}
              </div>
            );
          })}

          <div style={{ marginTop: 'auto', padding: 14, background: '#FBF5F1', borderRadius: 10 }}>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: N.muted, letterSpacing: 0.5, textTransform: 'uppercase' }}>Comisión estimada hoy</div>
            <div style={{ fontSize: 22, fontWeight: 600, marginTop: 6, color: p.accent, fontFamily: ATLAS_FONT, letterSpacing: -0.4 }}>{mxn(184)}</div>
            <div style={{ fontSize: 10.5, color: N.muted, marginTop: 2 }}>Andrea · 20% de servicio</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 03 · Hero comercial ──────────────────────────────────────
function BeautyHero() {
  const p = beautyP();
  return (
    <div style={{ width: '100%', height: '100%', background: '#FBF5F1', position: 'relative', overflow: 'hidden', fontFamily: ATLAS_FONT }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `radial-gradient(circle at 80% -20%, ${p.accent}30, transparent 60%), radial-gradient(circle at 0% 100%, ${p.accent2}45, transparent 60%)`,
      }} />

      <div style={{ width: '100%', height: '100%', display: 'flex', padding: '60px 70px', gap: 36, position: 'relative' }}>
        <div style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
            <div style={{ padding: '5px 10px', background: p.accent, color: '#fff', borderRadius: 999, fontFamily: ATLAS_MONO, fontSize: 11, letterSpacing: 0.6, fontWeight: 500 }}>PRESET 04</div>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: p.accentInk, letterSpacing: 1.4, textTransform: 'uppercase' }}>Belleza y bienestar</div>
          </div>
          <div style={{ fontFamily: ATLAS_SERIF, fontSize: 56, fontWeight: 500, lineHeight: 1.02, letterSpacing: -1.3, color: N.ink }}>
            Atlas One <em style={{ color: p.accent, fontStyle: 'italic' }}>Beauty</em>
          </div>
          <div style={{ fontFamily: ATLAS_SERIF, fontSize: 26, fontWeight: 400, lineHeight: 1.15, marginTop: 14, letterSpacing: -0.3, color: N.body }}>
            Estéticas, uñas, spa y bienestar — operación que invita a regresar.
          </div>
          <div style={{ fontSize: 15, color: N.body, lineHeight: 1.6, margin: '22px 0 28px', maxWidth: 460 }}>
            Agenda por especialista, paquetes prepagados, membresías de recompra y comisiones automáticas. La clienta vuelve porque el sistema se acuerda de ella.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[['64%', 'recompra a 30 días'], ['128', 'socias activas en promedio'], ['86%', 'ocupación de agenda']].map(([k, v], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
                <div style={{ fontSize: 28, fontWeight: 600, color: p.accent, letterSpacing: -0.6, minWidth: 90 }}>{k}</div>
                <div style={{ fontSize: 13, color: N.body }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
            <Button label="Probar 1 mes gratis" kind="primary" preset={p} icon={Icon.arrowRight} />
            <Button label="Ver demo" kind="secondary" />
          </div>
        </div>

        <div style={{ flex: 1, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 30, right: 0 }}>
            <LaptopFrame width={700}>
              <div style={{ width: 1440, height: 900, transform: 'scale(0.475)', transformOrigin: 'top left' }}>
                <BeautyDesktop />
              </div>
            </LaptopFrame>
          </div>
          <div style={{
            position: 'absolute', bottom: 30, left: 10,
            background: '#fff', borderRadius: 16, padding: 18, width: 280,
            boxShadow: `0 14px 40px ${p.accent}30`,
            border: `1px solid ${p.accent}40`, transform: 'rotate(-2deg)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${p.accent}, ${p.accent2})`, color: '#fff', fontFamily: ATLAS_SERIF, fontSize: 18, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>XO</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Ximena Ortega</div>
                <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: p.accent, letterSpacing: 0.5 }}>VIP · GOLD · 38 VISITAS</div>
              </div>
            </div>
            <div style={{ padding: 12, background: p.accentSoft, borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: p.accentInk }}>Facial vitamina C · 4 de 6</div>
              <div style={{ height: 4, background: '#fff', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
                <div style={{ width: '66%', height: '100%', background: p.accent }} />
              </div>
            </div>
            <div style={{ marginTop: 10, fontSize: 11.5, color: N.muted, fontFamily: ATLAS_MONO }}>↳ Vence en 5 días · sugiere renovar</div>
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
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: N.muted, letterSpacing: 0.6 }}>AGENDA · MEMBRESÍAS · COMISIONES · CLIENTAS RECURRENTES</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: N.muted }}>atlas.tech / beauty</div>
      </div>
    </div>
  );
}

Object.assign(window, { BeautyDesktop, BeautyTouch, BeautyHero });
