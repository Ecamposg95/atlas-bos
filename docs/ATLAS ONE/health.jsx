// health.jsx — Atlas One Health (Preset 05)
// Color: Turquesa, blanco clínico. Confianza, limpieza, calma.

const healthP = () => PRESETS.health;

const healthSidebarItems = [
  { header: 'Consultorio' },
  { icon: Icon.calendar, label: 'Agenda clínica',  badge: '12' },
  { icon: Icon.users,    label: 'Pacientes',       badge: '482' },
  { icon: Icon.cross,    label: 'Servicios' },
  { header: 'Atención' },
  { icon: Icon.document, label: 'Expedientes' },
  { icon: Icon.pulse,    label: 'Seguimiento' },
  { icon: Icon.bell,     label: 'Recordatorios',   badge: '6' },
  { header: 'Negocio' },
  { icon: Icon.card,     label: 'Cobros' },
  { icon: Icon.chart,    label: 'Reportes' },
  { icon: Icon.cog,      label: 'Ajustes' },
];

// ─── 01 · Desktop · Agenda clínica + paciente ─────────────────
function HealthDesktop() {
  const p = healthP();
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', background: '#F5FAFA', fontFamily: ATLAS_FONT }}>
      <Sidebar preset={p} active="Agenda clínica" items={healthSidebarItems}
        footer={<SidebarUser preset={p} name="Dra. Sandra Vega" role="Cardióloga" branch="Consultorio 4" />} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar
          title="Agenda · lunes 28 de noviembre"
          sub="12 CITAS · 4 CONSULTORIOS · 8 PRIMERA VEZ · 4 SUBSECUENTES"
          preset={p}
          right={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <SearchInput preset={p} placeholder="Buscar paciente, expediente o cita…" width={300} />
              <Button label="+ Cita" kind="primary" preset={p} icon={Icon.plus} />
            </div>
          }
        />

        <div style={{ flex: 1, padding: '20px 26px', background: '#FAFCFC', display: 'flex', gap: 16, overflow: 'hidden' }}>
          {/* Agenda */}
          <div style={{ flex: 1.4, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <Kpi label="Citas hoy" value="12" sub="8 confirmadas · 2 pendientes" />
              <Kpi label="Ingresos día" value={mxnInt(14600)} delta="+9%" trend={[5,6,5,7,6,8,7,8,9,9,10,10]} accent={p.accent} />
              <Kpi label="Tiempo prom. consulta" value="32 min" sub="dentro de objetivo · 30 min" />
              <Kpi label="No-shows · 30d" value="4.2%" sub="−2.1 pp con recordatorios" />
            </div>

            <Card pad={0} style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: `1px solid ${N.line}` }}>
                <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: N.muted, letterSpacing: 0.6, textTransform: 'uppercase' }}>Agenda del día</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {['Dra. Vega', 'Dr. Reyes', 'Dra. Lara', 'Dr. Pinto'].map((n, i) => (
                    <div key={n} style={{ padding: '4px 10px', fontFamily: ATLAS_MONO, fontSize: 10, borderRadius: 5, background: i === 0 ? p.accent : N.page, color: i === 0 ? '#fff' : N.body }}>{n}</div>
                  ))}
                </div>
              </div>
              {[
                { t: '09:00', dur: 30, p: 'Carmen Salinas', age: '54 a', svc: 'Consulta cardiología', kind: 'subseq', status: 'done',  note: 'Seguimiento HTA · receta digital' },
                { t: '09:30', dur: 45, p: 'Roberto Méndez', age: '62 a', svc: 'Primera vez · arritmia', kind: 'first',  status: 'done', note: 'Electrocardiograma · OK' },
                { t: '10:30', dur: 30, p: 'Lucía Pardo',    age: '38 a', svc: 'Consulta general', kind: 'subseq', status: 'inprog', note: 'Revisión postoperatorio' },
                { t: '11:00', dur: 30, p: 'Juan Carlos Méndez', age: '46 a', svc: 'Subsecuente · prevención', kind: 'subseq', status: 'next', note: 'Confirma 14:00 vía SMS' },
                { t: '11:30', dur: 45, p: 'Ana Sofía Reyes', age: '29 a', svc: 'Primera vez · palpitaciones', kind: 'first', status: 'confirmed' },
                { t: '12:30', dur: 30, p: 'Esteban Quiroga', age: '57 a', svc: 'Subsecuente · control', kind: 'subseq', status: 'confirmed' },
                { t: '13:00', dur: 30, p: 'Fernanda Ortiz', age: '41 a', svc: 'Primera vez · soplo', kind: 'first', status: 'confirmed' },
              ].map((a, i) => {
                const statusColor = {
                  done:      { c: '#0E8A4E', soft: '#E3F4EA', label: 'Atendido'   },
                  inprog:    { c: p.accent,  soft: p.accentSoft, label: 'En curso' },
                  next:      { c: '#9A6610', soft: '#FBEFD7', label: 'Siguiente'  },
                  confirmed: { c: '#1F4FC8', soft: '#E5ECFB', label: 'Confirmada' },
                }[a.status];
                return (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '60px 1fr 180px 110px',
                    padding: '12px 18px', alignItems: 'center',
                    borderBottom: i < 6 ? `1px solid ${N.line}` : 'none',
                    background: a.status === 'inprog' ? p.accentSoft : 'transparent',
                  }}>
                    <div style={{ fontFamily: ATLAS_MONO, fontSize: 13, color: p.accentInk, fontWeight: 600 }}>{a.t}</div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 500 }}>{a.p}</span>
                        <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 9.5, fontFamily: ATLAS_MONO, background: a.kind === 'first' ? '#FBEFD7' : '#E5ECFB', color: a.kind === 'first' ? '#9A6610' : '#1F4FC8', fontWeight: 500 }}>{a.kind === 'first' ? '1ª VEZ' : 'SUBS.'}</span>
                        <span style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: N.muted }}>· {a.age}</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: N.muted, marginTop: 2 }}>{a.svc}</div>
                      {a.note && <div style={{ fontSize: 10.5, color: p.accentInk, marginTop: 2, fontFamily: ATLAS_MONO }}>↳ {a.note}</div>}
                    </div>
                    <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: N.muted }}>{a.dur} min · Consultorio 4</div>
                    <div style={{ textAlign: 'right' }}>
                      <Badge color={statusColor.c} soft={statusColor.soft} dot>{statusColor.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </Card>
          </div>

          {/* Patient detail */}
          <div style={{ width: 360, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Card pad={20} style={{ borderColor: p.accent, borderWidth: 1.5 }}>
              <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: p.accentInk, letterSpacing: 0.6, textTransform: 'uppercase' }}>Paciente · en curso</div>
              <div style={{ fontSize: 22, fontWeight: 600, marginTop: 6, letterSpacing: -0.3 }}>Lucía Pardo Solís</div>
              <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: N.muted, marginTop: 2 }}>EXP-04821 · F · 38 AÑOS · O+ · ALERGIA · PENICILINA</div>

              <div style={{ marginTop: 14, padding: 14, background: p.accentSoft, borderRadius: 10 }}>
                <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: N.muted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>Signos vitales · hoy 10:32</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {[['TA', '118/76', 'mmHg'], ['FC', '74', 'lpm'], ['Temp', '36.5', '°C'], ['SpO₂', '98', '%']].map(([l, v, u], i) => (
                    <div key={i}>
                      <div style={{ fontFamily: ATLAS_MONO, fontSize: 9.5, color: N.muted, letterSpacing: 0.5 }}>{l}</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                        <div style={{ fontSize: 20, fontWeight: 600, color: p.accentInk, fontFamily: ATLAS_FONT, letterSpacing: -0.4 }}>{v}</div>
                        <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: N.muted }}>{u}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: N.muted, letterSpacing: 0.5, textTransform: 'uppercase' }}>Motivo de la consulta</div>
                <div style={{ fontSize: 13, color: N.body, marginTop: 4, lineHeight: 1.5 }}>Control postoperatorio · stent coronario 14 oct. Sin disnea ni dolor torácico desde el alta.</div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: N.muted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>Medicación activa</div>
                {[
                  ['Clopidogrel', '75 mg c/24h'],
                  ['Atorvastatina', '40 mg c/24h'],
                  ['Bisoprolol', '5 mg c/24h'],
                ].map(([m, d], i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: N.page, borderRadius: 6, marginTop: 4, fontSize: 12 }}>
                    <span style={{ color: N.body, fontWeight: 500 }}>{m}</span>
                    <span style={{ fontFamily: ATLAS_MONO, color: N.muted }}>{d}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 14 }}>
                <Button label="Nota clínica" kind="secondary" />
                <Button label="Cobrar consulta" kind="primary" preset={p} icon={Icon.card} />
              </div>
            </Card>

            <Card pad={16}>
              <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: N.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 }}>Recordatorios · siguiente 24h</div>
              {[
                ['SMS · 6 pacientes',          'enviado · cita mañana'],
                ['WhatsApp · 2 confirmaciones',  'esperando respuesta'],
                ['Llamada · 1 paciente',       'pendiente'],
              ].map(([t, s], i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: i ? `1px solid ${N.line}` : 'none', fontSize: 12 }}>
                  <span style={{ color: N.body }}>{t}</span>
                  <span style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: N.muted }}>{s}</span>
                </div>
              ))}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 02 · Tablet · Ficha del paciente (vista clínica) ─────────
function HealthTouch() {
  const p = healthP();
  return (
    <div style={{ width: '100%', height: '100%', background: '#F5FAFA', display: 'flex', flexDirection: 'column', fontFamily: ATLAS_FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 22px', background: '#FFF', borderBottom: `1px solid ${N.line}` }}>
        <Wordmark color={N.ink} accent={p.accent} size={14} sub="HEALTH · CONSULTORIO 4" />
        <div style={{ width: 1, height: 22, background: N.line }} />
        <Badge color={p.accent} soft={p.accentSoft} dot>En curso · 10:32</Badge>
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: N.muted }}>DRA. SANDRA VEGA · CARDIO</div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Patient header */}
          <Card pad={20}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <div style={{
                width: 76, height: 76, borderRadius: 18,
                background: `linear-gradient(135deg, ${p.accent}, ${p.accent2})`,
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 30, fontWeight: 500, fontFamily: ATLAS_SERIF,
              }}>LP</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 24, fontWeight: 600, color: N.ink, letterSpacing: -0.4 }}>Lucía Pardo Solís</div>
                <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: N.muted, marginTop: 4, letterSpacing: 0.3 }}>EXP-04821 · F · 38 a · O+ · 168 cm · 64 kg · ALERGIA: PENICILINA</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  {['Hipertensión', 'Postop stent · 14 oct', 'No fumadora'].map(t => (
                    <span key={t} style={{ padding: '4px 10px', background: p.accentSoft, color: p.accentInk, borderRadius: 999, fontSize: 11, fontFamily: ATLAS_MONO }}>{t}</span>
                  ))}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: N.muted }}>SIGUIENTE CITA</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>15 dic · 09:00</div>
                <div style={{ fontSize: 11, color: N.muted, marginTop: 2 }}>Control 4 meses</div>
              </div>
            </div>
          </Card>

          {/* Vitals + chart */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 14 }}>
            <Card pad={18}>
              <SectionTitle>Signos vitales · 10:32</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {[
                  ['Presión arterial', '118/76', 'mmHg',  '↓ 6 desde octubre', '#0E8A4E'],
                  ['Frecuencia card.', '74',     'lpm',   'normal',            '#0E8A4E'],
                  ['Temperatura',      '36.5',   '°C',    'normal',            '#0E8A4E'],
                  ['Saturación O₂',    '98',     '%',     'normal',            '#0E8A4E'],
                ].map(([l, v, u, s, c], i) => (
                  <div key={i} style={{ padding: 12, background: p.accentSoft, borderRadius: 8 }}>
                    <div style={{ fontFamily: ATLAS_MONO, fontSize: 9.5, color: N.muted, letterSpacing: 0.5, textTransform: 'uppercase' }}>{l}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
                      <div style={{ fontSize: 22, fontWeight: 600, color: p.accentInk, letterSpacing: -0.4, fontFamily: ATLAS_FONT }}>{v}</div>
                      <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: N.muted }}>{u}</div>
                    </div>
                    <div style={{ fontFamily: ATLAS_MONO, fontSize: 9.5, color: c, marginTop: 2 }}>● {s}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card pad={18}>
              <SectionTitle>Presión arterial · últimos 90 días</SectionTitle>
              <LineChart
                series={[
                  { values: [140,138,135,134,132,130,128,126,124,122,120,118] },  // sistólica
                  { values: [92,90,88,87,85,84,82,82,80,78,77,76] },               // diastólica
                ]}
                width={420} height={170}
                color={p.accent} color2={p.accent2}
                labels={['ago','','sep','','oct','','','nov','','','','hoy']}
              />
            </Card>
          </div>

          {/* Notes */}
          <Card pad={18} style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
              <SectionTitle>Nota clínica · 28 nov 2026</SectionTitle>
              <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: p.accent }}>Borrador · autoguardado</div>
            </div>
            <div style={{ background: N.page, border: `1px solid ${N.line}`, borderRadius: 8, padding: 14, fontFamily: ATLAS_SERIF, fontSize: 13.5, color: N.body, lineHeight: 1.65 }}>
              <p style={{ margin: 0 }}><strong>Subjetivo · </strong>Paciente asintomática desde el alta del stent (14 oct). Niega disnea, palpitaciones o dolor torácico. Apego a tratamiento del 100%, tolerancia adecuada.</p>
              <p style={{ margin: '10px 0 0' }}><strong>Objetivo · </strong>TA 118/76, FC 74, ritmo sinusal. Auscultación cardiaca y pulmonar sin alteraciones. Cicatriz radial sin signos de complicación.</p>
              <p style={{ margin: '10px 0 0' }}><strong>Plan · </strong>Continuar esquema actual. Control en 4 meses. Solicitar perfil de lípidos y ecocardiograma de control.</p>
            </div>
          </Card>
        </div>

        <div style={{ width: 280, background: '#FFF', borderLeft: `1px solid ${N.line}`, padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: N.muted, letterSpacing: 0.6, textTransform: 'uppercase' }}>Acciones clínicas</div>
          {[
            { l: 'Receta digital',     icon: Icon.document, primary: true },
            { l: 'Solicitar estudio',  icon: Icon.beaker },
            { l: 'Adjuntar archivo',   icon: Icon.plus },
            { l: 'Programar control',  icon: Icon.calendar },
          ].map((a, i) => {
            const IconCmp = a.icon;
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 8,
                background: a.primary ? p.accent : p.accentSoft,
                color: a.primary ? '#fff' : p.accentInk,
                fontWeight: a.primary ? 600 : 500, fontSize: 13.5,
              }}>
                <IconCmp size={16} color={a.primary ? '#fff' : p.accent} />
                <span style={{ flex: 1 }}>{a.l}</span>
              </div>
            );
          })}
          <div style={{ marginTop: 12, padding: 14, background: p.accentSoft, borderRadius: 10 }}>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: N.muted, letterSpacing: 0.5, textTransform: 'uppercase' }}>Cobro de hoy</div>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 24, fontWeight: 600, color: p.accentInk, marginTop: 4, letterSpacing: -0.4 }}>{mxn(1200.00)}</div>
            <div style={{ fontSize: 11, color: N.muted, marginTop: 2 }}>Consulta subsecuente</div>
            <Button label="Cobrar y emitir factura" kind="primary" preset={p} icon={Icon.arrowRight} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 03 · Hero comercial ──────────────────────────────────────
function HealthHero() {
  const p = healthP();
  return (
    <div style={{ width: '100%', height: '100%', background: '#F5FAFA', position: 'relative', overflow: 'hidden', fontFamily: ATLAS_FONT }}>
      <div style={{ position: 'absolute', inset: 0,
        backgroundImage: `radial-gradient(circle at 0% 0%, ${p.accent}25, transparent 50%), radial-gradient(circle at 100% 100%, ${p.accent2}35, transparent 50%)`,
      }} />
      <div style={{ width: '100%', height: '100%', display: 'flex', padding: '60px 70px', gap: 36, position: 'relative' }}>
        <div style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
            <div style={{ padding: '5px 10px', background: p.accent, color: '#fff', borderRadius: 999, fontFamily: ATLAS_MONO, fontSize: 11, letterSpacing: 0.6, fontWeight: 500 }}>PRESET 05</div>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 11, color: p.accentInk, letterSpacing: 1.4, textTransform: 'uppercase' }}>Agenda y expediente clínico</div>
          </div>
          <div style={{ fontFamily: ATLAS_SERIF, fontSize: 60, fontWeight: 500, lineHeight: 1, letterSpacing: -1.5, color: N.ink }}>
            Atlas One <span style={{ color: p.accent }}>Health</span>
          </div>
          <div style={{ fontFamily: ATLAS_SERIF, fontSize: 26, fontWeight: 400, lineHeight: 1.15, marginTop: 14, letterSpacing: -0.3, color: N.body }}>
            Software clínico ligero para consultorios que quieren ordenar la operación.
          </div>
          <div style={{ fontSize: 15, color: N.body, lineHeight: 1.6, margin: '22px 0 28px', maxWidth: 480 }}>
            Médicos, dentistas, fisioterapeutas y quiroprácticos. Citas, pacientes, expediente básico, cobros y recordatorios — con la calma que requiere un consultorio serio.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
            {[
              ['482', 'pacientes activos'],
              ['4.2%', 'no-shows con recordatorios'],
              ['32 min', 'tiempo prom. consulta'],
              ['100%', 'expediente digital'],
            ].map(([k, v], i) => (
              <div key={i} style={{ paddingLeft: 14, borderLeft: `2px solid ${p.accent}` }}>
                <div style={{ fontSize: 24, fontWeight: 600, color: p.accentInk, letterSpacing: -0.4 }}>{k}</div>
                <div style={{ fontSize: 12, color: N.muted, marginTop: 2 }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button label="Solicitar demo clínica" kind="primary" preset={p} icon={Icon.arrowRight} />
            <Button label="Hablar con un asesor" kind="secondary" />
          </div>
        </div>

        <div style={{ flex: 1, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 40, right: 0 }}>
            <LaptopFrame width={700}>
              <div style={{ width: 1440, height: 900, transform: 'scale(0.475)', transformOrigin: 'top left' }}>
                <HealthDesktop />
              </div>
            </LaptopFrame>
          </div>
          <div style={{
            position: 'absolute', top: 30, left: 0,
            background: '#fff', border: `1px solid ${p.accent}40`, borderRadius: 14, padding: 16, width: 220,
            boxShadow: `0 12px 32px ${p.accent}25`, transform: 'rotate(-3deg)',
          }}>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 9.5, color: N.muted, letterSpacing: 0.5, textTransform: 'uppercase' }}>Presión arterial · 90 días</div>
            <div style={{ fontFamily: ATLAS_FONT, fontSize: 28, fontWeight: 600, color: p.accentInk, marginTop: 4, letterSpacing: -0.6 }}>118 / 76</div>
            <div style={{ fontFamily: ATLAS_MONO, fontSize: 10, color: '#0E8A4E', marginTop: 2 }}>● −6 desde octubre</div>
            <div style={{ marginTop: 10 }}>
              <Sparkline values={[140,138,135,134,132,130,128,126,124,122,120,118]} color={p.accent} width={188} height={36} fill />
            </div>
          </div>
        </div>
      </div>
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: '14px 70px', display: 'flex', alignItems: 'center', gap: 16,
        borderTop: `1px solid ${p.accent}20`, background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(8px)',
      }}>
        <Wordmark color={N.ink} accent={p.accent} size={13} />
        <div style={{ width: 1, height: 18, background: N.line2 }} />
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: N.muted, letterSpacing: 0.6 }}>AGENDA · PACIENTES · EXPEDIENTE · COBROS · RECORDATORIOS</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: ATLAS_MONO, fontSize: 10.5, color: N.muted }}>atlas.tech / health</div>
      </div>
    </div>
  );
}

Object.assign(window, { HealthDesktop, HealthTouch, HealthHero });
